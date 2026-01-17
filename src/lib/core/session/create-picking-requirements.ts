import { SessionLineItem } from "@/lib/core/session/get-session-line-items";
import { garmentSize, garmentType } from "@drizzle/schema";
import z from "zod";

// Re-export for backwards compatibility
export type { SessionLineItem as AssemblyLineItem } from "@/lib/core/session/get-session-line-items";

type GarmentSize = (typeof garmentSize.enumValues)[number];
type GarmentType = (typeof garmentType.enumValues)[number];

/**
 * Schema for a single picking requirement (line-item level)
 * Used for settlement comparison later
 */
export const pickingRequirementSchema = z.object({
  lineItemId: z.string(),
  lineItemName: z.string(),
  orderId: z.string(),
  orderName: z.string(),
  /** How this item is expected to be fulfilled */
  expectedFulfillmentType: z.enum(["print", "stock", "black_label", "unaccounted"]),
  /** Blank variant ID - populated when expectedFulfillmentType is "print" */
  blankVariantId: z.string().nullable(),
  /** Product variant ID - populated when expectedFulfillmentType is "stock" */
  productVariantId: z.string().nullable(),
  /** Quantity ordered */
  quantity: z.number(),
  /** Display name snapshot (in case blank changes later) */
  blankDisplayName: z.string().nullable(),
  /** Variant display snapshot: "Black / L" */
  blankVariantDisplayName: z.string().nullable(),
  /** Product title snapshot */
  productDisplayName: z.string().nullable(),
  /** Product variant title snapshot */
  productVariantDisplayName: z.string().nullable(),
});

export type PickingRequirement = z.infer<typeof pickingRequirementSchema>;

export const pickingRequirementsSchema = z.array(pickingRequirementSchema);

export type PickingRequirements = z.infer<typeof pickingRequirementsSchema>;

/**
 * Aggregated blank picking item (for PDF display)
 * Groups by blank variant and sums quantities
 */
export interface AggregatedBlankItem {
  blankVariantId: string;
  blankName: string;
  color: string;
  garmentType: GarmentType;
  size: GarmentSize;
  quantity: number;
}

/**
 * Aggregated stock picking item (for PDF display)
 * Groups by product variant and sums quantities
 * Includes both overstock (pre-printed) and black label items
 */
export interface AggregatedStockItem {
  productVariantId: string;
  productName: string;
  variantTitle: string;
  isBlackLabel: boolean;
  quantity: number;
}

export interface PickingRequirementsResult {
  /** Line-item level requirements for settlement */
  requirements: PickingRequirement[];
  /** Aggregated blank list for PDF generation (items to print) */
  aggregatedBlankList: AggregatedBlankItem[];
  /** Aggregated stock list for PDF generation (overstock + black label) */
  aggregatedStockList: AggregatedStockItem[];
  /** Items that couldn't be categorized (no blank sync and no stock) */
  unaccountedLineItems: SessionLineItem[];
}

/**
 * Creates picking requirements from session line items
 * Returns both line-item level data (for settlement) and aggregated data (for PDF)
 */
export const createPickingRequirements = (lineItems: SessionLineItem[]): PickingRequirementsResult => {
  const requirements: PickingRequirement[] = [];
  const blankAggregatedMap = new Map<string, AggregatedBlankItem>();
  const stockAggregatedMap = new Map<string, AggregatedStockItem>();
  const unaccountedLineItems: SessionLineItem[] = [];

  const filteredLineItems = lineItems.filter((item) => item.requiresShipping);

  for (const item of filteredLineItems) {
    const product = item.product;
    const productVariant = item.productVariant;
    const blank = item.blank;
    const blankVariant = item.blankVariant;

    // Determine fulfillment type
    let expectedFulfillmentType: PickingRequirement["expectedFulfillmentType"];

    if (product?.isBlackLabel) {
      // Black label items are always picked from stock (pre-made by vendor)
      expectedFulfillmentType = "black_label";
    } else if (blank && blankVariant) {
      // Check if we have pre-printed stock (warehouse inventory on product variant)
      const hasStock = (productVariant?.warehouseInventory ?? 0) > 0;
      if (hasStock) {
        // We have overstock - pick from stock instead of printing
        expectedFulfillmentType = "stock";
      } else {
        // No stock - need to print, so pick a blank
        expectedFulfillmentType = "print";
      }
    } else {
      // No blank sync and not black label - unaccounted
      expectedFulfillmentType = "unaccounted";
      unaccountedLineItems.push(item);
    }

    // Create line-item level requirement
    const requirement: PickingRequirement = {
      lineItemId: item.id,
      lineItemName: item.name,
      orderId: item.orderId,
      orderName: item.order.name,
      expectedFulfillmentType,
      blankVariantId: blankVariant?.id ?? null,
      productVariantId: productVariant?.id ?? null,
      quantity: item.quantity,
      blankDisplayName: blank ? `${blank.blankCompany} ${blank.blankName}` : null,
      blankVariantDisplayName: blankVariant ? `${blankVariant.color} / ${blankVariant.size.toUpperCase()}` : null,
      productDisplayName: product?.title ?? null,
      productVariantDisplayName: productVariant?.title ?? null,
    };

    requirements.push(requirement);

    // Aggregate for PDF based on fulfillment type
    if (expectedFulfillmentType === "print" && blankVariant && blank) {
      // Aggregate blanks to pick
      const key = blankVariant.id;
      const existing = blankAggregatedMap.get(key);

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        blankAggregatedMap.set(key, {
          blankVariantId: blankVariant.id,
          blankName: `${abbreviateBlankName(blank.blankCompany)} ${blank.blankName}`,
          color: blankVariant.color,
          garmentType: blank.garmentType,
          size: blankVariant.size,
          quantity: item.quantity,
        });
      }
    } else if ((expectedFulfillmentType === "stock" || expectedFulfillmentType === "black_label") && productVariant) {
      // Aggregate stock items to pick (overstock + black label)
      const key = productVariant.id;
      const existing = stockAggregatedMap.get(key);

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        stockAggregatedMap.set(key, {
          productVariantId: productVariant.id,
          productName: product?.title ?? item.name,
          variantTitle: productVariant.title ?? "Default",
          isBlackLabel: expectedFulfillmentType === "black_label",
          quantity: item.quantity,
        });
      }
    }
  }

  // Sort aggregated blank list by color > garment > size
  const aggregatedBlankList = Array.from(blankAggregatedMap.values()).sort((a, b) => {
    const colorComparison = compareColor(a.color, b.color);
    if (colorComparison !== 0) return colorComparison;

    const garmentComparison = compareGarment(a.garmentType, b.garmentType);
    if (garmentComparison !== 0) return garmentComparison;

    return compareSize(a.size, b.size);
  });

  // Sort aggregated stock list: black label first, then alphabetically by product name
  const aggregatedStockList = Array.from(stockAggregatedMap.values()).sort((a, b) => {
    // Black label items first
    if (a.isBlackLabel !== b.isBlackLabel) {
      return a.isBlackLabel ? -1 : 1;
    }
    // Then alphabetically by product name
    return a.productName.localeCompare(b.productName);
  });

  return { requirements, aggregatedBlankList, aggregatedStockList, unaccountedLineItems };
};

const compareColor = (a?: string, b?: string): number => {
  const colorOrder = ["black", "white"];
  const aIndex = a ? colorOrder.indexOf(a.toLowerCase()) : -1;
  const bIndex = b ? colorOrder.indexOf(b.toLowerCase()) : -1;

  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;

  return (a || "").localeCompare(b || "");
};

const compareGarment = (a?: GarmentType, b?: GarmentType): number => {
  const garmentOrder: GarmentType[] = ["hoodie", "crewneck", "longsleeve", "tee"];
  const aIdx = a ? garmentOrder.indexOf(a) : -1;
  const bIdx = b ? garmentOrder.indexOf(b) : -1;
  return (aIdx === -1 ? garmentOrder.length : aIdx) - (bIdx === -1 ? garmentOrder.length : bIdx);
};

const compareSize = (a?: GarmentSize, b?: GarmentSize): number => {
  const sizeOrder: GarmentSize[] = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "os"];
  const aIdx = a ? sizeOrder.indexOf(a) : -1;
  const bIdx = b ? sizeOrder.indexOf(b) : -1;
  return (aIdx === -1 ? sizeOrder.length : aIdx) - (bIdx === -1 ? sizeOrder.length : bIdx);
};

const abbreviateBlankName = (name: string) => {
  if (name === "independant") return "ind";
  return name;
};
