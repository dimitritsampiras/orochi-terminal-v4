import { fulfillmentPriority, shipmentApi, shippingPriority } from "@drizzle/schema";
import z from "zod";
import { generalParcelSchema } from "../core/shipping/parcel-schema";

export const editOrderSchema = z.object({
  queued: z.boolean().optional(),
  fulfillmentPriority: z.enum(fulfillmentPriority.enumValues).optional(),
  shippingPriority: z.enum(shippingPriority.enumValues).optional(),
});

export type EditOrderSchema = z.infer<typeof editOrderSchema>;

// Normalized shipment rate schema
export const normalizedShipmentRateSchema = z.object({
  cost: z.number(),
  rateId: z.string(),
  api: z.enum(shipmentApi.enumValues),
  shipmentId: z.string(),
  eta: z.number().nullish(),
  carrierName: z.string(),
  serviceName: z.string().nullish(),
  serviceToken: z.string().nullish(),
  carrierLogo: z.string().nullish(),
});

export type NormalizedShipmentRate = z.infer<typeof normalizedShipmentRateSchema>;

export const editLineItemSchema = z.object({
  completionStatus: z
    .enum(["not_printed", "partially_printed", "printed", "in_stock", "oos_blank", "skipped", "ignore"])
    .optional(),
  markedAsPackaged: z.boolean().optional(),
});

export type EditLineItemSchema = z.infer<typeof editLineItemSchema>;

export const purchaseShipmentSchema = z.object({
  sessionId: z.string().optional(),
});

export type PurchaseShipmentSchema = z.infer<typeof purchaseShipmentSchema>;

export const getRatesSchema = z.object({
  lineItemIds: z.array(z.string()).min(1, "At least one line item is required"),
});

export type GetRatesSchema = z.infer<typeof getRatesSchema>;

export const createShipmentSchema = z.object({
  // For custom shipment - pass rate + parcel directly
  customShipment: z
    .object({
      rate: normalizedShipmentRateSchema,
      parcel: generalParcelSchema,
    })
    .optional(),
});

export type CreateShipmentSchema = z.infer<typeof createShipmentSchema>;

export const createBatchSchema = z.object({
  orderIds: z.array(z.string()).min(1, "At least one order is required"),
  setAsActive: z.boolean().optional(),
});

export type CreateBatchSchema = z.infer<typeof createBatchSchema>;
