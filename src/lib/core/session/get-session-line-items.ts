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
	printLogs,
} from "@drizzle/schema";
import type { DataResponse } from "@/lib/types/misc";
import {
	lineItemReadyForFulfillment,
	orderReadyForFulfillment,
} from "./session.utils";

type OrderWithLineItems = typeof orders.$inferSelect & {
	lineItems: Pick<
		typeof lineItems.$inferSelect,
		"id" | "name" | "completionStatus"
	>[];
};

/**
 * Base type for a line item with all related session data
 * Used by both picking requirements and assembly line
 */
export type SessionLineItem = typeof lineItems.$inferSelect & {
	order: OrderWithLineItems & {
		hasActiveHold: boolean;
	};
	product: typeof products.$inferSelect | null;
	prints: (typeof prints.$inferSelect)[];
	blank: typeof blanks.$inferSelect | null;
	productVariant: typeof productVariants.$inferSelect | null;
	blankVariant: typeof blankVariants.$inferSelect | null;
};

/**
 * SessionLineItem with print logs attached (for assembly line item detail view)
 */
export type SessionLineItemWithPrintLogs = SessionLineItem & {
	printLogs: (typeof printLogs.$inferSelect)[];
};

/**
 * Get all line items for a batch with their related data
 * Uses a single query with JOINs: lineItems -> orders -> ordersBatches -> batches
 */
export const getLineItemsByBatchId = async (
	batchId: number,
): Promise<
	DataResponse<{
		lineItems: SessionLineItem[];
		batch: typeof batches.$inferSelect;
		filteredLineItems: (SessionLineItem & { reason: string })[];
	}>
> => {
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
			.leftJoin(
				blankVariants,
				eq(productVariants.blankVariantId, blankVariants.id),
			);

		// Get batch metadata
		const [batch] = await db
			.select()
			.from(batches)
			.where(eq(batches.id, batchId))
			.limit(1);

		if (!batch) {
			throw new Error(`Batch with id ${batchId} not found`);
		}

		// Group results by line item and aggregate prints, also track line items per order
		const lineItemMap = new Map<string, SessionLineItem>();
		const orderLineItemsMap = new Map<
			string,
			Pick<typeof lineItems.$inferSelect, "id" | "name" | "completionStatus">[]
		>();

		// Get all order IDs from the results to check for active holds
		const orderIds = [...new Set(results.map((r) => r.order.id))];

		// Fetch active holds for these orders
		const activeHolds = await db.query.orderHolds.findMany({
			where: {
				orderId: { in: orderIds },
				isResolved: false,
			},
			columns: { orderId: true },
		});

		// Build a set of order IDs that have active holds
		const ordersWithActiveHolds = new Set(
			activeHolds.map((h) => h.orderId).filter(Boolean) as string[],
		);

		// First pass: collect all line items per order
		for (const row of results) {
			const orderId = row.order.id;
			if (!orderLineItemsMap.has(orderId)) {
				orderLineItemsMap.set(orderId, []);
			}
			const orderLineItems = orderLineItemsMap.get(orderId);
			if (!orderLineItems?.some((li) => li.id === row.lineItem.id)) {
				orderLineItems?.push({
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
						hasActiveHold: ordersWithActiveHolds.has(row.order.id),
					},
					product: row.product,
					prints: row.print ? [row.print] : [],
					blank: row.blank,
					productVariant: row.productVariant,
					blankVariant: row.blankVariant,
				});
			}
		}

		const allLineItems = Array.from(lineItemMap.values());
		const validLineItems: SessionLineItem[] = [];
		const filteredLineItems: (SessionLineItem & { reason: string })[] = [];

		for (const item of allLineItems) {
			if (!orderReadyForFulfillment(item.order)) {
				filteredLineItems.push({
					...item,
					reason: item.order.displayIsCancelled
						? "order cancelled"
						: `order status: ${item.order.displayFulfillmentStatus}`,
				});
				continue;
			}

			if (!lineItemReadyForFulfillment(item)) {
				filteredLineItems.push({
					...item,
					reason: !item.requiresShipping
						? "does not require shipping"
						: "already fulfilled",
				});
				continue;
			}

			if (item.order.hasActiveHold) {
				filteredLineItems.push({
					...item,
					reason: "order has active hold",
				});
				continue;
			}

			validLineItems.push(item);
		}

		return {
			data: {
				lineItems: validLineItems,
				batch,
				filteredLineItems,
			},
			error: null,
		};
	} catch (error) {
		return {
			data: null,
			error:
				error instanceof Error ? error.message : "An unknown error occurred",
		};
	}
};

/**
 * Get a single line item by ID with all related data
 */
export const getLineItemById = async (
	lineItemId: string,
): Promise<DataResponse<SessionLineItemWithPrintLogs>> => {
	try {
		const results = await db
			.select({
				lineItem: lineItems,
				order: orders,
				product: products,
				print: prints,
				printLog: printLogs,
				blank: blanks,
				productVariant: productVariants,
				blankVariant: blankVariants,
			})
			.from(lineItems)
			.innerJoin(orders, eq(lineItems.orderId, orders.id))
			.leftJoin(products, eq(lineItems.productId, products.id))
			.leftJoin(prints, eq(products.id, prints.productId))
			.leftJoin(printLogs, eq(lineItems.id, printLogs.lineItemId))
			.leftJoin(blanks, eq(products.blankId, blanks.id))
			.leftJoin(productVariants, eq(lineItems.variantId, productVariants.id))
			.leftJoin(
				blankVariants,
				eq(productVariants.blankVariantId, blankVariants.id),
			)
			.where(eq(lineItems.id, lineItemId));

		if (results.length === 0) {
			return { data: null, error: `Line item with id ${lineItemId} not found` };
		}

		// Get all line items for the order (for the order.lineItems count)
		const orderLineItems = await db
			.select({
				id: lineItems.id,
				name: lineItems.name,
				completionStatus: lineItems.completionStatus,
			})
			.from(lineItems)
			.where(eq(lineItems.orderId, results[0].order.id));

		// Aggregate prints from multiple rows (due to prints LEFT JOIN)
		const printsArray: (typeof prints.$inferSelect)[] = [];
		for (const row of results) {
			if (row.print && !printsArray.some((p) => p.id === row.print?.id)) {
				printsArray.push(row.print);
			}
		}

		// Aggregate print logs
		const printLogsArray: (typeof printLogs.$inferSelect)[] = [];
		for (const row of results) {
			if (
				row.printLog &&
				!printLogsArray.some((pl) => pl.id === row.printLog?.id)
			) {
				printLogsArray.push(row.printLog);
			}
		}

		const firstRow = results[0];

		// Check for active hold on this order
		const activeHold = await db.query.orderHolds.findFirst({
			where: {
				orderId: firstRow.order.id,
				isResolved: false,
			},
		});

		const sessionLineItem: SessionLineItemWithPrintLogs = {
			...firstRow.lineItem,
			order: {
				...firstRow.order,
				lineItems: orderLineItems,
				hasActiveHold: !!activeHold,
			},
			product: firstRow.product,
			prints: printsArray,
			printLogs: printLogsArray,
			blank: firstRow.blank,
			productVariant: firstRow.productVariant,
			blankVariant: firstRow.blankVariant,
		};

		return { data: sessionLineItem, error: null };
	} catch (error) {
		return {
			data: null,
			error:
				error instanceof Error ? error.message : "An unknown error occurred",
		};
	}
};
