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
  const txId = Math.random().toString(36).substring(7); // Simple ID for tracking
  console.log(`[adjustInventory:${txId}] START - ${target.type}:${target.variantId}, delta:${delta}, reason:${reason}, batchId:${batchId}, lineItemId:${lineItemId}`);

  try {
    const result = await db.transaction(async (tx) => {
      console.log(`[adjustInventory:${txId}] Transaction started`);

      // 1. Get current item based on type
      const item =
        target.type === "blank"
          ? await tx.query.blankVariants.findFirst({ where: { id: target.variantId } })
          : await tx.query.productVariants.findFirst({ where: { id: target.variantId } });

      console.log(`[adjustInventory:${txId}] Step 1: Found item = ${!!item}`);

      if (!item) {
        throw new Error(`${target.type === "blank" ? "Blank" : "Product"} variant not found`);
      }

      const currentQty = target.type === "blank"
        ? (item as typeof blankVariants.$inferSelect).quantity
        : (item as typeof productVariants.$inferSelect).warehouseInventory;

      // Prevent negative inventory
      const newQty = Math.max(0, currentQty + delta);
      console.log(`[adjustInventory:${txId}] Step 2: currentQty=${currentQty}, newQty=${newQty}`);

      // 2. Update the Item
      if (target.type === "blank") {
        await tx.update(blankVariants).set({ quantity: newQty }).where(eq(blankVariants.id, target.variantId));
      } else {
        await tx.update(productVariants).set({ warehouseInventory: newQty }).where(eq(productVariants.id, target.variantId));
      }
      console.log(`[adjustInventory:${txId}] Step 3: Updated ${target.type} variant`);

      // 3. Create log if message provided
      let logId: number | undefined;
      if (logMessage) {
        logId = await logger.info(logMessage, { profileId }, tx);
        console.log(`[adjustInventory:${txId}] Step 4: Created log, logId=${logId}`);
      }

      // 4. Log the Transaction
      const [insertedTx] = await tx.insert(inventoryTransactions).values({
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
      }).returning({ id: inventoryTransactions.id });

      console.log(`[adjustInventory:${txId}] Step 5: Inserted inventoryTransaction, id=${insertedTx?.id}`);

      return { success: true, transactionId: insertedTx?.id };
    });

    console.log(`[adjustInventory:${txId}] END SUCCESS - transactionId=${result.transactionId}`);
    return result;
  } catch (error) {
    console.error(`[adjustInventory:${txId}] ERROR:`, error);
    throw error;
  }
}