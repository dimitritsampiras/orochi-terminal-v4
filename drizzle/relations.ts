import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	batchDocuments: {
		batch: r.one.batches({
			from: r.batchDocuments.batchId,
			to: r.batches.id
		}),
	},
	batches: {
		batchDocuments: r.many.batchDocuments(),
		inventoryTransactions: r.many.inventoryTransactions(),
		logs: r.many.logs(),
		orders: r.many.orders({
			from: r.batches.id.through(r.ordersBatches.batchId),
			to: r.orders.id.through(r.ordersBatches.orderId)
		}),
		warehouseExpenses: r.many.warehouseExpenses(),
	},
	blankVariants: {
		blank: r.one.blanks({
			from: r.blankVariants.blankId,
			to: r.blanks.id
		}),
		inventoryTransactions: r.many.inventoryTransactions(),
		products: r.many.products(),
	},
	blanks: {
		blankVariants: r.many.blankVariants(),
		products: r.many.products(),
	},
	creatorPayout: {
		profile: r.one.profiles({
			from: r.creatorPayout.creatorName,
			to: r.profiles.creatorVendorName
		}),
	},
	profiles: {
		creatorPayouts: r.many.creatorPayout(),
		inventoryTransactions: r.many.inventoryTransactions(),
		logs: r.many.logs(),
		ordersViaOrderNotes: r.many.orders({
			alias: "orders_id_profiles_id_via_orderNotes"
		}),
		usersInAuth: r.one.usersInAuth({
			from: r.profiles.id,
			to: r.usersInAuth.id
		}),
		ordersViaShipments: r.many.orders({
			from: r.profiles.id.through(r.shipments.gateScannerBy),
			to: r.orders.id.through(r.shipments.orderId),
			alias: "profiles_id_orders_id_via_shipments"
		}),
	},
	inventoryTransactions: {
		batch: r.one.batches({
			from: r.inventoryTransactions.batchId,
			to: r.batches.id
		}),
		blankVariant: r.one.blankVariants({
			from: r.inventoryTransactions.blankVariantId,
			to: r.blankVariants.id
		}),
		lineItem: r.one.lineItems({
			from: r.inventoryTransactions.lineItemId,
			to: r.lineItems.id
		}),
		log: r.one.logs({
			from: r.inventoryTransactions.logId,
			to: r.logs.id
		}),
		productVariant: r.one.productVariants({
			from: r.inventoryTransactions.productVariantId,
			to: r.productVariants.id
		}),
		profile: r.one.profiles({
			from: r.inventoryTransactions.profileId,
			to: r.profiles.id
		}),
	},
	lineItems: {
		inventoryTransactions: r.many.inventoryTransactions(),
		order: r.one.orders({
			from: r.lineItems.orderId,
			to: r.orders.id
		}),
		product: r.one.products({
			from: r.lineItems.productId,
			to: r.products.id
		}),
		productVariant: r.one.productVariants({
			from: r.lineItems.variantId,
			to: r.productVariants.id
		}),
		logs: r.many.logs(),
		prints: r.many.prints({
			from: r.lineItems.id.through(r.printLogs.lineItemId),
			to: r.prints.id.through(r.printLogs.printId)
		}),
	},
	logs: {
		inventoryTransactions: r.many.inventoryTransactions(),
		batch: r.one.batches({
			from: r.logs.batchId,
			to: r.batches.id
		}),
		lineItem: r.one.lineItems({
			from: r.logs.lineItemId,
			to: r.lineItems.id
		}),
		order: r.one.orders({
			from: r.logs.orderId,
			to: r.orders.id
		}),
		profile: r.one.profiles({
			from: r.logs.profileId,
			to: r.profiles.id
		}),
	},
	productVariants: {
		inventoryTransactions: r.many.inventoryTransactions(),
		lineItems: r.many.lineItems(),
		product: r.one.products({
			from: r.productVariants.productId,
			to: r.products.id
		}),
		blankVariant: r.one.blankVariants({
			from: r.productVariants.blankVariantId,
			to: r.blankVariants.id
		}),
	},
	orders: {
		lineItems: r.many.lineItems(),
		logs: r.many.logs(),
		orderHolds: r.many.orderHolds(),
		profilesViaOrderNotes: r.many.profiles({
			from: r.orders.id.through(r.orderNotes.orderId),
			to: r.profiles.id.through(r.orderNotes.profileId),
			alias: "orders_id_profiles_id_via_orderNotes"
		}),
		orderNotes: r.many.orderNotes(),
		batches: r.many.batches(),
		profilesViaShipments: r.many.profiles({
			alias: "profiles_id_orders_id_via_shipments"
		}),
		shippingRateCaches: r.many.shippingRateCache(),
		shipments: r.many.shipments(),
	},
	products: {
		lineItems: r.many.lineItems(),
		prints: r.many.prints(),
		productVariants: r.many.productVariants(),
		blankVariants: r.many.blankVariants({
			from: r.products.id.through(r.productVariants.productId),
			to: r.blankVariants.id.through(r.productVariants.blankVariantId)
		}),
		blank: r.one.blanks({
			from: r.products.blankId,
			to: r.blanks.id
		}),
	},
	orderHolds: {
		order: r.one.orders({
			from: r.orderHolds.orderId,
			to: r.orders.id
		}),
	},
	orderNotes: {
		order: r.one.orders({
			from: r.orderNotes.orderId,
			to: r.orders.id
		}),
		profile: r.one.profiles({
			from: r.orderNotes.profileId,
			to: r.profiles.id
		}),
	},
	prints: {
		lineItems: r.many.lineItems(),
		product: r.one.products({
			from: r.prints.productId,
			to: r.products.id
		}),
	},
	usersInAuth: {
		profiles: r.many.profiles(),
	},
	shipments: {
		order: r.one.orders({
			from: r.shipments.orderId,
			to: r.orders.id
		}),
		gateScanner: r.one.profiles({
			from: r.shipments.gateScannerBy,
			to: r.profiles.id
		}),
	},
	shippingRateCache: {
		order: r.one.orders({
			from: r.shippingRateCache.orderId,
			to: r.orders.id
		}),
	},
	warehouseExpenses: {
		batch: r.one.batches({
			from: r.warehouseExpenses.batchId,
			to: r.batches.id
		}),
	},
}))