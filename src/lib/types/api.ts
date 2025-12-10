import { products, productVariants } from "@drizzle/schema";
import { getOrderQueue } from "../core/orders/get-order-queue";
import { DataResponse } from "./misc";

export type QueueResponse = DataResponse<Awaited<ReturnType<typeof getOrderQueue>>>;

export type GetProductsResponse = DataResponse<
  (typeof products.$inferSelect & {
    variants: (typeof productVariants.$inferSelect)[];
  })[]
>;
