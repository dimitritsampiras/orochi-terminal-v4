import "dotenv/config";
import { db } from "@/lib/clients/db";
import dayjs from "dayjs";

async function main() {
  const orders = await db.query.orders.findMany({
    where: {
      queued: false,
      displayFulfillmentStatus: { NOT: "FULFILLED" },
      displayIsCancelled: false,
      createdAt: {
        gte: new Date("2025-10-10"),
      },
    },
    with: {
      batches: {
        columns: {
          id: true,
        },
      },
    },
  });

  let count = 0;
  for (const order of orders) {
    if (order.batches.length === 0) {
      count++;
      console.log(order.name, order.queued, order.displayFulfillmentStatus, dayjs(order.createdAt).format("MMMM DD"));
    }
  }
  console.log(`Total orders: ${count}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
