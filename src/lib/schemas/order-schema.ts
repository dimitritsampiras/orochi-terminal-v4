import { fulfillmentPriority, shippingPriority } from "@drizzle/schema";
import z from "zod";

export const editOrderSchema = z.object({
  queued: z.boolean().optional(),
  fulfillmentPriority: z.enum(fulfillmentPriority.enumValues).optional(),
  shippingPriority: z.enum(shippingPriority.enumValues).optional(),
});

export type EditOrderSchema = z.infer<typeof editOrderSchema>;

export const editLineItemSchema = z.object({
  completionStatus: z
    .enum(["not_printed", "partially_printed", "printed", "in_stock", "oos_blank", "skipped", "ignore"])
    .optional(),
});

export type EditLineItemSchema = z.infer<typeof editLineItemSchema>;

export const purchaseShipmentSchema = z.object({
  sessionId: z.string().optional(),
});

export type PurchaseShipmentSchema = z.infer<typeof purchaseShipmentSchema>;
