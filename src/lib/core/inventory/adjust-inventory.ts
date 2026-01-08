import { db } from "@/lib/clients/db";
import { blankVariants, inventoryTransactionReason, inventoryTransactions, productVariants } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

type InventoryTarget =
  | { type: "blank"; variantId: string }
  | { type: "product"; variantId: string };

export async function adjustInventory(
  target: InventoryTarget,
  delta: number,
  reason: (typeof inventoryTransactionReason.enumValues)[number],
  {
    profileId,
    batchId,
    logMessage,
    lineItemId,
  }: { profileId?: string; batchId?: number; logMessage?: string; lineItemId?: string }
) {
  return await db.transaction(async (tx) => {
    // 1. Get current item based on type
    const item =
      target.type === "blank"
        ? await tx.query.blankVariants.findFirst({ where: { id: target.variantId } })
        : await tx.query.productVariants.findFirst({ where: { id: target.variantId } });

    if (!item) {
      throw new Error(`${target.type === "blank" ? "Blank" : "Product"} variant not found`);
    }

    const currentQty = target.type === "blank" 
      ? (item as typeof blankVariants.$inferSelect).quantity 
      : (item as typeof productVariants.$inferSelect).warehouseInventory;
    
    const newQty = currentQty + delta;

    // 2. Update the Item
    if (target.type === "blank") {
      await tx.update(blankVariants).set({ quantity: newQty }).where(eq(blankVariants.id, target.variantId));
    } else {
      await tx.update(productVariants).set({ warehouseInventory: newQty }).where(eq(productVariants.id, target.variantId));
    }

    // 3. Create log if message provided
    let logId: number | undefined;
    if (logMessage) {
      logId = await logger.info(logMessage, { profileId });
    }

    // 4. Log the Transaction
    await tx.insert(inventoryTransactions).values({
      ...(target.type === "blank" 
        ? { blankVariantId: target.variantId } 
        : { productVariantId: target.variantId }),
      changeAmount: delta,
      previousQuantity: currentQty,
      newQuantity: newQty,
      reason,
      logId,
      batchId,
      profileId,
      lineItemId,
    });
  });
}