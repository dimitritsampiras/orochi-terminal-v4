import { GenerateSessionDocumentsResponse } from "@/lib/types/api";
import { createSortedAssemblyLine } from "./create-assembly-line";
import { generatePickingList } from "../pdf/generate-final-picking-list";
import { generateAssemblyList } from "../pdf/generate-assembly-list";
import { eq, max } from "drizzle-orm";
import { batchDocuments, batches } from "@drizzle/schema";
import { db } from "@/lib/clients/db";
import { admin } from "@/lib/clients/supabase-admin";
import { getLineItemsByBatchId, SessionLineItem } from "./get-session-line-items";
import { getPremadeStockRequirements } from "./get-premade-stock-requirements";
import { generateMergedShipmentPdf } from "../pdf/generate-merged-shipment-pdf";
import { adjustInventory } from "../inventory/adjust-inventory";

/**
 * Generate both picking list and assembly list together.
 * Stores JSON snapshots for assembly line order and picking requirements.
 */
export async function startSession(lineItems: SessionLineItem[], session: typeof batches.$inferSelect): Promise<GenerateSessionDocumentsResponse> {


  // Get premade stock requirements first (needed for fulfillment assignment)
  const { items: premadeStockItems } = getPremadeStockRequirements(lineItems);


  // Generate fresh sorted assembly line with intelligent fulfillment assignment
  const assemblyResult = await createSortedAssemblyLine(session.id, lineItems, premadeStockItems);

  if (assemblyResult.error || !assemblyResult.data) {
    return { data: null, error: assemblyResult.error || "Failed to create sorted assembly line" };
  }

  const { assemblyLine, pickingRequirements } = assemblyResult.data;

  // Generate both PDFs in parallel
  // Picking list combines premade + blank requirements into one PDF
  const [pickingResult, assemblyResult2] = await Promise.all([
    generatePickingList(assemblyLine, session),
    generateAssemblyList(assemblyLine, session),
  ]);

  if (pickingResult.error || !pickingResult.data) {
    return { data: null, error: pickingResult.error || "Failed to generate picking list PDF" };
  }

  if (assemblyResult2.error || !assemblyResult2.data) {
    return { data: null, error: assemblyResult2.error || "Failed to generate assembly list PDF" };
  }

  // Get next document group number for this batch
  const timestamp = Date.now();

  // Upload both PDFs
  const pickingPath = `batch-documents/picking-list-${session.id}-${timestamp}.pdf`;
  const assemblyPath = `batch-documents/assembly-list-${session.id}-${timestamp}.pdf`;

  const [pickingUpload, assemblyUpload] = await Promise.all([
    admin.storage.from("packing-slips").upload(pickingPath, pickingResult.data, {
      contentType: "application/pdf",
    }),
    admin.storage.from("packing-slips").upload(assemblyPath, assemblyResult2.data, {
      contentType: "application/pdf",
    }),
  ]);

  if (pickingUpload.error) {
    console.error("Failed to upload picking list:", pickingUpload.error);
    return { data: null, error: "Failed to upload picking list PDF" };
  }

  if (assemblyUpload.error) {
    console.error("Failed to upload assembly list:", assemblyUpload.error);
    return { data: null, error: "Failed to upload assembly list PDF" };
  }

  // Store assembly line JSON and picking requirements JSON
  const assemblyLineJson = JSON.stringify(
    assemblyLine.map(({ id, itemPosition, expectedFulfillment }) => ({
      id,
      itemPosition,
      expectedFulfillment,
    }))
  );

  const pickingListJson = JSON.stringify(pickingRequirements);

  // Update batch with JSON snapshots
  await db
    .update(batches)
    .set({
      assemblyLineJson,
      pickingListJson,
    })
    .where(eq(batches.id, session.id));

  // Create document records with group number
  const [pickingDoc, assemblyDoc] = await db
    .insert(batchDocuments)
    .values([
      {
        batchId: session.id,
        documentPath: pickingPath,
        name: `Picking List | Session ${session.id}`,
        documentType: "picking_list",
        documentNotes: "",
      },
      {
        batchId: session.id,
        documentPath: assemblyPath,
        name: `Assembly List | Session ${session.id}`,
        documentType: "assembly_list",
        documentNotes: "",
      },
    ])
    .returning();


  // In generate-session-documents.ts, after the other PDF generation:
  await generateMergedShipmentPdf(
    session.id,
    pickingRequirements,
    assemblyLine
  );



  await db.update(batches).set({
    active: false
  }).where(eq(batches.active, true));

  // Mark session as active
  await db
    .update(batches)
    .set({
      active: true,
      startedAt: new Date(),
    })
    .where(eq(batches.id, session.id));

  // Decrement overstock inventory based on actual allocation
  for (const item of assemblyLine) {
    if (item.expectedFulfillment === "stock" && item.productVariant) {
      await adjustInventory(
        { type: "product", variantId: item.productVariant.id },
        -item.quantity,
        "assembly_usage",
        {
          batchId: session.id,
          lineItemId: item.id,
          logMessage: `Session ${session.id} started: decremented ${item.quantity} overstock for ${
            item.product?.title ?? "Unknown Product"
          }`,
        }
      );
    }
  }


  return {
    data: {
      pickingList: pickingDoc,
      assemblyList: assemblyDoc,
    },
    error: null,
  };
}
