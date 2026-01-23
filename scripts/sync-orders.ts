


// console.log("Fetching orders from DB...");
// const allOrders = await db.query.orders.findMany({
//   orderBy: { createdAt: 'desc' },
//   where: { createdAt: { gt: new Date('2025-11-01') } },
//   with: {
//     lineItems: true,
//   }
// });
// console.log(`Found ${allOrders.length} orders in DB`);

// type Order = OrdersQuery["orders"]["nodes"][number];

// let shopifyOrders: Order[] = [];
// let cursor: string | null | undefined = null;

// console.log("Fetching orders from Shopify...");
// while (true) {
//   const result = await shopify.request(ordersQuery, {
//     variables: {
//       first: 250,
//       query: "created_at:>2025-11-01",
//       after: cursor,
//     },
//   });
//   const orderData = result.data as OrdersQuery | undefined;
//   const errors = result.errors;

//   if (errors) {
//     console.error(errors);
//     break;
//   }

//   if (!orderData?.orders.nodes.length) {
//     break;
//   }

//   shopifyOrders.push(...orderData.orders.nodes);
//   cursor = orderData.orders.pageInfo.endCursor;
//   console.log(`Fetched ${shopifyOrders.length} orders so far...`);
// }
// console.log(`Found ${shopifyOrders.length} orders in Shopify`);

// const ordersMap = new Map<string, Order>(
//   shopifyOrders.map((order) => [order.id, order])
// );

// console.log("Syncing line items...");
// const updates: (() => Promise<unknown>)[] = [];

// for (const order of allOrders) {
//   const shopifyOrder = ordersMap.get(order.id);
//   if (!shopifyOrder) {
//     continue;
//   }

//   const lineItemMap = new Map<string, Order["lineItems"]["nodes"][number]>(
//     shopifyOrder.lineItems.nodes.map((lineItem) => [lineItem.id, lineItem])
//   );
//   for (const lineItem of order.lineItems) {
//     const shopifyLineItem = lineItemMap.get(lineItem.id);
//     if (!shopifyLineItem) {
//       continue;
//     }
//     updates.push(() =>
//       db.update(lineItems).set({
//         unfulfilledQuantity: shopifyLineItem.unfulfilledQuantity,
//         requiresShipping: shopifyLineItem.requiresShipping,
//         updatedAt: new Date(),
//       }).where(eq(lineItems.id, lineItem.id))
//     );
//   }
// }

// const BATCH_SIZE = 100;
// for (let i = 0; i < updates.length; i += BATCH_SIZE) {
//   const batch = updates.slice(i, i + BATCH_SIZE);
//   await Promise.all(batch.map(fn => fn()));
//   console.log(`Processed ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length} line items`);
// }
// console.log(`Updated ${updates.length} line items`)

// // 