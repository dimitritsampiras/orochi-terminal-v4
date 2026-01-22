import { batches, garmentSize, garmentType } from "@drizzle/schema";
import { DataResponse } from "@/lib/types/misc";
import z from "zod";
import {
  SessionLineItem,
  SessionLineItemWithPrintLogs,
  OrderWithLineItems,
  getLineItemsByBatchId,
  getLineItemById,
} from "./get-session-line-items";

// Re-export types for backwards compatibility
export type AssemblyLineItem = SessionLineItem;
export type AssemblyLineItemWithPrintLogs = SessionLineItemWithPrintLogs;
export type { OrderWithLineItems };
export { getLineItemById, getLineItemsByBatchId };

const storedAssemblyLineSchema = z.object({
  id: z.string(),
  itemPosition: z.number(),
});

// Ordering constants for sorting
const SIZE_ORDER: (typeof garmentSize.enumValues)[number][] = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "os",
];
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

export type SortedAssemblyLineItem = AssemblyLineItem & {
  itemPosition: number;
};

export const getAssemblyLine = async (
  batchId: number
): Promise<DataResponse<{ lineItems: SortedAssemblyLineItem[]; batch: typeof batches.$inferSelect }>> => {
  const { data, error } = await getLineItemsByBatchId(batchId);

  if (error || !data) {
    return { data: null, error: error || "An unknown error occurred" };
  }

  const { lineItems, batch } = data;

  if (batch.assemblyLineJson) {
    try {
      const jsonData = JSON.parse(batch.assemblyLineJson);
      const parsed = storedAssemblyLineSchema.array().safeParse(jsonData);
      if (parsed.success) {
        const originalSortOrder = parsed.data;
        const sortedLineItems = lineItems
          .toSorted((a, b) => {
            const aIndex = originalSortOrder.findIndex((item) => item.id === a.id);
            const bIndex = originalSortOrder.findIndex((item) => item.id === b.id);
            // Items not in the stored order go to the end
            return (aIndex === -1 ? Infinity : aIndex) - (bIndex === -1 ? Infinity : bIndex);
          })
          .map((item, index) => ({ ...item, itemPosition: index }))
          .filter((item) => item.requiresShipping);

        return { data: { lineItems: sortedLineItems, batch }, error: null };
      }
    } catch {
      // Invalid JSON, fall through to fresh generation
    }
  }

  // Fall back to generating fresh sorted assembly line
  const { data: sortedData, error: sortError } = await createSortedAssemblyLine(batchId);
  if (!sortedData) {
    return { data: null, error: sortError || "Failed to generate assembly line" };
  }
  return { data: { lineItems: sortedData, batch }, error: null };
};

export const createSortedAssemblyLine = async (
  batchId: number,
  assemblyLineItems?: AssemblyLineItem[]
): Promise<DataResponse<SortedAssemblyLineItem[]>> => {
  let lineItems: AssemblyLineItem[] = [];
  if (assemblyLineItems) {
    lineItems = assemblyLineItems;
  } else {
    const { data, error } = await getLineItemsByBatchId(batchId);
    if (!data) {
      return { data: null, error: error || "An unknown error occurred" };
    }
    lineItems = data.lineItems;
  }

  const sortedLineItems = lineItems.toSorted((a, b) => {
    /**
     * 1. check sync status
     * check item sync status with products & product variants
     * sycned first then unsynced (unsycned at way bottom)
     */
    const aProductSynced = itemHasSyncedProducts(a);
    const bProductSynced = itemHasSyncedProducts(b);

    if (aProductSynced && !bProductSynced) {
      return -1;
    } else if (!aProductSynced && bProductSynced) {
      return 1;
    }

    /**
     * 2. check blank sync status
     * check item sync status with blanks & blank variants
     */
    const aBlankSynced = itemHasSyncedBlank(a);
    const bBlankSynced = itemHasSyncedBlank(b);

    if (aBlankSynced && !bBlankSynced) {
      return -1;
    } else if (!aBlankSynced && bBlankSynced) {
      return 1;
    }

    /**
     * 3. items with small heat transfer prints go at bottom
     */
    const aSmallHeatTransferPrint = itemHasSmallHeatTransferPrint(a);
    const bSmallHeatTransferPrint = itemHasSmallHeatTransferPrint(b);

    if (aSmallHeatTransferPrint && !bSmallHeatTransferPrint) {
      return 1;
    } else if (!aSmallHeatTransferPrint && bSmallHeatTransferPrint) {
      return -1;
    }

    /**
     * 4. Dark pretreat first, then light (all items default to light)
     */
    const aPretreat = getItemPretreat(a);
    const bPretreat = getItemPretreat(b);

    if (aPretreat === "dark" && bPretreat === "light") {
      return -1;
    } else if (aPretreat === "light" && bPretreat === "dark") {
      return 1;
    }

    /**
     * 5.items with large heat transfer print come first
     */
    const aLargeHeatTransferPrint = itemHasLargeHeatTransferPrint(a);
    const bLargeHeatTransferPrint = itemHasLargeHeatTransferPrint(b);

    if (aLargeHeatTransferPrint && !bLargeHeatTransferPrint) {
      return -1;
    } else if (!aLargeHeatTransferPrint && bLargeHeatTransferPrint) {
      return 1;
    }

    /**
     * 6. items whose orders are small (low line item count) come first
     */
    const aOrderLineItemCount = getOrderLineItemCount(a.order);
    const bOrderLineItemCount = getOrderLineItemCount(b.order);

    if (aOrderLineItemCount < bOrderLineItemCount) {
      return -1;
    } else if (aOrderLineItemCount > bOrderLineItemCount) {
      return 1;
    }

    /**
     * 7. items who have more prints come first
     */
    const aPrintCount = getItemPrintCount(a);
    const bPrintCount = getItemPrintCount(b);

    if (aPrintCount < bPrintCount) {
      return 1;
    } else if (aPrintCount > bPrintCount) {
      return -1;
    }

    /**
     * 8. sort by garment type (hoodie > crewneck > longsleeve > tee > ...)
     */
    const garmentTypeDiff = getItemGarmentTypeIndex(a) - getItemGarmentTypeIndex(b);
    if (garmentTypeDiff !== 0) return garmentTypeDiff;

    /**
     * 9. sort by size (xs > sm > md > lg > xl > 2xl > ...)
     */
    const sizeDiff = getItemSizeIndex(a) - getItemSizeIndex(b);
    if (sizeDiff !== 0) return sizeDiff;

    /**
     * 10. sort by color
     */
    const aBlankColor = getItemBlankColor(a);
    const bBlankColor = getItemBlankColor(b);
    if (aBlankColor.localeCompare(bBlankColor) < 0) {
      return -1;
    } else if (aBlankColor.localeCompare(bBlankColor) > 0) {
      return 1;
    }

    return a.name.localeCompare(b.name);
  });

  const sortedLineLineItemsWithIndex = sortedLineItems
    .map((item, index) => ({ ...item, itemPosition: index }))
    .filter((item) => item.requiresShipping);

  return { data: sortedLineLineItemsWithIndex, error: null };
};

// returns true if the item has a synced product and product variant
const itemHasSyncedProducts = (item: AssemblyLineItem) => {
  return Boolean(item.product && item.productVariant);
};

// returns true if the item has a synced blank and blank variant
const itemHasSyncedBlank = (item: AssemblyLineItem) => {
  return Boolean(item.blank && item.blankVariant);
};

// Returns "light" or "dark" based on print pretreat or garment color fallback

const getItemPretreat = (item: AssemblyLineItem): "light" | "dark" => {
  const isLightGarment = (item: AssemblyLineItem) => {
    const color = item.blankVariant?.color.toLowerCase() ?? "";
    return LIGHT_COLORS_FALLBACK.includes(color);
  };
  // Check for explicit pretreat on any print
  const explicitPretreat = item.prints.find((p) => p.pretreat !== null)?.pretreat;
  if (explicitPretreat) return explicitPretreat;

  // Fall back to color-based detection
  return isLightGarment(item) ? "light" : "dark";
};

const itemHasLargeHeatTransferPrint = (item: AssemblyLineItem) => {
  return item.prints.some((p) => Boolean(p.heatTransferCode) && !Boolean(p.isSmallPrint));
};

const itemHasSmallHeatTransferPrint = (item: AssemblyLineItem) => {
  return item.prints.some((p) => Boolean(p.isSmallPrint) && Boolean(p.heatTransferCode));
};

const getItemPrintCount = (item: AssemblyLineItem) => {
  return item.prints.length;
};

const getItemGarmentTypeIndex = (item: AssemblyLineItem) => {
  const type = item.blank?.garmentType;
  if (!type) return GARMENT_TYPE_ORDER.length;
  const index = GARMENT_TYPE_ORDER.indexOf(type);
  return index === -1 ? GARMENT_TYPE_ORDER.length : index;
};

const getItemSizeIndex = (item: AssemblyLineItem) => {
  const size = item.blankVariant?.size;
  if (!size) return SIZE_ORDER.length;
  const index = SIZE_ORDER.indexOf(size);
  return index === -1 ? SIZE_ORDER.length : index;
};

const getItemBlankColor = (item: AssemblyLineItem) => {
  return item.blankVariant?.color.toLowerCase() ?? "";
};

const getOrderLineItemCount = (order: AssemblyLineItem["order"]) => {
  return order.lineItems.length;
};
