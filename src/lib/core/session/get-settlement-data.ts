import { db } from "@/lib/clients/db";
import { DataResponse } from "@/lib/types/misc";
import { pickingRequirementSchema, type FulfillmentType } from "./create-picking-requirements";
import { inventoryTransactions, lineItemCompletionStatus } from "@drizzle/schema";
import z from "zod";

const storedAssemblyLineSchema = z.object({
  id: z.string(),
  itemPosition: z.number(),
  expectedFulfillment: z.enum(["stock", "black_label", "print"]),
});

export type SettlementItem = {
  // Line item info
  lineItemId: string;
  lineItemName: string;
  orderName: string;
  position: number;
  currentStatus: (typeof lineItemCompletionStatus.enumValues)[number];

  // Expected fulfillment (from stored JSON)
  expectedFulfillment: FulfillmentType;

  // Inventory target (null for black_label)
  inventoryTarget: {
    type: "blank" | "product";
    id: string;
    displayName: string;
    expectedChange: number;
  } | null;

  // Transactions for this item
  transactions: (typeof inventoryTransactions.$inferSelect)[];
  actualInventoryChange: number;

  // Computed flags
  hasStatusMismatch: boolean;
  hasInventoryMismatch: boolean;
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
    },
  });
  const lineItemMap = new Map(lineItems.map((li) => [li.id, li]));

  // Fetch all inventory transactions for this batch
  const transactions = await db.query.inventoryTransactions.findMany({
    where: { batchId },
  });
  const transactionsByLineItem = new Map<string, (typeof inventoryTransactions.$inferSelect)[]>();
  for (const tx of transactions) {
    if (!tx.lineItemId) continue;
    const existing = transactionsByLineItem.get(tx.lineItemId) ?? [];
    existing.push(tx);
    transactionsByLineItem.set(tx.lineItemId, existing);
  }

  // Build settlement items
  const items: SettlementItem[] = [];

  for (const assemblyItem of assemblyLine) {
    const lineItem = lineItemMap.get(assemblyItem.id);
    const picking = pickingMap.get(assemblyItem.id);
    const itemTransactions = transactionsByLineItem.get(assemblyItem.id) ?? [];

    if (!lineItem || !picking) continue;

    // Determine inventory target based on expected fulfillment
    let inventoryTarget: SettlementItem["inventoryTarget"] = null;
    if (assemblyItem.expectedFulfillment === "stock" && picking.productVariantId) {
      inventoryTarget = {
        type: "product",
        id: picking.productVariantId,
        displayName: picking.productDisplayName ?? "Unknown Product",
        expectedChange: -picking.quantity,
      };
    } else if (assemblyItem.expectedFulfillment === "print" && picking.blankVariantId) {
      inventoryTarget = {
        type: "blank",
        id: picking.blankVariantId,
        displayName: picking.blankDisplayName ?? "Unknown Blank",
        expectedChange: -picking.quantity,
      };
    }

    // Calculate actual inventory change from transactions
    const actualInventoryChange = itemTransactions.reduce((sum, tx) => sum + tx.changeAmount, 0);

    // Determine mismatches
    const expectedStatus = getExpectedStatus(assemblyItem.expectedFulfillment);
    const hasStatusMismatch = !isStatusMatch(lineItem.completionStatus, expectedStatus);
    const hasInventoryMismatch =
      inventoryTarget !== null && actualInventoryChange !== inventoryTarget.expectedChange;

    items.push({
      lineItemId: assemblyItem.id,
      lineItemName: lineItem.name,
      orderName: lineItem.order?.name ?? "Unknown Order",
      position: assemblyItem.itemPosition,
      currentStatus: lineItem.completionStatus,
      expectedFulfillment: assemblyItem.expectedFulfillment,
      inventoryTarget,
      transactions: itemTransactions,
      actualInventoryChange,
      hasStatusMismatch,
      hasInventoryMismatch,
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
  return expected.includes(current);
}
