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

    // After the type guard, product and productVariant are guaranteed non-null
    // Aggregate by productVariantId for inventory verification
    const existing = stockMap.get(lineItem.productVariant.id);
    if (existing) {
      existing.requiredQuantity += lineItem.quantity;
    } else {
      stockMap.set(lineItem.productVariant.id, {
        productVariantId: lineItem.productVariant.id,
        productId: lineItem.product.id,
        productName: lineItem.product.title,
        productVariantTitle: lineItem.productVariant.title,
        isBlackLabel: lineItem.product.isBlackLabel,
        requiredQuantity: lineItem.quantity,
      });
    }
  }

  return {
    items: Array.from(stockMap.values()),
    heldItems,
    unaccountedItems,
  };
};
