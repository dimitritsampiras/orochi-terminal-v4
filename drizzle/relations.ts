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
      to: r.products.id,
    }),
    blankVariant: r.one.blankVariants({
      from: r.productVariants.blankVariantId,
      to: r.blankVariants.id,
    }),
  },
  profiles: {
    inventoryTransactions: r.many.inventoryTransactions(),
    logs: r.many.logs(),
    ordersViaLogs: r.many.orders({
      alias: "orders_id_profiles_id_via_logs",
    }),
    ordersViaOrderNotes: r.many.orders({
      alias: "orders_id_profiles_id_via_orderNotes"
    }),
    ordersViaShipments: r.many.orders({
      from: r.profiles.id.through(r.shipments.gateScannerBy),
      to: r.orders.id.through(r.shipments.orderId),
      alias: "profiles_id_orders_id_via_shipments"
    }),
    weeklyReports: r.many.weeklyReports(),
  },
  orders: {
    lineItems: r.many.lineItems(),
    logs: r.many.logs(),
    profilesViaLogs: r.many.profiles({
      from: r.orders.id.through(r.logs.orderId),
      to: r.profiles.id.through(r.logs.profileId),
      alias: "orders_id_profiles_id_via_logs",
    }),
    orderHolds: r.many.orderHolds(),
    orderNotes: r.many.orderNotes(),
    profilesViaOrderNotes: r.many.profiles({
      from: r.orders.id.through(r.orderNotes.orderId),
      to: r.profiles.id.through(r.orderNotes.profileId),
      alias: "orders_id_profiles_id_via_orderNotes"
    }),
    batches: r.many.batches(),
    shipments: r.many.shipments(),
    profilesViaShipments: r.many.profiles({
      alias: "profiles_id_orders_id_via_shipments"
    }),
    shippingRateCaches: r.many.shippingRateCache(),
  },
  products: {
    productVariants: r.many.productVariants(),
    lineItems: r.many.lineItems(),
    prints: r.many.prints(),
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
      to: r.orders.id,
    }),
    profile: r.one.profiles({
      from: r.orderNotes.profileId,
      to: r.profiles.id,
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
      to: r.orders.id,
    }),
  },
  shippingRateCache: {
    order: r.one.orders({
      from: r.shippingRateCache.orderId,
      to: r.orders.id
    }),
  },
  ordersBatches: {
    order: r.one.orders({
      from: r.ordersBatches.orderId,
      to: r.orders.id,
    }),
    batch: r.one.batches({
      from: r.ordersBatches.batchId,
      to: r.batches.id,
    }),
  },
  warehouseExpenses: {
    batch: r.one.batches({
      from: r.warehouseExpenses.batchId,
      to: r.batches.id
    }),
  },
  weeklyReports: {
    profile: r.one.profiles({
      from: r.weeklyReports.createdBy,
      to: r.profiles.id
    }),
  },
}))