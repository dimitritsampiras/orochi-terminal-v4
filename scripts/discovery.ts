import "dotenv/config";
import { bulkFulfillOrders } from "@/lib/core/orders/bulk-fulfill-orders";

async function main() {
  // await bulkFulfillOrders();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
