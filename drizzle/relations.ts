import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  batchDocuments: {
    batch: r.one.batches({
      from: r.batchDocuments.batchId,
      to: r.batches.id,
    }),
  },
  batches: {
    batchDocuments: r.many.batchDocuments(),
    orders: r.many.orders({
      from: r.batches.id.through(r.ordersBatches.batchId),
      to: r.orders.id.through(r.ordersBatches.orderId),
    }),
  },
  blankVariants: {
    blank: r.one.blanks({
      from: r.blankVariants.blankId,
      to: r.blanks.id,
    }),
    products: r.many.products(),
  },
  blanks: {
    blankVariants: r.many.blankVariants(),
    products: r.many.products(),
  },
  creatorPayout: {
    profile: r.one.profiles({
      from: r.creatorPayout.creatorName,
      to: r.profiles.creatorVendorName,
    }),
  },
  profiles: {
    creatorPayouts: r.many.creatorPayout(),
    ordersViaLogs: r.many.orders({
      alias: "orders_id_profiles_id_via_logs",
    }),
    ordersViaOrderNotes: r.many.orders({
      alias: "orders_id_profiles_id_via_orderNotes",
    }),
  },
  lineItems: {
    order: r.one.orders({
      from: r.lineItems.orderId,
      to: r.orders.id,
    }),
    product: r.one.products({
      from: r.lineItems.productId,
      to: r.products.id,
    }),
    productVariant: r.one.productVariants({
      from: r.lineItems.variantId,
      to: r.productVariants.id,
    }),
    prints: r.many.prints({
      from: r.lineItems.id.through(r.printLogs.lineItemId),
      to: r.prints.id.through(r.printLogs.printId),
    }),
  },
  orders: {
    lineItems: r.many.lineItems(),
    profilesViaLogs: r.many.profiles({
      from: r.orders.id.through(r.logs.orderId),
      to: r.profiles.id.through(r.logs.profileId),
      alias: "orders_id_profiles_id_via_logs",
    }),
    orderHolds: r.many.orderHolds(),
    profilesViaOrderNotes: r.many.profiles({
      from: r.orders.id.through(r.orderNotes.orderId),
      to: r.profiles.id.through(r.orderNotes.profileId),
      alias: "orders_id_profiles_id_via_orderNotes",
    }),
    batches: r.many.batches(),
    shipments: r.many.shipments(),
  },
  products: {
    productVariants: r.many.productVariants(),
    lineItems: r.many.lineItems(),
    prints: r.many.prints(),
    blankVariants: r.many.blankVariants({
      from: r.products.id.through(r.productVariants.productId),
      to: r.blankVariants.id.through(r.productVariants.blankVariantId),
    }),
    blank: r.one.blanks({
      from: r.products.blankId,
      to: r.blanks.id,
    }),
  },
  productVariants: {
    lineItems: r.many.lineItems(),
    product: r.one.products({
      from: r.productVariants.productId,
      to: r.products.id,
    }),
  },
  orderHolds: {
    order: r.one.orders({
      from: r.orderHolds.orderId,
      to: r.orders.id,
    }),
  },
  prints: {
    lineItems: r.many.lineItems(),
    product: r.one.products({
      from: r.prints.productId,
      to: r.products.id,
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
}));
