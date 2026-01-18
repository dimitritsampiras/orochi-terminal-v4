import { GenerateSessionDocumentsResponse } from "@/lib/types/api";
import { DataResponse } from "@/lib/types/misc";
import { createSortedAssemblyLine } from "./create-assembly-line";
import { createPickingRequirements } from "./create-picking-requirements";
import { generatePickingList } from "../pdf/generate-picking-list";
import { generateAssemblyList } from "../pdf/generate-assembly-list";
import { eq, max } from "drizzle-orm";
import { batchDocuments, batches } from "@drizzle/schema";
import { db } from "@/lib/clients/db";
import { admin } from "@/lib/clients/supabase-admin";
import { getLineItemsByBatchId } from "./get-session-line-items";

/**
 * Generate both picking list and assembly list together.
 * Stores JSON snapshots for assembly line order and picking requirements.
 */
export async function generateSessionDocuments(batchId: number): Promise<GenerateSessionDocumentsResponse> {
  // Get raw line items (not using stored order - we're regenerating fresh)
  const { data: lineItemsData, error: lineItemsError } = await getLineItemsByBatchId(batchId);

  if (lineItemsError || !lineItemsData) {
    return { data: null, error: lineItemsError || "Failed to get line items" };
  }

  const { lineItems, batch } = lineItemsData;

  // Generate fresh sorted assembly line
  const { data: sortedAssemblyLine, error: sortError } = await createSortedAssemblyLine(batchId, lineItems);

  if (sortError || !sortedAssemblyLine) {
    return { data: null, error: sortError || "Failed to create sorted assembly line" };
  }

  // Create picking requirements (line-item level for settlement)
  const { requirements: pickingRequirements } = createPickingRequirements(sortedAssemblyLine);

  // Generate both PDFs in parallel
  const [pickingResult, assemblyResult] = await Promise.all([
    generatePickingList(sortedAssemblyLine, batch),
    generateAssemblyList(sortedAssemblyLine, batch),
  ]);

  if (pickingResult.error || !pickingResult.data) {
    return { data: null, error: pickingResult.error || "Failed to generate picking list PDF" };
  }

  if (assemblyResult.error || !assemblyResult.data) {
    return { data: null, error: assemblyResult.error || "Failed to generate assembly list PDF" };
  }

  // Get next document group number for this batch
  const [{ maxGroup }] = await db
    .select({ maxGroup: max(batchDocuments.documentGroup) })
    .from(batchDocuments)
    .where(eq(batchDocuments.batchId, batchId));

  const documentGroup = (maxGroup ?? 0) + 1;
  const timestamp = Date.now();

  // Upload both PDFs
  const pickingPath = `batch-documents/picking-list-${batchId}-${timestamp}.pdf`;
  const assemblyPath = `batch-documents/assembly-list-${batchId}-${timestamp}.pdf`;

  const [pickingUpload, assemblyUpload] = await Promise.all([
    admin.storage.from("packing-slips").upload(pickingPath, pickingResult.data, {
      contentType: "application/pdf",
    }),
    admin.storage.from("packing-slips").upload(assemblyPath, assemblyResult.data, {
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
    sortedAssemblyLine.map(({ id, itemPosition }) => ({
      id,
      itemPosition,
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
    .where(eq(batches.id, batchId));

  // Create document records with group number
  const [pickingDoc, assemblyDoc] = await db
    .insert(batchDocuments)
    .values([
      {
        batchId,
        documentPath: pickingPath,
        name: `Picking List | Session ${batchId} - #${documentGroup}`,
        documentType: "picking_list",
        documentNotes: "",
        documentGroup,
      },
      {
        batchId,
        documentPath: assemblyPath,
        name: `Assembly List | Session ${batchId} #${documentGroup}`,
        documentType: "assembly_list",
        documentNotes: "",
        documentGroup,
      },
    ])
    .returning();

  return {
    data: {
      pickingList: pickingDoc,
      assemblyList: assemblyDoc,
      documentGroup,
    },
    error: null,
  };
}
