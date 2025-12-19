import "dotenv/config";
import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { OrderQuery } from "@/lib/types/admin.generated";
import { getRateForOrder } from "@/lib/core/shipping/get-rate-for-order";
import { getOrderQueue } from "@/lib/core/orders/get-order-queue";
import { orders, ordersBatches } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import dayjs from "dayjs";
import { getProductDetailsForARXP } from "@/lib/utils";

async function main() {
  const variants = await db.query.blankVariants.findMany();

  console.log([...new Set(variants.map((variant) => variant.color))]);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
