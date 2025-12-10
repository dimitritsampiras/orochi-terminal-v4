import "dotenv/config";
import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { OrderQuery } from "@/lib/types/admin.generated";
import { getRateForOrder } from "@/lib/core/shipping/get-rate-for-order";
import { getOrderQueue } from "@/lib/core/orders/get-order-queue";

(async () => {
  // fetch the most recent orders from out database (40)
  // const databaseOrders = await db.query.orders.findMany({
  //   limit: 40,
  //   orderBy: { createdAt: "desc" },
  // });

  // // loop through them and fetch the full order from shopify
  // for (const dbOrder of databaseOrders) {
  //   try {
  //     console.log(`Processing order ${dbOrder.name} (${dbOrder.id})`);

  //     // Fetch full order from Shopify
  //     const { data, errors } = await shopify.request<OrderQuery>(orderQuery, {
  //       variables: { id: dbOrder.id },
  //     });

  //     if (errors || !data?.node || data.node?.__typename !== "Order") {
  //       console.error(`Failed to fetch order ${dbOrder.name}:`, errors);
  //       continue;
  //     }

  //     const shopifyOrder = data.node;

  //     // fetch a shipping rate for the order
  //     const rateResponse = await getRateForOrder(shopifyOrder);

  //     if (rateResponse.error || !rateResponse.data) {
  //       console.error(`Failed to get rate for order ${dbOrder.name}:`, rateResponse.error);
  //       continue;
  //     }

  //     console.log(`✅Successfully got rate for order ${dbOrder.name}:`, {
  //       cost: rateResponse.data.cost,
  //       carrier: rateResponse.data.carrierName,
  //       service: rateResponse.data.serviceName,
  //       eta: rateResponse.data.eta,
  //     });
  //     console.log();
  //   } catch (error) {
  //     console.error(`Unexpected error processing order ${dbOrder.name}:`, error);
  //   }
  // }

  const queue = await getOrderQueue({
    withItemData: false,
  });
})();
