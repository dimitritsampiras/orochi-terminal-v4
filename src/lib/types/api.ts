import { blanks, blankVariants, products, productVariants, shipments } from "@drizzle/schema";
import { getOrderQueue } from "../core/orders/get-order-queue";
import { DataResponse } from "./misc";

export type QueueResponse = DataResponse<Awaited<ReturnType<typeof getOrderQueue>>>;

export type GetProductsResponse = DataResponse<
  (typeof products.$inferSelect & {
    variants: (typeof productVariants.$inferSelect)[];
  })[]
>;

export type CreateShipmentResponse = DataResponse<typeof shipments.$inferSelect>;

export type PurchaseShipmentResponse = DataResponse<"success" | null>;

export type GetBlanksResponse = DataResponse<
  (typeof blanks.$inferSelect & {
    blankVariants: (typeof blankVariants.$inferSelect)[];
  })[]
>;


export type SyncBlankResponse = DataResponse<"success" | null>;