import type { displayFulfillmentStatus, lineItems, orders } from "@drizzle/schema";
import type { SessionLineItem } from "./get-session-line-items";

/** A SessionLineItem with guaranteed non-null product and productVariant */
export type ValidSessionLineItem = SessionLineItem & {
  product: NonNullable<SessionLineItem["product"]>;
  productVariant: NonNullable<SessionLineItem["productVariant"]>;
};

/**
 * Type guard that checks if a line item is valid (not malformed).
 * When this returns true, TypeScript knows product and productVariant are non-null.
 */
export const isLineItemNotMalformed = (item: SessionLineItem): item is ValidSessionLineItem => {
  if (!item.product || !item.productVariant) return false;
  if (!item.product.isBlackLabel && !item.product.blankId && !item.productVariant.blankVariantId) return false;
  return true;
};

/**
 * Returns malformed status with reason. Use `isLineItemNotMalformed` for type narrowing.
 */
export const getLineItemMalformedReason = (item: SessionLineItem): string | null => {
  if (!item.product || !item.productVariant) return "missing product";
  if (!item.product.isBlackLabel && !item.product.blankId && !item.productVariant.blankVariantId)
    return "missing blank";
  return null;
};

export const orderReadyForFulfillment = (order: typeof orders.$inferSelect) => {
  if (order.displayIsCancelled) {
    return false;
  }
  const nonFulfillableStatuses = [
    "FULFILLED",
    "ON_HOLD",
    "REQUEST_DECLINED",
  ] as (typeof displayFulfillmentStatus.enumValues)[number][];

  if (nonFulfillableStatuses.includes(order.displayFulfillmentStatus)) {
    return false;
  }
  return true;
};

export const lineItemReadyForFulfillment = (lineItem: typeof lineItems.$inferSelect) => {
  return lineItem.unfulfilledQuantity > 0 && lineItem.requiresShipping;
};
