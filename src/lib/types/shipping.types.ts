import { shipmentApi } from "@drizzle/schema";

// shipping options
export type ShippingOptions = {
  targetRateId?: string; // if user manually selects a rate to choose form
  targetLineItemIds?: string[]; // if user manually selects line items to ship, meant to override auto-filters
  targetApi?: (typeof shipmentApi.enumValues)[number]; // if the user selects a specific API to use, will use both if undefined
  // TODO: much later
  additionalProductIds?: string[]; // if the user selects additional products to add to the parcel -> not yet implemented
};

export type EasypostShipmentStatus =
  | "unknown"
  | "pre_transit"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "available_for_pickup"
  | "return_to_sender"
  | "failure"
  | "cancelled"
  | "error";
