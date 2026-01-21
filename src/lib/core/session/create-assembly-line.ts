import type { batches, garmentSize, garmentType, printLogs } from "@drizzle/schema";
import type { DataResponse } from "@/lib/types/misc";
import z from "zod";
import {
  type SessionLineItem,
  type SessionLineItemWithPrintLogs,
  getLineItemsByBatchId,
} from "./get-session-line-items";
import { isLineItemNotMalformed } from "./session.utils";
import {
  createPickingRequirements,
  type FulfillmentType,
  type PickingRequirement,
} from "./create-picking-requirements";
import type { PremadeStockItem } from "./get-premade-stock-requirements";

// Re-export types for backwards compatibility
export type AssemblyLineItem = SessionLineItem & {
  itemPosition: number;
  expectedFulfillment: FulfillmentType;
};
export type AssemblyLineItemWithPrintLogs = AssemblyLineItem & {
  printLogs: (typeof printLogs.$inferSelect)[];
};

const storedAssemblyLineSchema = z.object({
  id: z.string(),
  itemPosition: z.number(),
  expectedFulfillment: z.enum(["stock", "black_label", "print"]),
});

const GARMENT_TYPE_ORDER: (typeof garmentType.enumValues)[number][] = [
  "hoodie",
  "crewneck",
  "longsleeve",
  "tee",
  "shorts",
  "sweatpants",
  "headwear",
  "accessory",
  "jacket",
  "coat",
];

const LIGHT_COLORS_FALLBACK = [
  "white",
  "natural",
  "bone",
  "cream",
  "ivory",
  "light yellow",
  "banana",
  "yellow",
  "seafoam",
];

export const getAssemblyLine = async (
  batchId: number,
): Promise<
  DataResponse<{
    filteredLineItems: (SessionLineItem & { reason: string })[];
    lineItems: AssemblyLineItem[];
    batch: typeof batches.$inferSelect;
    removedItemIds: string[];
  }>
> => {
  const { data, error } = await getLineItemsByBatchId(batchId);

  if (error || !data) {
    return { data: null, error: error || "An unknown error occurred" };
  }

  const { lineItems, batch, filteredLineItems } = data;


  if (batch.assemblyLineJson) {
    try {
      const jsonData = JSON.parse(batch.assemblyLineJson);
      const parsed = storedAssemblyLineSchema.array().safeParse(jsonData);
      if (parsed.success) {
        const originalSortOrder = parsed.data;
        // Build a map for quick lookup of stored data
        const storedDataMap = new Map(
          originalSortOrder.map((item) => [item.id, item]),
        );

        // Build a set of current line item IDs for quick lookup
        const currentLineItemIds = new Set(lineItems.map((item) => item.id));

        // Find items that were in stored assembly line but no longer in batch
        // (e.g., removed due to hold resolution)
        const removedItemIds = Array.from(currentLineItemIds).filter((id) => !originalSortOrder.some((item) => item.id === id));



        // Only include items that were in the original assembly line
        const sortedLineItems = lineItems
          .filter((item) => storedDataMap.has(item.id))
          .toSorted((a, b) => {
            const aStored = storedDataMap.get(a.id)!;
            const bStored = storedDataMap.get(b.id)!;
            return aStored.itemPosition - bStored.itemPosition;
          })
          .map((item) => ({
            ...item,
            itemPosition: storedDataMap.get(item.id)!.itemPosition,
            expectedFulfillment: storedDataMap.get(item.id)!.expectedFulfillment,
          }));

        return {
          data: { lineItems: sortedLineItems, batch, filteredLineItems, removedItemIds },
          error: null,
        };
      }
    } catch {
      // Invalid JSON, fall through to fresh generation
    }
  }
  return { data: null, error: "No assembly line found" };
};

const getItemPretreat = (item: SessionLineItem): "light" | "dark" => {
  const isLightGarment = (item: SessionLineItem) => {
    const color = item.blankVariant?.color.toLowerCase() ?? "";
    return LIGHT_COLORS_FALLBACK.includes(color);
  };
  // Check for explicit pretreat on any print
  const explicitPretreat = item.prints.find(
    (p) => p.pretreat !== null,
  )?.pretreat;
  if (explicitPretreat) return explicitPretreat;

  // Fall back to color-based detection
  return isLightGarment(item) ? "light" : "dark";
};

const itemHasLargeHeatTransferPrint = (item: SessionLineItem) => {
  return item.prints.some(
    (p) => Boolean(p.heatTransferCode) && !Boolean(p.isSmallPrint),
  );
};

const itemHasSmallHeatTransferPrint = (item: SessionLineItem) => {
  return item.prints.some(
    (p) => Boolean(p.isSmallPrint) && Boolean(p.heatTransferCode),
  );
};

const getItemPrintCount = (item: SessionLineItem) => {
  return item.prints.length;
};

const getItemGarmentTypeIndex = (item: SessionLineItem) => {
  const type = item.blank?.garmentType;
  if (!type) return GARMENT_TYPE_ORDER.length;
  const index = GARMENT_TYPE_ORDER.indexOf(type);
  return index === -1 ? GARMENT_TYPE_ORDER.length : index;
};

const getOrderLineItemCount = (order: SessionLineItem["order"]) => {
  return order.lineItems.length;
};

const orderHasAllDarkPretreat = (
  order: SessionLineItem["order"],
  allLineItems: SessionLineItem[],
): boolean => {
  const orderLineItems = allLineItems.filter(
    (item) => item.order.id === order.id,
  );
  if (orderLineItems.length === 0) return false;
  return orderLineItems.every((item) => getItemPretreat(item) === "dark");
};

/**
 * Creates a sorted assembly line using intelligent fulfillment assignment.
 * Items that will be fulfilled from stock come first (they complete faster).
 */
export const createSortedAssemblyLine = async (
  batchId: number,
  sessionLineItems?: SessionLineItem[],
  premadeStockItems?: PremadeStockItem[],
): Promise<
  DataResponse<{
    assemblyLine: AssemblyLineItem[];
    pickingRequirements: PickingRequirement[];
  }>
> => {
  let lineItems: SessionLineItem[] = [];
  if (sessionLineItems) {
    lineItems = sessionLineItems;
  } else {
    const { data, error } = await getLineItemsByBatchId(batchId);
    if (!data) {
      return { data: null, error: error || "An unknown error occurred" };
    }
    lineItems = data.lineItems;
  }

  // Get fulfillment assignments from picking requirements
  const pickingRequirements = createPickingRequirements(
    lineItems,
    premadeStockItems ?? [],
  );
  const { fulfillmentMap } = pickingRequirements;

  // Fulfillment type priority: stock first (no printing needed), then black_label, then print
  const fulfillmentOrder: Record<FulfillmentType, number> = {
    stock: 0,
    black_label: 1,
    print: 2,
  };

  const sortedLineItems = lineItems.toSorted((a, b) => {
    // 1. Valid items first
    const aValid = isLineItemNotMalformed(a);
    const bValid = isLineItemNotMalformed(b);
    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;

    // 2. Fulfillment type priority (stock items first - they complete fastest)
    const aType = fulfillmentMap[a.id] ?? "print";
    const bType = fulfillmentMap[b.id] ?? "print";
    if (fulfillmentOrder[aType] !== fulfillmentOrder[bType]) {
      return fulfillmentOrder[aType] - fulfillmentOrder[bType];
    }

    // 3. Orders where all items are dark pretreat (can complete together)
    const aAllDark = orderHasAllDarkPretreat(a.order, lineItems);
    const bAllDark = orderHasAllDarkPretreat(b.order, lineItems);
    if (aAllDark && !bAllDark) return -1;
    if (!aAllDark && bAllDark) return 1;

    // 4. Small heat transfer prints go to bottom
    const aSmallHT = itemHasSmallHeatTransferPrint(a);
    const bSmallHT = itemHasSmallHeatTransferPrint(b);
    if (aSmallHT && !bSmallHT) return 1;
    if (!aSmallHT && bSmallHT) return -1;

    // 5. Dark pretreat first
    const aPretreat = getItemPretreat(a);
    const bPretreat = getItemPretreat(b);
    if (aPretreat === "dark" && bPretreat === "light") return -1;
    if (aPretreat === "light" && bPretreat === "dark") return 1;

    // 6. Large heat transfer prints first
    const aLargeHT = itemHasLargeHeatTransferPrint(a);
    const bLargeHT = itemHasLargeHeatTransferPrint(b);
    if (aLargeHT && !bLargeHT) return -1;
    if (!aLargeHT && bLargeHT) return 1;

    // 7. Small orders first
    const aOrderSize = getOrderLineItemCount(a.order);
    const bOrderSize = getOrderLineItemCount(b.order);
    if (aOrderSize < bOrderSize) return -1;
    if (aOrderSize > bOrderSize) return 1;

    // 8. Fewer prints first
    const aPrintCount = getItemPrintCount(a);
    const bPrintCount = getItemPrintCount(b);
    if (aPrintCount < bPrintCount) return -1;
    if (aPrintCount > bPrintCount) return 1;

    // 9. Garment type order
    const garmentDiff = getItemGarmentTypeIndex(a) - getItemGarmentTypeIndex(b);
    if (garmentDiff !== 0) return garmentDiff;

    // 10. Alphabetical fallback
    return a.name.localeCompare(b.name);
  });

  const assemblyLine = sortedLineItems
    .filter((item) => item.requiresShipping)
    .map((item, index) => ({
      ...item,
      itemPosition: index,
      expectedFulfillment: fulfillmentMap[item.id] ?? "print",
    }));

  return { data: { assemblyLine, pickingRequirements: pickingRequirements.requirements }, error: null };
};
