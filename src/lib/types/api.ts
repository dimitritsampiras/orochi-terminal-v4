import { blanks, blankVariants, prints, products, productVariants, shipments } from "@drizzle/schema";
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

export type DeleteBlankVariantResponse = DataResponse<"success" | null>;

export type CreateBlankVariantResponse = DataResponse<typeof blankVariants.$inferSelect | null>;

export type UpdateBlankResponse = DataResponse<typeof blanks.$inferSelect | null>;

// Print responses
export type CreatePrintResponse = DataResponse<typeof prints.$inferSelect | null>;
export type UpdatePrintResponse = DataResponse<typeof prints.$inferSelect | null>;
export type DeletePrintResponse = DataResponse<"success" | null>;