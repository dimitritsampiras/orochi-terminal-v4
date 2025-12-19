import z from "zod";

export const updateVariantSchema = z.object({
  warehouseInventory: z.number().int().min(0).optional(),
});

export type UpdateVariantSchema = z.infer<typeof updateVariantSchema>;

export const updateBlankVariantSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  weight: z.number().min(0).optional(),
  volume: z.number().min(0).optional(),
});

export type UpdateBlankVariantSchema = z.infer<typeof updateBlankVariantSchema>;

export const updateProductSchema = z.object({
  isBlackLabel: z.boolean().optional(),
});

export type UpdateProductSchema = z.infer<typeof updateProductSchema>;

export const syncBlankSchema = z.object({
  blank_id: z.string(),
  color: z.string().min(1),
});

export type SyncBlankSchema = z.infer<typeof syncBlankSchema>;
