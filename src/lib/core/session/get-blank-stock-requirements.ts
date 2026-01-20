import z from "zod";
import type { SessionLineItem } from "./get-session-line-items";
import { isLineItemNotMalformed, getLineItemMalformedReason } from "./session.utils";
import { garmentSize, garmentType } from "@drizzle/schema";
import type { PremadeStockItem } from "./get-premade-stock-requirements";

export const blankStockItemSchema = z.object({
	blankVariantId: z.string(),
	blankId: z.string(),
	blankName: z.string(),
	blankCompany: z.string(),
	color: z.string(),
	size: z.enum(garmentSize.enumValues),
	garmentType: z.enum(garmentType.enumValues),
	requiredQuantity: z.number(),
	onHand: z.number(),
	toPick: z.number(),
});

export type BlankStockItem = z.infer<typeof blankStockItemSchema>;

export const blankStockRequirementsSchema = z.object({
	items: z.array(blankStockItemSchema),
	malformedItems: z.array(
		z.object({
			lineItemName: z.string(),
			orderNumber: z.string(),
			reason: z.string(),
		}),
	),
});

export type BlankStockRequirements = z.infer<
	typeof blankStockRequirementsSchema
>;

/**
 * Get blank stock requirements for items that need to be PRINTED.
 * Uses premadeStockItems.toPick to know how many are fulfilled from stock.
 */
export const getBlankStockRequirements = (
	sessionLineItems: SessionLineItem[],
	premadeStockItems: PremadeStockItem[],
): BlankStockRequirements => {
	// Map: productVariantId → how many will be fulfilled from stock
	const stockAvailable = new Map<string, number>();
	for (const item of premadeStockItems) {
		stockAvailable.set(item.productVariantId, item.toPick);
	}

	// Track how much stock we've allocated per variant
	const stockAllocated = new Map<string, number>();

	const blankMap = new Map<string, BlankStockItem>();

	const malformedItems: {
		lineItemName: string;
		orderNumber: string;
		reason: string;
	}[] = [];

	for (const lineItem of sessionLineItems.filter(
		(item) => item.requiresShipping,
	)) {
		if (!isLineItemNotMalformed(lineItem)) {
			const reason = getLineItemMalformedReason(lineItem) ?? "unknown";
			malformedItems.push({
				lineItemName: lineItem.name,
				orderNumber: lineItem.order.name,
				reason,
			});
			continue;
		}

		// Black label items don't need blanks
		if (lineItem.product.isBlackLabel) {
			continue;
		}

		// Calculate how many of this line item need blanks vs stock
		const available = stockAvailable.get(lineItem.productVariant.id) ?? 0;
		const allocated = stockAllocated.get(lineItem.productVariant.id) ?? 0;
		const remaining = available - allocated;

		const fromStock = Math.min(lineItem.quantity, remaining);
		const needsBlanks = lineItem.quantity - fromStock;

		// Update allocation
		stockAllocated.set(lineItem.productVariant.id, allocated + fromStock);

		// If fully covered by stock, no blank needed
		if (needsBlanks <= 0) {
			continue;
		}

		// Need a blank - validate blank data exists
		if (!lineItem.blank || !lineItem.blankVariant) {
			malformedItems.push({
				lineItemName: lineItem.name,
				orderNumber: lineItem.order.name,
				reason: "missing blank data",
			});
			continue;
		}

		// Aggregate by blankVariantId
		const onHand = lineItem.blankVariant.quantity;
		const existing = blankMap.get(lineItem.blankVariant.id);

		if (existing) {
			existing.requiredQuantity += needsBlanks;
			existing.toPick = Math.min(existing.onHand, existing.requiredQuantity);
		} else {
			blankMap.set(lineItem.blankVariant.id, {
				blankVariantId: lineItem.blankVariant.id,
				blankId: lineItem.blank.id,
				blankName: lineItem.blank.blankName,
				blankCompany: lineItem.blank.blankCompany,
				color: lineItem.blankVariant.color,
				size: lineItem.blankVariant.size,
				garmentType: lineItem.blank.garmentType,
				requiredQuantity: needsBlanks,
				onHand,
				toPick: Math.min(onHand, needsBlanks),
			});
		}
	}

	return {
		items: Array.from(blankMap.values()),
		malformedItems,
	};
};
