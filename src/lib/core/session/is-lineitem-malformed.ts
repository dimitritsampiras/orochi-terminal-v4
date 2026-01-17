import { SessionLineItem } from "./get-session-line-items";

/** A SessionLineItem with guaranteed non-null product and productVariant */
export type ValidSessionLineItem = SessionLineItem & {
  product: NonNullable<SessionLineItem["product"]>;
  productVariant: NonNullable<SessionLineItem["productVariant"]>;
};

/**
 * Type guard that checks if a line item is valid (not malformed).
 * When this returns true, TypeScript knows product and productVariant are non-null.
 */
export function isLineItemValid(item: SessionLineItem): item is ValidSessionLineItem {
  if (!item.product || !item.productVariant) return false;
  if (!item.product.isBlackLabel && !item.product.blankId && !item.productVariant.blankVariantId) return false;
  return true;
}

/**
 * Returns malformed status with reason. Use `isLineItemValid` for type narrowing.
 */
export const getLineItemMalformedReason = (item: SessionLineItem): string | null => {
  if (!item.product || !item.productVariant) return "missing product";
  if (!item.product.isBlackLabel && !item.product.blankId && !item.productVariant.blankVariantId) return "missing blank";
  return null;
};
