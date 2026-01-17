import z from "zod";
import { type SessionLineItem } from "./get-session-line-items";
import { isLineItemValid, getLineItemMalformedReason } from "./is-lineitem-malformed";

export const premadeStockItemSchema = z.object({
  productVariantId: z.string(),
  productId: z.string(),
  productName: z.string(),
  productVariantTitle: z.string(),
  isBlackLabel: z.boolean(),
  requiredQuantity: z.number(),
  onHand: z.number(),
  toPick: z.number(),
});

export type PremadeStockItem = z.infer<typeof premadeStockItemSchema>;

export const premadeStockRequirementsSchema = z.object({
  items: z.array(premadeStockItemSchema),
  heldItems: z.array(
    z.object({
      lineItemName: z.string(),
      orderNumber: z.string(),
    })
  ),
  unaccountedItems: z.array(
    z.object({
      lineItemName: z.string(),
      orderNumber: z.string(),
      reason: z.string(),
    })
  ),
});

export type PremadeStockRequirements = z.infer<typeof premadeStockRequirementsSchema>;

export const getPremadeStockRequirements = (sessionLineItems: SessionLineItem[]): PremadeStockRequirements => {
  const stockMap = new Map<string, PremadeStockItem>();
  const heldItems: {
    lineItemName: string;
    orderNumber: string;
  }[] = [];
  const unaccountedItems: {
    lineItemName: string;
    orderNumber: string;
    reason: string;
  }[] = [];

  for (const lineItem of sessionLineItems.filter((item) => item.requiresShipping)) {
    if (lineItem.order.hasActiveHold) {
      heldItems.push({
        lineItemName: lineItem.name,
        orderNumber: lineItem.order.name,
      });
      continue;
    }

    // Type guard narrows lineItem to have non-null product & productVariant
    if (!isLineItemValid(lineItem)) {
      const reason = getLineItemMalformedReason(lineItem) ?? "unknown";
      unaccountedItems.push({
        lineItemName: lineItem.name,
        orderNumber: lineItem.order.name,
        reason,
      });
      continue;
    }

    // Only include items that COULD come from stock
    const hasStock = lineItem.productVariant?.warehouseInventory > 0;
    const isBlackLabel = lineItem.product?.isBlackLabel ?? false;

    if (!hasStock && !isBlackLabel) continue;

    // Aggregate by productVariantId
    const onHand = lineItem.productVariant.warehouseInventory;

    const existing = stockMap.get(lineItem.productVariant.id);

    if (existing) {
      existing.requiredQuantity += lineItem.quantity;
      // Black label: always pick requiredQuantity (Shopify tracks inventory)
      // Overstock: pick min of what we have vs what we need
      existing.toPick = isBlackLabel ? existing.requiredQuantity : Math.min(existing.onHand, existing.requiredQuantity);
    } else {
      const requiredQuantity = lineItem.quantity;
      stockMap.set(lineItem.productVariant.id, {
        productVariantId: lineItem.productVariant.id,
        productId: lineItem.product.id,
        productName: lineItem.product.title,
        productVariantTitle: lineItem.productVariant.title,
        isBlackLabel,
        requiredQuantity,
        onHand,
        toPick: isBlackLabel ? requiredQuantity : Math.min(onHand, requiredQuantity),
      });
    }
  }

  return {
    items: Array.from(stockMap.values()),
    heldItems,
    unaccountedItems,
  };
};
