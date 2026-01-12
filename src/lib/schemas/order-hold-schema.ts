import { orderHoldCause } from "@drizzle/schema";
import z from "zod";

export const createOrderHoldSchema = z.object({
  cause: z.enum(orderHoldCause.enumValues),
  reasonNotes: z.string().min(1, "Reason notes are required"),
});

export type CreateOrderHoldSchema = z.infer<typeof createOrderHoldSchema>;

export const resolveOrderHoldSchema = z.object({
  resolvedNotes: z.string().optional(),
});

export type ResolveOrderHoldSchema = z.infer<typeof resolveOrderHoldSchema>;

