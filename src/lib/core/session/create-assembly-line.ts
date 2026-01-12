import { db } from "@/lib/clients/db";
import { eq } from "drizzle-orm";
import {
  lineItems,
  orders,
  ordersBatches,
  batches,
  products,
  prints,
  blanks,
  productVariants,
  blankVariants,
  garmentSize,
  garmentType,
  printLogs,
} from "../../../../drizzle/schema";
import { DataResponse } from "@/lib/types/misc";
import z from "zod";
import { logger } from "../logger";

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

export type OrderWithLineItems = typeof orders.$inferSelect & {
  lineItems: Pick<typeof lineItems.$inferSelect, "id" | "name" | "completionStatus">[];
};

export type AssemblyLineItem = typeof lineItems.$inferSelect & {
  order: OrderWithLineItems;
  product: typeof products.$inferSelect | null;
  prints: (typeof prints.$inferSelect)[];
  blank: typeof blanks.$inferSelect | null;
  productVariant: typeof productVariants.$inferSelect | null;
  blankVariant: typeof blankVariants.$inferSelect | null;
};

export type AssemblyLineItemWithPrintLogs = AssemblyLineItem & {
  printLogs: (typeof printLogs.$inferSelect)[];
};

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
      } else {
        // logger.error(`Wrong format for assembly line JSON for batch ${batchId}`, {
        //   category: "ASSEMBLY",
        // });
      }
    } catch {
      // logger.error(`Invalid assembly line JSON for batch ${batchId}`, {
      //   category: "ASSEMBLY",
      // });
    }
  }

  // Fall back to generating fresh sorted assembly line
  const { data: sortedData, error: sortError } = await createSortedAssemblyLine(batchId);
  if (!sortedData) {
    return { data: null, error: sortError || "Failed to generate assembly line" };
  }
  return { data: { lineItems: sortedData, batch }, error: null };
};

/**
 * Get all line items for a batch with their related data
 * Uses a single query with JOINs: lineItems -> orders -> ordersBatches -> batches
 */
export const getLineItemsByBatchId = async (
  batchId: number
): Promise<DataResponse<{ lineItems: AssemblyLineItem[]; batch: typeof batches.$inferSelect }>> => {
  try {
    const results = await db
      .select({
        lineItem: lineItems,
        order: orders,
        product: products,
        print: prints,
        blank: blanks,
        productVariant: productVariants,
        blankVariant: blankVariants,
      })
      .from(lineItems)
      .innerJoin(orders, eq(lineItems.orderId, orders.id))
      .innerJoin(ordersBatches, eq(orders.id, ordersBatches.orderId))
      .where(eq(ordersBatches.batchId, batchId))
      .leftJoin(products, eq(lineItems.productId, products.id))
      .leftJoin(prints, eq(products.id, prints.productId))
      .leftJoin(blanks, eq(products.blankId, blanks.id))
      .leftJoin(productVariants, eq(lineItems.variantId, productVariants.id))
      .leftJoin(blankVariants, eq(productVariants.blankVariantId, blankVariants.id));

    // Get batch metadata
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);

    if (!batch) {
      throw new Error(`Batch with id ${batchId} not found`);
    }

    // Group results by line item and aggregate prints, also track line items per order
    const lineItemMap = new Map<string, AssemblyLineItem>();
    const orderLineItemsMap = new Map<
      string,
      Pick<typeof lineItems.$inferSelect, "id" | "name" | "completionStatus">[]
    >();

    // First pass: collect all line items per order
    for (const row of results) {
      const orderId = row.order.id;
      if (!orderLineItemsMap.has(orderId)) {
        orderLineItemsMap.set(orderId, []);
      }
      const orderLineItems = orderLineItemsMap.get(orderId)!;
      if (!orderLineItems.some((li) => li.id === row.lineItem.id)) {
        orderLineItems.push({
          id: row.lineItem.id,
          name: row.lineItem.name,
          completionStatus: row.lineItem.completionStatus,
        });
      }
    }

    // Second pass: build line items with order including its line items
    for (const row of results) {
      const existing = lineItemMap.get(row.lineItem.id);

      if (existing) {
        // Add print to existing line item if it exists and isn't already added
        if (row.print && !existing.prints.some((p) => p.id === row.print?.id)) {
          existing.prints.push(row.print);
        }
      } else {
        lineItemMap.set(row.lineItem.id, {
          ...row.lineItem,
          order: {
            ...row.order,
            lineItems: orderLineItemsMap.get(row.order.id) ?? [],
          },
          product: row.product,
          prints: row.print ? [row.print] : [],
          blank: row.blank,
          productVariant: row.productVariant,
          blankVariant: row.blankVariant,
        });
      }
    }

    return {
      data: {
        lineItems: Array.from(lineItemMap.values()),
        batch: {
          id: batch.id,
          createdAt: batch.createdAt,
          active: batch.active,
          assemblyLineJson: batch.assemblyLineJson,
          pickingListJson: null,
        },
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
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

// Add to src/lib/core/session/generate-assembly-list.ts

/**
 * Get a single line item by ID with all related data
 * Returns the same structure as AssemblyLineItem
 */
export const getLineItemById = async (lineItemId: string): Promise<DataResponse<AssemblyLineItemWithPrintLogs>> => {
  try {
    const results = await db
      .select({
        lineItem: lineItems,
        order: orders,
        product: products,
        print: prints,
        printLog: printLogs, // Add
        blank: blanks,
        productVariant: productVariants,
        blankVariant: blankVariants,
      })
      .from(lineItems)
      .innerJoin(orders, eq(lineItems.orderId, orders.id))
      .leftJoin(products, eq(lineItems.productId, products.id))
      .leftJoin(prints, eq(products.id, prints.productId))
      .leftJoin(printLogs, eq(lineItems.id, printLogs.lineItemId)) // Add
      .leftJoin(blanks, eq(products.blankId, blanks.id))
      .leftJoin(productVariants, eq(lineItems.variantId, productVariants.id))
      .leftJoin(blankVariants, eq(productVariants.blankVariantId, blankVariants.id))
      .where(eq(lineItems.id, lineItemId));

    if (results.length === 0) {
      return { data: null, error: `Line item with id ${lineItemId} not found` };
    }

    // Get all line items for the order (for the order.lineItems count)
    const orderLineItems = await db
      .select({ id: lineItems.id, name: lineItems.name, completionStatus: lineItems.completionStatus })
      .from(lineItems)
      .where(eq(lineItems.orderId, results[0].order.id));

    // Aggregate prints from multiple rows (due to prints LEFT JOIN)
    const printsArray: (typeof prints.$inferSelect)[] = [];
    for (const row of results) {
      if (row.print && !printsArray.some((p) => p.id === row.print?.id)) {
        printsArray.push(row.print);
      }
    }

    // And aggregate:
    const printLogsArray: (typeof printLogs.$inferSelect)[] = [];
    for (const row of results) {
      if (row.printLog && !printLogsArray.some((pl) => pl.id === row.printLog?.id)) {
        printLogsArray.push(row.printLog);
      }
    }

    const firstRow = results[0];
    const assemblyLineItem: AssemblyLineItemWithPrintLogs = {
      ...firstRow.lineItem,
      order: {
        ...firstRow.order,
        lineItems: orderLineItems,
      },
      product: firstRow.product,
      prints: printsArray,
      printLogs: printLogsArray,
      blank: firstRow.blank,
      productVariant: firstRow.productVariant,
      blankVariant: firstRow.blankVariant,
    };

    return { data: assemblyLineItem, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
};
