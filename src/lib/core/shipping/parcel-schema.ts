import z from "zod";

// Schema and type for GeneralParcel
export const generalParcelSchema = z.object({
  totalWeight: z.number(),
  totalValue: z.number(),
  totalVolume: z.number(),
  parcelTemplate: z.object({
    name: z.string(),
    widthCm: z.string(),
    lengthCm: z.string(),
    heightCm: z.string(),
    maxVolume: z.number(),
  }),
  items: z.array(
    z.object({
      weight: z.number(),
      volume: z.number(),
      value: z.number(),
      quantity: z.number(),
      customsDescription: z.string(),
      hsCode: z.string(),
      sku: z.string(),
      lineItemId: z.string(),
      itemName: z.string(),
    })
  ),
});

export type GeneralParcel = z.infer<typeof generalParcelSchema>;

