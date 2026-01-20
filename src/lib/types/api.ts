import type {
	batches,
	batchDocuments,
	blanks,
	blankVariants,
	prints,
	products,
	productVariants,
	shipments,
	inventoryTransactions,
	orders,
	lineItems,
	orderNotes,
	orderHolds,
} from "@drizzle/schema";
import type { getOrderQueue } from "../core/orders/get-order-queue";
import type { DataResponse } from "./misc";
import type { NormalizedShipmentRate } from "./shipping.types";
import type { GeneralParcel } from "../core/shipping/parcel-schema";
import type { SortedAssemblyLineItem } from "../core/session/create-assembly-line";
import type {
	PremadeStockItem,
	PremadeStockRequirements,
} from "../core/session/get-premade-stock-requirements";
import type { BlankStockItem, BlankStockRequirements } from "../core/session/get-blank-stock-requirements";
import type { SessionLineItem } from "../core/session/get-session-line-items";
import type { OrderQuery } from "./admin.generated";
import type { OrderShipmentData } from "../core/shipping/retrieve-shipments-from-order";

export type LoginResponse = DataResponse<"success" | null>;

export type QueueResponse = DataResponse<
	Awaited<ReturnType<typeof getOrderQueue>>
>;
export type GetOrdersResponse = QueueResponse;

export type GetProductsResponse = DataResponse<
	(typeof products.$inferSelect & {
		variants: (typeof productVariants.$inferSelect)[];
	})[]
>;

export type CreateShipmentResponse = DataResponse<
	typeof shipments.$inferSelect
>;

export type PurchaseShipmentResponse = DataResponse<"success" | null>;

export type GetBlanksResponse = DataResponse<
	(typeof blanks.$inferSelect & {
		blankVariants: (typeof blankVariants.$inferSelect)[];
	})[]
>;

export type SyncBlankResponse = DataResponse<"success" | null>;

export type DeleteBlankVariantResponse = DataResponse<"success" | null>;

export type CreateBlankVariantResponse = DataResponse<
	typeof blankVariants.$inferSelect | null
>;

export type UpdateBlankResponse = DataResponse<
	typeof blanks.$inferSelect | null
>;

export type CreateBlankResponse = DataResponse<
	typeof blanks.$inferSelect | null
>;

// Print responses
export type CreatePrintResponse = DataResponse<
	typeof prints.$inferSelect | null
>;
export type UpdatePrintResponse = DataResponse<
	typeof prints.$inferSelect | null
>;
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

export type CreateBatchResponse = DataResponse<
	typeof batches.$inferSelect | null
>;

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
export type AdjustSettlementInventoryResponse = DataResponse<{
	success: boolean;
}>;
export type SettleSessionResponse = DataResponse<{ success: boolean }>;

// Premade stock verification types
export type PremadeStockItemWithInventory = {
	inventoryTransactions: (typeof inventoryTransactions.$inferSelect)[];
	currentInventory: number;
} & PremadeStockItem;

export type GetPremadeStockRequirementsResponse = DataResponse<{
	items: PremadeStockItemWithInventory[];
	malformedItems: PremadeStockRequirements["malformedItems"];
	filteredItems: (SessionLineItem & { reason: string })[];
}>;

export type VerifyPremadeStockResponse = DataResponse<"success">;

// Blank stock verification types
export type BlankStockItemWithInventory = {
	inventoryTransactions: (typeof inventoryTransactions.$inferSelect)[];
} & BlankStockItem;

export type GetBlankStockRequirementsResponse = DataResponse<{
	blanks: BlankStockItemWithInventory[];
  malformedItems: BlankStockRequirements["malformedItems"];
  filteredItems: (SessionLineItem & { reason: string })[];
	
}>;

export type VerifyBlankStockResponse = DataResponse<"success">;

export type GetSessionLineItemsResponse = DataResponse<{
	lineItems: SessionLineItem[];
}>;

export type VerifyItemSyncResponse = DataResponse<"success">;

export type GetOrderResponse = DataResponse<
	(typeof orders.$inferSelect & {
		lineItems: (typeof lineItems.$inferSelect)[];
		shipments: (typeof shipments.$inferSelect)[];
		batches: (typeof batches.$inferSelect)[];
		orderNotes: (typeof orderNotes.$inferSelect)[];
		orderHolds: (typeof orderHolds.$inferSelect)[];
	}) & {
		shopifyOrder: Extract<
			NonNullable<OrderQuery["node"]>,
			{ __typename: "Order" }
		>;
		shipmentData: OrderShipmentData[];
	}
>;

export type CreateOrderHoldResponse = DataResponse<
	typeof orderHolds.$inferSelect
>;
