import z from "zod";

// Mark a print as completed (decrement blank inventory)
export const markPrintedSchema = z.object({
  printId: z.string(),
  batchId: z.number(),
  // If true, skip the inventory adjustment (user chose not to decrement again after reset)
  skipInventoryAdjustment: z.boolean().optional(),
});
export type MarkPrintedSchema = z.infer<typeof markPrintedSchema>;

// Mark item as fulfilled from pre-printed stock (decrement product variant inventory)
export const markStockedSchema = z.object({
  batchId: z.number(),
});
export type MarkStockedSchema = z.infer<typeof markStockedSchema>;

// Mark item as out of stock (blank unavailable)
export const markOosSchema = z.object({
  batchId: z.number(),
});
export type MarkOosSchema = z.infer<typeof markOosSchema>;

// Reset line item to not_printed (reverse inventory if applicable)
export const resetLineItemSchema = z.object({
  batchId: z.number(),
});
export type ResetLineItemSchema = z.infer<typeof resetLineItemSchema>;

