import { db } from "@/lib/clients/db";
import { admin } from "@/lib/clients/supabase-admin";
import { generateAssemblyList } from "@/lib/core/pdf/generate-assembly-list";
import { generatePickingList } from "@/lib/core/pdf/generate-picking-list";
import { createSortedAssemblyLine } from "@/lib/core/session/create-assembly-line";
import { createBatchSchema } from "@/lib/schemas/order-schema";
import { CreateBatchResponse } from "@/lib/types/api";
import { batches, batchDocuments, orders, ordersBatches, logs } from "@drizzle/schema";
import { eq, inArray, max } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse<CreateBatchResponse>> {
  const body = await request.json();
  const { data: parsedData, error: parseError } = createBatchSchema.safeParse(body);

  if (parseError || !parsedData) {
    return NextResponse.json({ data: null, error: parseError?.message ?? "Invalid input" }, { status: 400 });
  }

  const { orderIds, setAsActive } = parsedData;

  try {
    // Wrap everything in a transaction so we can rollback on failure
    const newBatch = await db.transaction(async (tx) => {
      // If setting as active, deactivate all other batches first
      if (setAsActive) {
        await tx.update(batches).set({ active: false }).where(eq(batches.active, true));
      }

      // Get the largest batch ID to avoid sequence conflicts
      const [{ maxId }] = await tx.select({ maxId: max(batches.id) }).from(batches);
      const nextId = (maxId ?? 0) + 1;

      // Insert the new batch with explicit ID
      const [insertedBatch] = await tx
        .insert(batches)
        .values({ id: nextId, active: setAsActive ?? false })
        .returning();

      if (!insertedBatch) {
        throw new Error("Failed to create batch");
      }

      const batchId = insertedBatch.id;

      // Link orders to the batch via orders_batches junction table
      await tx.insert(ordersBatches).values(
        orderIds.map((orderId) => ({
          orderId,
          batchId,
        }))
      );

      const orderData = await tx
        .select({ id: orders.id, name: orders.name })
        .from(orders)
        .where(inArray(orders.id, orderIds));

      // Mark orders as no longer queued
      await tx.update(orders).set({ queued: false }).where(inArray(orders.id, orderIds));

      // Bulk insert logs for all orders in a single query
      await tx.insert(logs).values(
        orderData.map<typeof logs.$inferInsert>((order) => ({
          type: "INFO",
          category: "AUTOMATED",
          message: `Order ${order.name} added to batch ${batchId}`,
          orderId: order.id,
        }))
      );

      return insertedBatch;
    });

    // Generate assembly line JSON after transaction commits
    // (createSortedAssemblyLine queries the db, needs committed data)
    const { data: assemblyLineData } = await createSortedAssemblyLine(newBatch.id);

    if (assemblyLineData) {
      const assemblyLineJson = JSON.stringify(
        assemblyLineData.map(({ id, itemPosition }) => ({
          id,
          itemPosition,
        }))
      );

      await db.update(batches).set({ assemblyLineJson }).where(eq(batches.id, newBatch.id));
    }

    // Return the created batch with assembly line JSON
    const [createdBatch] = await db.select().from(batches).where(eq(batches.id, newBatch.id));

    // Generate picking list and assembly list documents in parallel
    // We await this to ensure documents are created before response (serverless functions may terminate after response)
    // Wrapped in try-catch so document generation errors don't fail batch creation
    if (assemblyLineData && createdBatch) {
      try {
        // await generateBatchDocuments(assemblyLineData, createdBatch);
      } catch (err) {
        // console.error("Error generating batch documents (non-fatal):", err);
      }
    }

    return NextResponse.json({ data: createdBatch, error: null });
  } catch (error) {
    console.error("Error creating batch:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to create batch" },
      { status: 500 }
    );
  }
}

/**
 * Generate picking list and assembly list PDFs for a batch
 * Runs asynchronously to not block the batch creation response
 */
async function generateBatchDocuments(
  assemblyLineData: Awaited<ReturnType<typeof createSortedAssemblyLine>>["data"],
  batch: typeof batches.$inferSelect
) {
  if (!assemblyLineData) return;

  const timestamp = Date.now();
  const batchId = batch.id;

  // Generate both PDFs in parallel
  const [pickingResult, assemblyResult] = await Promise.all([
    generatePickingList(assemblyLineData, batch),
    generateAssemblyList(assemblyLineData, batch),
  ]);

  const uploadPromises: Promise<void>[] = [];

  // Upload picking list if generated successfully
  if (pickingResult.data) {
    const pickingPath = `batch-documents/picking-list-${batchId}-${timestamp}.pdf`;
    uploadPromises.push(
      (async () => {
        const { error: uploadError } = await admin.storage
          .from("packing-slips")
          .upload(pickingPath, pickingResult.data!, {
            contentType: "application/pdf",
          });

        if (!uploadError) {
          await db.insert(batchDocuments).values({
            batchId,
            documentPath: pickingPath,
            name: `Picking List - Session ${batchId}`,
            documentType: "picking_list",
            documentNotes: "",
          });
        } else {
          console.error("Failed to upload picking list:", uploadError);
        }
      })()
    );
  } else {
    console.error("Failed to generate picking list:", pickingResult.error);
  }

  // Upload assembly list if generated successfully
  if (assemblyResult.data) {
    const assemblyPath = `batch-documents/assembly-list-${batchId}-${timestamp}.pdf`;
    uploadPromises.push(
      (async () => {
        const { error: uploadError } = await admin.storage
          .from("packing-slips")
          .upload(assemblyPath, assemblyResult.data!, {
            contentType: "application/pdf",
          });

        if (!uploadError) {
          await db.insert(batchDocuments).values({
            batchId,
            documentPath: assemblyPath,
            name: `Assembly List - Session ${batchId}`,
            documentType: "assembly_list",
            documentNotes: "",
          });
        } else {
          console.error("Failed to upload assembly list:", uploadError);
        }
      })()
    );
  } else {
    console.error("Failed to generate assembly list:", assemblyResult.error);
  }

  await Promise.all(uploadPromises);
}
