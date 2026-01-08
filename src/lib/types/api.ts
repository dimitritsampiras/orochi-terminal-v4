import { batches, blanks, blankVariants, prints, products, productVariants, shipments } from "@drizzle/schema";
import { getOrderQueue } from "../core/orders/get-order-queue";
import { DataResponse } from "./misc";
import { NormalizedShipmentRate } from "./shipping.types";
import { GeneralParcel } from "../core/shipping/parcel-schema";
import { SortedAssemblyLineItem } from "../core/session/create-assembly-line";

export type LoginResponse = DataResponse<"success" | null>;

export type QueueResponse = DataResponse<Awaited<ReturnType<typeof getOrderQueue>>>;
export type GetOrdersResponse = QueueResponse;

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

export type CreateBlankResponse = DataResponse<typeof blanks.$inferSelect | null>;

// Print responses
export type CreatePrintResponse = DataResponse<typeof prints.$inferSelect | null>;
export type UpdatePrintResponse = DataResponse<typeof prints.$inferSelect | null>;
export type DeletePrintResponse = DataResponse<"success" | null>;

export type GetRateResponse = DataResponse<{
  rate: NormalizedShipmentRate;
  parcel: GeneralParcel;
  otherRates: NormalizedShipmentRate[];
} | null>;

export type GetAssemblyLineResponse = DataResponse<{
  lineItems: SortedAssemblyLineItem[];
  batchId: number;
}>;

export type CreateBatchResponse = DataResponse<typeof batches.$inferSelect | null>;

export type PrintProductResponse = DataResponse<"success" | null>;