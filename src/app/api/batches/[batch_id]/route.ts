import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { DataResponse } from "@/lib/types/misc";
import { batches, logs, orders, ordersBatches } from "@drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

type UpdateBatchResponse = DataResponse<typeof batches.$inferSelect | null>;
type DeleteBatchResponse = DataResponse<"success" | null>;

const updateBatchSchema = z.object({
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<UpdateBatchResponse>> {
  const user = await authorizeUser(["superadmin", "admin", "staff"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  const body = await request.json();
  const { data: parsedData, error: parseError } = updateBatchSchema.safeParse(body);

  if (parseError || !parsedData) {
    return NextResponse.json({ data: null, error: parseError?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    // If setting this batch as active, deactivate all other batches first
    if (parsedData.active === true) {
      await db.transaction(async (tx) => {
        // Deactivate all other active batches
        await tx.update(batches).set({ active: false }).where(eq(batches.active, true));
        // Set this batch as active
        await tx.update(batches).set({ active: true }).where(eq(batches.id, batchId));
      });
    } else if (parsedData.active === false) {
      // Simply deactivate this batch
      await db.update(batches).set({ active: false }).where(eq(batches.id, batchId));
    }

    // Return the updated batch
    const [updatedBatch] = await db.select().from(batches).where(eq(batches.id, batchId));

    if (!updatedBatch) {
      return NextResponse.json({ data: null, error: "Batch not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updatedBatch, error: null });
  } catch (error) {
    console.error("Error updating batch:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to update batch" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<DeleteBatchResponse>> {
  const user = await authorizeUser(["superadmin", "admin"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  try {
    // Check if batch exists
    const [existingBatch] = await db.select().from(batches).where(eq(batches.id, batchId));

    if (!existingBatch) {
      return NextResponse.json({ data: null, error: "Batch not found" }, { status: 404 });
    }

    // Get all order IDs associated with this batch BEFORE deleting
    const batchOrders = await db
      .select({ orderId: ordersBatches.orderId })
      .from(ordersBatches)
      .where(eq(ordersBatches.batchId, batchId));

    const orderIds = batchOrders.map((bo) => bo.orderId);

    // Use a transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // Delete the batch (orders_batches will cascade delete due to FK constraint)
      await tx.delete(batches).where(eq(batches.id, batchId));

      // REQUEUE all orders that were in this batch
      // Only requeue orders that are NOT in any other session
      if (orderIds.length > 0) {
        // Find orders that are still in other sessions after this batch is deleted
        const ordersStillInSessions = await tx
          .select({ orderId: ordersBatches.orderId })
          .from(ordersBatches)
          .where(inArray(ordersBatches.orderId, orderIds));

        const ordersStillInSessionIds = new Set(ordersStillInSessions.map((o) => o.orderId));

        // Only requeue orders that are NOT in any other session
        const ordersToRequeue = orderIds.filter((id) => !ordersStillInSessionIds.has(id));

        if (ordersToRequeue.length > 0) {
          // Fetch order names for logging
          const orderData = await tx
            .select({ id: orders.id, name: orders.name })
            .from(orders)
            .where(inArray(orders.id, ordersToRequeue));

          await tx.update(orders).set({ queued: true }).where(inArray(orders.id, ordersToRequeue));

          // Bulk insert logs for all requeued orders
          await tx.insert(logs).values(
            orderData.map<typeof logs.$inferInsert>((order) => ({
              type: "INFO",
              category: "AUTOMATED",
              message: `Batch ${batchId} deleted and order ${order.name} was requeued`,
              orderId: order.id,
            }))
          );
        }
      }
    });

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error deleting batch:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to delete batch" },
      { status: 500 }
    );
  }
}
