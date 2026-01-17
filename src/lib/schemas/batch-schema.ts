import { lineItemCompletionStatus } from "@drizzle/schema";
import z from "zod";

/**
 * Schema for generating session documents (picking list + assembly list together)
 * This is the only way to generate these documents - they must always be created as a pair
 */
export const generateSessionDocumentsSchema = z.object({
  // Currently no additional options, but schema is here for future extensibility
});

export type GenerateSessionDocumentsSchema = z.infer<typeof generateSessionDocumentsSchema>;

// ============================================================================
// Settlement Schemas
// ============================================================================

/**
 * Schema for updating a line item's status during settlement
 */
export const updateLineItemStatusSchema = z.object({
  lineItemId: z.string(),
  newStatus: z.enum(lineItemCompletionStatus.enumValues),
  notes: z.string().optional(),
});

export type UpdateLineItemStatusSchema = z.infer<typeof updateLineItemStatusSchema>;

/**
 * Schema for adjusting inventory during settlement
 */
export const adjustSettlementInventorySchema = z.object({
  targetType: z.enum(["blankVariant", "productVariant"]),
  targetId: z.string(),
  changeAmount: z.number(),
  lineItemId: z.string().optional(),
  notes: z.string().optional(),
});

export type AdjustSettlementInventorySchema = z.infer<typeof adjustSettlementInventorySchema>;

/**
 * Schema for marking a session as settled
 */
export const settleSessionSchema = z.object({
  notes: z.string().optional(),
});

export type SettleSessionSchema = z.infer<typeof settleSessionSchema>;

// ============================================================================
// Premade Stock Verification Schemas
// ============================================================================
