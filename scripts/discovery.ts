import "dotenv/config";
import { db } from "@/lib/clients/db";
import dayjs from "dayjs";
import { lineItems, orders } from "@drizzle/schema";
import { eq, like } from "drizzle-orm";
import { shippo } from "@/lib/clients/shippo";
import { ordersGoneStale, ordersWithNoSessionHistory } from "@/lib/core/orders/get-unresolved-orders";
import { bulkFulfillOrders } from "@/lib/core/orders/bulk-fulfill-orders";

async function main() {
  // const orders = await ordersWithNoSessionHistory();
  // const orders = await ordersGoneStale();

  // for (const order of orders) {
  //   console.log(order.name, dayjs(order.createdAt).format("MM/DD/YYYY"));
  // }
  await bulkFulfillOrders();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
