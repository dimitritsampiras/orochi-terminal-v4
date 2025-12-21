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

export const createBlankVariantSchema = z.object({
  color: z.string().min(1),
  size: z.enum(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "os"]),
  weight: z.number().min(0),
  volume: z.number().min(0),
  quantity: z.number().int().min(0).optional().default(0),
});

export type CreateBlankVariantSchema = z.infer<typeof createBlankVariantSchema>;

export const updateBlankSchema = z.object({
  blankCompany: z.string().min(1).optional(),
  blankName: z.string().min(1).optional(),
  garmentType: z
    .enum([
      "coat",
      "jacket",
      "hoodie",
      "crewneck",
      "longsleeve",
      "tee",
      "shorts",
      "sweatpants",
      "headwear",
      "accessory",
    ])
    .optional(),
  customsPrice: z.number().min(0).optional(),
  hsCode: z.string().nullable().optional(),
});

export type UpdateBlankSchema = z.infer<typeof updateBlankSchema>;

// Print schemas
const printLocationEnum = z.enum(["front", "back", "left_sleeve", "right_sleeve", "other"]);
const pretreatEnum = z.enum(["light", "dark"]);

export const createPrintSchema = z.object({
  location: printLocationEnum,
  heatTransferCode: z.string().nullable().optional(),
  isSmallPrint: z.boolean().optional().default(false),
  pretreat: pretreatEnum.nullable().optional(),
});

export type CreatePrintSchema = z.infer<typeof createPrintSchema>;

export const updatePrintSchema = z.object({
  location: printLocationEnum.optional(),
  heatTransferCode: z.string().nullable().optional(),
  isSmallPrint: z.boolean().optional(),
  pretreat: pretreatEnum.nullable().optional(),
});

export type UpdatePrintSchema = z.infer<typeof updatePrintSchema>;
