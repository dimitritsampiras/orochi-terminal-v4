import z from "zod";
import { garmentSize, garmentType } from "@drizzle/schema";
import type { SessionLineItem } from "./get-session-line-items";
import type { PremadeStockItem } from "./get-premade-stock-requirements";
import { isLineItemNotMalformed } from "./session.utils";

export type FulfillmentType = "stock" | "black_label" | "print";

export const pickingRequirementSchema = z.object({
	lineItemId: z.string(),
	lineItemName: z.string(),
	orderId: z.string(),
	orderName: z.string(),
	expectedFulfillmentType: z.enum(["print", "stock", "black_label"]),
	blankVariantId: z.string().nullable(),
	productVariantId: z.string().nullable(),
	quantity: z.number(),
	blankDisplayName: z.string().nullable(),
	blankVariantSize: z.enum(garmentSize.enumValues).nullable(),
	blankGarmentType: z.enum(garmentType.enumValues).nullable(),
	blankGarmentColor: z.string().nullable(),
	productDisplayName: z.string().nullable(),
	productVariantDisplayName: z.string().nullable(),
});

export type PickingRequirement = z.infer<typeof pickingRequirementSchema>;

export const pickingRequirementsResultSchema = z.object({
	requirements: z.array(pickingRequirementSchema),
	fulfillmentMap: z.record(
		z.string(),
		z.enum(["stock", "black_label", "print"]),
	),
});

export type PickingRequirementsResult = z.infer<
	typeof pickingRequirementsResultSchema
>;

// Ordering constants (same as assembly line)
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

const LIGHT_COLORS = [
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

const getItemPretreat = (item: SessionLineItem): "light" | "dark" => {
	const explicitPretreat = item.prints.find(
		(p) => p.pretreat !== null,
	)?.pretreat;
	if (explicitPretreat) return explicitPretreat;
	const color = item.blankVariant?.color.toLowerCase() ?? "";
	return LIGHT_COLORS.includes(color) ? "light" : "dark";
};

const itemHasSmallHeatTransferPrint = (item: SessionLineItem) =>
	item.prints.some(
		(p) => Boolean(p.isSmallPrint) && Boolean(p.heatTransferCode),
	);

const itemHasLargeHeatTransferPrint = (item: SessionLineItem) =>
	item.prints.some(
		(p) => Boolean(p.heatTransferCode) && !Boolean(p.isSmallPrint),
	);

const getItemGarmentTypeIndex = (item: SessionLineItem) => {
	const type = item.blank?.garmentType;
	if (!type) return GARMENT_TYPE_ORDER.length;
	const index = GARMENT_TYPE_ORDER.indexOf(type);
	return index === -1 ? GARMENT_TYPE_ORDER.length : index;
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
 * Pre-sorts line items by "completability" priority.
 * This determines which line items get stock first (small orders win).
 * Same criteria as assembly line, but WITHOUT fulfillment type consideration.
 */
const presortByAllocationPriority = (
	lineItems: SessionLineItem[],
): SessionLineItem[] => {
	return [...lineItems].sort((a, b) => {
		// 1. Valid items first
		const aValid = isLineItemNotMalformed(a);
		const bValid = isLineItemNotMalformed(b);
		if (aValid && !bValid) return -1;
		if (!aValid && bValid) return 1;

		// 2. Orders where all items are dark pretreat (can complete together)
		const aAllDark = orderHasAllDarkPretreat(a.order, lineItems);
		const bAllDark = orderHasAllDarkPretreat(b.order, lineItems);
		if (aAllDark && !bAllDark) return -1;
		if (!aAllDark && bAllDark) return 1;

		// 3. Small heat transfer prints go to bottom
		const aSmallHT = itemHasSmallHeatTransferPrint(a);
		const bSmallHT = itemHasSmallHeatTransferPrint(b);
		if (aSmallHT && !bSmallHT) return 1;
		if (!aSmallHT && bSmallHT) return -1;

		// 4. Dark pretreat first
		const aPretreat = getItemPretreat(a);
		const bPretreat = getItemPretreat(b);
		if (aPretreat === "dark" && bPretreat === "light") return -1;
		if (aPretreat === "light" && bPretreat === "dark") return 1;

		// 5. Large heat transfer prints first
		const aLargeHT = itemHasLargeHeatTransferPrint(a);
		const bLargeHT = itemHasLargeHeatTransferPrint(b);
		if (aLargeHT && !bLargeHT) return -1;
		if (!aLargeHT && bLargeHT) return 1;

		// 6. Small orders first (KEY: these get stock first = complete faster)
		const aOrderSize = a.order.lineItems.length;
		const bOrderSize = b.order.lineItems.length;
		if (aOrderSize < bOrderSize) return -1;
		if (aOrderSize > bOrderSize) return 1;

		// 7. Fewer prints first
		const aPrintCount = a.prints.length;
		const bPrintCount = b.prints.length;
		if (aPrintCount < bPrintCount) return -1;
		if (aPrintCount > bPrintCount) return 1;

		// 8. Garment type order
		const garmentDiff = getItemGarmentTypeIndex(a) - getItemGarmentTypeIndex(b);
		if (garmentDiff !== 0) return garmentDiff;

		// 9. Alphabetical fallback
		return a.name.localeCompare(b.name);
	});
};

/**
 * Creates picking requirements by intelligently assigning stock to line items.
 * Line items from smaller orders get stock priority (they complete faster).
 */
export const createPickingRequirements = (
	lineItems: SessionLineItem[],
	premadeStockItems: PremadeStockItem[],
): PickingRequirementsResult => {
	// Build available stock map (productVariantId → remaining toPick quantity)
	const availableStock = new Map<string, number>();
	for (const item of premadeStockItems) {
		availableStock.set(item.productVariantId, item.toPick);
	}

	// Pre-sort to determine allocation priority
	const sortedItems = presortByAllocationPriority(lineItems);

	// Allocate stock by walking sorted list
	const fulfillmentMap: Record<string, FulfillmentType> = {};
	const requirements: PickingRequirement[] = [];

	for (const item of sortedItems) {
		const variantId = item.productVariant?.id;
		let fulfillmentType: FulfillmentType = "print";

		if (item.product?.isBlackLabel) {
			fulfillmentType = "black_label";
		} else if (variantId) {
			const remaining = availableStock.get(variantId) ?? 0;
			if (remaining >= item.quantity) {
				fulfillmentType = "stock";
				availableStock.set(variantId, remaining - item.quantity);
			}
		}

		fulfillmentMap[item.id] = fulfillmentType;

		// Build requirement record
		requirements.push({
			lineItemId: item.id,
			lineItemName: item.name,
			orderId: item.orderId,
			orderName: item.order.name,
			expectedFulfillmentType: fulfillmentType,
			blankVariantId: item.blankVariant?.id ?? null,
			productVariantId: item.productVariant?.id ?? null,
			quantity: item.quantity,
			blankDisplayName: item.blank
				? `${item.blank.blankCompany} ${item.blank.blankName}`
				: null,
			blankVariantSize: item.blankVariant?.size ?? null,
			blankGarmentType: item.blank?.garmentType ?? null,
			blankGarmentColor: item.blankVariant?.color ?? null,
			productDisplayName: item.product?.title ?? null,
			productVariantDisplayName: item.productVariant?.title ?? null,
		});
	}

	return { requirements, fulfillmentMap };
};
