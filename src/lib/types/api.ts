import {
  batches,
  batchDocuments,
  blanks,
  blankVariants,
  prints,
  products,
  productVariants,
  shipments,
  inventoryTransactions,
} from "@drizzle/schema";
import { getOrderQueue } from "../core/orders/get-order-queue";
import { DataResponse } from "./misc";
import { NormalizedShipmentRate } from "./shipping.types";
import { GeneralParcel } from "../core/shipping/parcel-schema";
import { SortedAssemblyLineItem } from "../core/session/create-assembly-line";
import { PremadeStockItem } from "../core/session/get-premade-stock-requirements";
import { BlankStockItem } from "../core/session/get-blank-stock-requirements";
import { SessionLineItem } from "../core/session/get-session-line-items";

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

// Session document generation response

export type GenerateSessionDocumentsResponse = DataResponse<{
  pickingList: typeof batchDocuments.$inferSelect;
  assemblyList: typeof batchDocuments.$inferSelect;
  documentGroup: number;
}>;

export type PrintProductResponse = DataResponse<"success" | null>;

export type ScanResponse = DataResponse<string | null>;

// Staff management responses
export type CreateStaffResponse = DataResponse<"success" | null>;
export type EditStaffResponse = DataResponse<"success" | null>;
export type DeleteStaffResponse = DataResponse<"success" | null>;

// Assembly action responses
export type AssemblyActionResult = {
  status: string;
  lineItemId: string;
  inventoryChanged: boolean;
};
export type MarkPrintedResponse = DataResponse<AssemblyActionResult>;
export type MarkStockedResponse = DataResponse<AssemblyActionResult>;
export type MarkOosResponse = DataResponse<AssemblyActionResult>;
export type ResetLineItemResponse = DataResponse<AssemblyActionResult>;

// Settlement response types
export type UpdateLineItemStatusResponse = DataResponse<{ success: boolean }>;
export type AdjustSettlementInventoryResponse = DataResponse<{ success: boolean }>;
export type SettleSessionResponse = DataResponse<{ success: boolean }>;

// Premade stock verification types
export type PremadeStockItemWithInventory = {
  inventoryTransactions: (typeof inventoryTransactions.$inferSelect)[];
  currentInventory: number;
} & PremadeStockItem;

export type GetPremadeStockRequirementsResponse = DataResponse<{
  items: {
    premade: PremadeStockItemWithInventory[];
    held: { lineItemName: string; orderNumber: string }[];
    unaccounted: { lineItemName: string; orderNumber: string; reason: string }[];
  };
  isVerified: boolean;
  verifiedAt: Date | null;
}>;

export type VerifyPremadeStockResponse = DataResponse<"success">;

// Blank stock verification types
export type BlankStockItemWithInventory = {
  inventoryTransactions: (typeof inventoryTransactions.$inferSelect)[];
} & BlankStockItem;

export type GetBlankStockRequirementsResponse = DataResponse<{
  items: {
    blanks: BlankStockItemWithInventory[];
    held: { lineItemName: string; orderNumber: string }[];
    unaccounted: { lineItemName: string; orderNumber: string; reason: string }[];
  };
  isVerified: boolean;
  verifiedAt: Date | null;
}>;

export type VerifyBlankStockResponse = DataResponse<"success">;

export type GetSessionLineItemsResponse = DataResponse<{
  lineItems: SessionLineItem[];
}>;

export type VerifyItemSyncResponse = DataResponse<"success">;