import { db } from "@/lib/clients/db";
import { DataResponse } from "@/lib/types/misc";
import { pickingRequirementSchema, type FulfillmentType } from "./create-picking-requirements";
import { inventoryTransactions, lineItemCompletionStatus, logs } from "@drizzle/schema";
import z from "zod";

const storedAssemblyLineSchema = z.object({
  id: z.string(),
  itemPosition: z.number(),
  expectedFulfillment: z.enum(["stock", "black_label", "print"]),
});


type TransactionWithLogs = typeof inventoryTransactions.$inferSelect & { log: (typeof logs.$inferSelect) | null };
type Log = typeof logs.$inferSelect;

export type InventoryTarget = {
  type: "blank" | "product";
  id: string;
  displayName: string;
  expectedChange: number;
  currentInventory: number;
  actualInventoryChange: number;
  // Misprint adjustments (sum of transactions with reason "misprint")
  misprintChange: number;
  // Actual change minus misprints - used for mismatch calculation
  adjustedActualChange: number;
  transactions: TransactionWithLogs[];
};

export type SettlementItem = {
  // Line item info
  lineItemId: string;
  lineItemName: string;
  orderName: string;
  position: number;
  orderId: string;
  currentStatus: (typeof lineItemCompletionStatus.enumValues)[number];

  // Expected fulfillment (from stored JSON)
  expectedFulfillment: FulfillmentType;

  // Primary inventory target based on expected fulfillment (null for black_label)
  inventoryTarget: InventoryTarget | null;

  // Both inventory targets for switching (when both exist)
  blankTarget: InventoryTarget | null;
  productTarget: InventoryTarget | null;

  // Transactions for this item (all, regardless of target)
  transactions: TransactionWithLogs[];
  actualInventoryChange: number;

  // Line item logs
  logs: Log[];

  // Computed flags
  hasStatusMismatch: boolean;
  hasInventoryMismatch: boolean;
  // True when expectedFulfillment doesn't match currentStatus (e.g., expected print but fulfilled from stock)
  hasFulfillmentMismatch: boolean;
  currentInventory: number;
};

/**
 * Gets settlement data for a session.
 * Uses the stored assemblyLineJson and pickingListJson as the source of truth.
 */
export const getSettlementData = async (
  batchId: number
): Promise<DataResponse<{ items: SettlementItem[]; batch: { id: number; active: boolean; startedAt: Date | null } }>> => {
  const batch = await db.query.batches.findFirst({
    where: { id: batchId },
  });

  if (!batch) {
    return { data: null, error: "Session not found" };
  }

  if (!batch.assemblyLineJson || !batch.pickingListJson) {
    return { data: null, error: "Session has not been started yet" };
  }

  const assemblyLineData =
    typeof batch.assemblyLineJson === "string"
      ? JSON.parse(batch.assemblyLineJson)
      : batch.assemblyLineJson;
  const pickingListData =
    typeof batch.pickingListJson === "string"
      ? JSON.parse(batch.pickingListJson)
      : batch.pickingListJson;

  const assemblyLineParsed = storedAssemblyLineSchema.array().safeParse(assemblyLineData);
  const pickingListParsed = pickingRequirementSchema.array().safeParse(pickingListData);

  if (!assemblyLineParsed.success || !pickingListParsed.success) {
    return { data: null, error: "Failed to parse session data" };
  }

  const assemblyLine = assemblyLineParsed.data;
  const pickingList = pickingListParsed.data;

  // Build picking requirements map for quick lookup
  const pickingMap = new Map(pickingList.map((p) => [p.lineItemId, p]));

  // Get all line item IDs
  const lineItemIds = assemblyLine.map((item) => item.id);

  // Fetch current line items status
  const lineItems = await db.query.lineItems.findMany({
    where: { id: { in: lineItemIds } },
    columns: { id: true, name: true, completionStatus: true, orderId: true },
    with: {
      order: { columns: { name: true } },
      productVariant: { with: { blankVariant: true } }
    },
  });
  const lineItemMap = new Map(lineItems.map((li) => [li.id, li]));

  // Fetch all inventory transactions for this batch
  const transactions = await db.query.inventoryTransactions.findMany({
    where: { batchId },
    with: {
      log: true,
    }
  });
  const transactionsByLineItem = new Map<string, TransactionWithLogs[]>();
  for (const tx of transactions) {
    if (!tx.lineItemId) continue;
    const existing = transactionsByLineItem.get(tx.lineItemId) ?? [];
    existing.push(tx);
    transactionsByLineItem.set(tx.lineItemId, existing);
  }

  // Fetch all logs for line items in this batch
  const lineItemLogs = await db.query.logs.findMany({
    where: { lineItemId: { in: lineItemIds }, batchId },
    orderBy: { createdAt: "desc" },
  });
  const logsByLineItem = new Map<string, Log[]>();
  for (const log of lineItemLogs) {
    if (!log.lineItemId) continue;
    const existing = logsByLineItem.get(log.lineItemId) ?? [];
    existing.push(log);
    logsByLineItem.set(log.lineItemId, existing);
  }

  // Build settlement items
  const items: SettlementItem[] = [];

  for (const assemblyItem of assemblyLine) {
    const lineItem = lineItemMap.get(assemblyItem.id);
    const picking = pickingMap.get(assemblyItem.id);
    const itemTransactions = transactionsByLineItem.get(assemblyItem.id) ?? [];
    const itemLogs = logsByLineItem.get(assemblyItem.id) ?? [];

    if (!lineItem || !picking) continue;

    // Separate transactions by target type
    const blankTransactions = itemTransactions.filter(tx => tx.blankVariantId !== null);
    const productTransactions = itemTransactions.filter(tx => tx.productVariantId !== null);

    // Build both inventory targets (when available)
    let blankTarget: InventoryTarget | null = null;
    let productTarget: InventoryTarget | null = null;

    if (picking.blankVariantId) {
      const actualChange = blankTransactions.reduce((sum, tx) => sum + tx.changeAmount, 0);
      // Sum of misprint transactions (these are expected extra decrements)
      const misprintChange = blankTransactions
        .filter(tx => tx.reason === "misprint")
        .reduce((sum, tx) => sum + tx.changeAmount, 0);
      
      blankTarget = {
        type: "blank",
        id: picking.blankVariantId,
        displayName: picking.blankDisplayName ?? "Unknown Blank",
        expectedChange: assemblyItem.expectedFulfillment === "print" ? -picking.quantity : 0,
        currentInventory: lineItem.productVariant?.blankVariant?.quantity ?? 0,
        actualInventoryChange: actualChange,
        misprintChange,
        // Adjusted = actual minus misprints (e.g., actual -2 with -1 misprint = adjusted -1)
        adjustedActualChange: actualChange - misprintChange,
        transactions: blankTransactions,
      };
    }

    if (picking.productVariantId) {
      const actualChange = productTransactions.reduce((sum, tx) => sum + tx.changeAmount, 0);
      // Misprints shouldn't happen on product variants, but handle for completeness
      const misprintChange = productTransactions
        .filter(tx => tx.reason === "misprint")
        .reduce((sum, tx) => sum + tx.changeAmount, 0);
      
      productTarget = {
        type: "product",
        id: picking.productVariantId,
        displayName: picking.productDisplayName ?? "Unknown Product",
        expectedChange: assemblyItem.expectedFulfillment === "stock" ? -picking.quantity : 0,
        currentInventory: lineItem.productVariant?.warehouseInventory ?? 0,
        actualInventoryChange: actualChange,
        misprintChange,
        adjustedActualChange: actualChange - misprintChange,
        transactions: productTransactions,
      };
    }

    // Determine primary inventory target based on expected fulfillment
    let inventoryTarget: InventoryTarget | null = null;
    if (assemblyItem.expectedFulfillment === "stock") {
      inventoryTarget = productTarget;
    } else if (assemblyItem.expectedFulfillment === "print") {
      inventoryTarget = blankTarget;
    }

    // Calculate total actual inventory change from all transactions
    const actualInventoryChange = itemTransactions.reduce((sum, tx) => sum + tx.changeAmount, 0);

    // Determine mismatches
    const expectedStatus = getExpectedStatus(assemblyItem.expectedFulfillment);
    const hasStatusMismatch = !isStatusMatch(lineItem.completionStatus, expectedStatus);
    
    // Check if fulfillment method doesn't match the status
    // e.g., expected "print" but status is "in_stock" (fulfilled from stock instead of printing)
    const hasFulfillmentMismatch = 
      (assemblyItem.expectedFulfillment === "print" && lineItem.completionStatus === "in_stock") ||
      (assemblyItem.expectedFulfillment === "stock" && lineItem.completionStatus === "printed");

    // Inventory mismatch is only a real error if there's no fulfillment mismatch
    // With fulfillment mismatch, inventory changes happen on different target, which is expected
    // Use adjustedActualChange which accounts for misprints (e.g., expected -1, actual -2 with 1 misprint = no mismatch)
    const hasInventoryMismatch =
      !hasFulfillmentMismatch && inventoryTarget !== null && inventoryTarget.adjustedActualChange !== inventoryTarget.expectedChange;

    items.push({
      lineItemId: assemblyItem.id,
      lineItemName: lineItem.name,
      orderName: lineItem.order?.name ?? "Unknown Order",
      position: assemblyItem.itemPosition,
      currentStatus: lineItem.completionStatus,
      expectedFulfillment: assemblyItem.expectedFulfillment,
      inventoryTarget,
      blankTarget,
      productTarget,
      transactions: itemTransactions,
      actualInventoryChange,
      logs: itemLogs,
      hasStatusMismatch,
      hasFulfillmentMismatch,
      orderId: lineItem.orderId,
      hasInventoryMismatch,
      currentInventory: assemblyItem.expectedFulfillment === 'print' ? lineItem.productVariant?.blankVariant?.quantity ?? 0 : lineItem.productVariant?.warehouseInventory ?? 0,
    });
  }

  // Sort by position
  items.sort((a, b) => a.position - b.position);

  return {
    data: {
      items,
      batch: { id: batch.id, active: batch.active, startedAt: batch.startedAt },
    },
    error: null,
  };
};

/**
 * Get the expected line item status based on fulfillment type
 */
function getExpectedStatus(fulfillment: FulfillmentType): (typeof lineItemCompletionStatus.enumValues)[number][] {
  switch (fulfillment) {
    case "stock":
      return ["in_stock"];
    case "print":
      return ["printed"];
    case "black_label":
      return ["in_stock"];
  }
}

/**
 * Check if a status matches the expected statuses
 */
function isStatusMatch(
  current: (typeof lineItemCompletionStatus.enumValues)[number],
  expected: (typeof lineItemCompletionStatus.enumValues)[number][]
): boolean {
  if (current === "ignore") return true;
  return expected.includes(current);
}
