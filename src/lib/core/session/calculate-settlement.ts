// import { db } from "@/lib/clients/db";
// import { SettlementComparison, SettlementData, SettlementLineItemStatus, SettlementSummary } from "@/lib/types/api";
// import { batches, inventoryTransactions as inventoryTransactionsTable, lineItems } from "@drizzle/schema";
// import { eq, inArray } from "drizzle-orm";
// import { PickingRequirement, pickingRequirementsSchema } from "./create-picking-requirements";

// type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;

// /**
//  * Calculate settlement data for a batch/session
//  * Compares picking requirements (expected) with inventory transactions (actual)
//  */
// export async function calculateSettlement(batchId: number): Promise<SettlementData | null> {
//   // 1. Get the batch
//   const batch = await db.query.batches.findFirst({
//     where: { id: batchId },
//   });

//   if (!batch) {
//     return null;
//   }

//   // 2. Parse picking requirements from stored JSON
//   let pickingRequirements: PickingRequirement[] = [];
//   const hasPickingList = !!batch.pickingListJson;

//   if (batch.pickingListJson) {
//     try {
//       pickingRequirements = pickingRequirementsSchema.parse(batch.pickingListJson);
//       console.log("pickingRequirements", pickingRequirements);
//     } catch (e) {
//       console.error("Failed to parse pickingListJson:", e);
//       return null;
//     }
//   }

//   // 3. Get all inventory transactions for this batch
//   const transactions = await db.query.inventoryTransactions.findMany({
//     where: { batchId },
//   });

//   // 4. Get current line item statuses for all line items in requirements
//   const lineItemIds = pickingRequirements.map((r) => r.lineItemId);

//   if (lineItemIds.length <= 0) {
//     return null;
//   }
//   const currentLineItems = await db.select().from(lineItems).where(inArray(lineItems.id, lineItemIds));

//   const lineItemStatusMap = new Map(currentLineItems.map((li) => [li.id, li.completionStatus]));

//   // 5. Create a map of transactions by line item ID
//   const transactionsByLineItem = new Map<string, InventoryTransaction>();
//   const orphanTransactions: SettlementData["orphanTransactions"] = [];

//   for (const transaction of transactions) {
//     if (transaction.lineItemId) {
//       if (transaction.reason === "assembly_usage") {
//         // all stock, print, transactions are assembly_usage
//         transactionsByLineItem.set(transaction.lineItemId, transaction);
//       }
//     } else {
//       // Transaction without line item = orphan
//       orphanTransactions.push(transaction);
//     }
//   }

//   // 6. Build comparison for each picking requirement
//   const comparison: SettlementComparison[] = [];

//   for (const req of pickingRequirements) {
//     const currentStatus = lineItemStatusMap.get(req.lineItemId) ?? "not_printed";
//     const transaction = transactionsByLineItem.get(req.lineItemId);

//     // Determine settlement status
//     let settlementStatus: SettlementLineItemStatus;
//     let isResolved = false;

//     if (currentStatus === "ignore") {
//       settlementStatus = "ignored";
//       isResolved = true;
//     } else if (req.expectedFulfillmentType === "black_label") {
//       settlementStatus = "black_label";
//       isResolved = true;
//     } else if (req.expectedFulfillmentType === "unaccounted") {
//       settlementStatus = "unaccounted";
//       // Unaccounted items are resolved if they have a non-pending status
//       isResolved = currentStatus !== "not_printed";
//     } else if (req.expectedFulfillmentType === "print") {
//       // Expected to print (blank decrement)
//       if (transaction && transaction.blankVariantId) {
//         settlementStatus = "matched";
//         isResolved = true;
//       } else if (currentStatus === "in_stock" && transaction?.productVariantId) {
//         // Was fulfilled from stock instead of print - still valid
//         settlementStatus = "matched";
//         isResolved = true;
//       } else if (currentStatus === "oos_blank" || currentStatus === "skipped") {
//         // OOS or skipped is a valid resolution
//         settlementStatus = "matched";
//         isResolved = true;
//       } else if (currentStatus === "printed" || currentStatus === "partially_printed" || currentStatus === "in_stock") {
//         // Has a completion status but no transaction = mismatch
//         settlementStatus = transaction ? "matched" : "missing";
//         isResolved = !!transaction;
//       } else {
//         settlementStatus = "missing";
//         isResolved = false;
//       }
//     } else if (req.expectedFulfillmentType === "stock") {
//       // Expected to fulfill from stock (product variant decrement)
//       if (transaction && transaction.productVariantId) {
//         settlementStatus = "matched";
//         isResolved = true;
//       } else if (currentStatus === "in_stock") {
//         settlementStatus = transaction ? "matched" : "missing";
//         isResolved = !!transaction;
//       } else {
//         settlementStatus = "missing";
//         isResolved = false;
//       }
//     } else {
//       settlementStatus = "unaccounted";
//       isResolved = currentStatus !== "not_printed";
//     }

//     comparison.push({
//       lineItemId: req.lineItemId,
//       lineItemName: req.lineItemName,
//       orderName: req.orderName,
//       orderId: req.orderId,
//       expectedFulfillmentType: req.expectedFulfillmentType,
//       expectedBlankVariantId: req.blankVariantId,
//       expectedProductVariantId: req.productVariantId,
//       expectedBlankDisplayName: req.blankDisplayName,
//       expectedProductDisplayName: req.productDisplayName,
//       actualTransaction: transaction
//         ? {
//             id: Number(transaction.id),
//             changeAmount: Number(transaction.changeAmount),
//             reason: transaction.reason,
//             blankVariantId: transaction.blankVariantId,
//             productVariantId: transaction.productVariantId,
//             createdAt: transaction.createdAt,
//             notes: null,
//           }
//         : null,
//       currentStatus,
//       settlementStatus,
//       isResolved,
//     });
//   }

//   // 7. Calculate summary
//   const summary: SettlementSummary = {
//     totalLineItems: comparison.length,
//     matched: comparison.filter((c) => c.settlementStatus === "matched").length,
//     missing: comparison.filter((c) => c.settlementStatus === "missing").length,
//     orphans: orphanTransactions.length,
//     blackLabel: comparison.filter((c) => c.settlementStatus === "black_label").length,
//     ignored: comparison.filter((c) => c.settlementStatus === "ignored").length,
//     unaccounted: comparison.filter((c) => c.settlementStatus === "unaccounted").length,
//     unresolved: comparison.filter((c) => !c.isResolved).length,
//   };

//   // 8. Determine if session can be settled
//   const blockingReasons: string[] = [];

//   if (!hasPickingList) {
//     blockingReasons.push("No picking list generated - generate session documents first");
//   }

//   if (summary.unresolved > 0) {
//     blockingReasons.push(`${summary.unresolved} line item(s) have unresolved inventory status`);
//   }

//   // Check for line items still in not_printed status
//   const notPrintedCount = comparison.filter(
//     (c) => c.currentStatus === "not_printed" && c.settlementStatus !== "black_label" && c.settlementStatus !== "ignored"
//   ).length;

//   if (notPrintedCount > 0) {
//     blockingReasons.push(`${notPrintedCount} line item(s) still in 'not_printed' status`);
//   }

//   const canSettle = blockingReasons.length === 0;

//   // Access settledAt safely (field may not be in schema yet until db pull)
//   const batchWithSettled = batch as typeof batch & { settledAt?: Date | null };

//   return {
//     batchId,
//     isSettled: !!batchWithSettled.settledAt,
//     settledAt: batchWithSettled.settledAt ?? null,
//     hasPickingList,
//     comparison,
//     summary,
//     canSettle,
//     blockingReasons,
//     orphanTransactions,
//   };
// }
