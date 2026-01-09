import { db } from "@/lib/clients/db";
import { admin } from "@/lib/clients/supabase-admin";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { generateAssemblyList } from "@/lib/core/pdf/generate-assembly-list";
import { generatePickingList } from "@/lib/core/pdf/generate-picking-list";
import { getAssemblyLine } from "@/lib/core/session/create-assembly-line";
import { DataResponse } from "@/lib/types/misc";
import { batchDocuments, batchDocumentType } from "@drizzle/schema";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

type BatchDocument = typeof batchDocuments.$inferSelect;
type CreateDocumentResponse = DataResponse<BatchDocument>;

const createDocumentSchema = z.object({
  documentType: z.enum(["assembly_list", "picking_list"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<CreateDocumentResponse>> {
  const user = await authorizeApiUser(["super_admin", "admin", "warehouse_staff"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = createDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
  }

  const { documentType } = parsed.data;

  try {
    // Get the assembly line data for the batch
    const { data: assemblyLineData, error: assemblyLineError } = await getAssemblyLine(batchId);

    if (assemblyLineError || !assemblyLineData) {
      return NextResponse.json(
        { data: null, error: assemblyLineError || "Failed to get assembly line" },
        { status: 500 }
      );
    }

    const { lineItems, batch } = assemblyLineData;

    // Generate the PDF based on document type
    let pdfBuffer: Buffer | null = null;
    let pdfError: string | null = null;
    let documentName: string;
    let documentPath: string;

    const timestamp = Date.now();

    if (documentType === "assembly_list") {
      const result = await generateAssemblyList(lineItems, batch);
      pdfBuffer = result.data;
      pdfError = result.error;
      documentName = `Assembly List - Session ${batchId}`;
      documentPath = `batch-documents/assembly-list-${batchId}-${timestamp}.pdf`;
    } else {
      const result = await generatePickingList(lineItems, batch);
      pdfBuffer = result.data;
      pdfError = result.error;
      documentName = `Picking List - Session ${batchId}`;
      documentPath = `batch-documents/picking-list-${batchId}-${timestamp}.pdf`;
    }

    if (pdfError || !pdfBuffer) {
      return NextResponse.json({ data: null, error: pdfError || "Failed to generate PDF" }, { status: 500 });
    }

    // Upload to Supabase storage
    const { error: uploadError } = await admin.storage.from("packing-slips").upload(documentPath, pdfBuffer, {
      contentType: "application/pdf",
    });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ data: null, error: "Failed to upload document" }, { status: 500 });
    }

    // Create the batch document record
    const [newDocument] = await db
      .insert(batchDocuments)
      .values({
        batchId,
        documentPath,
        name: documentName,
        documentType,
        documentNotes: "",
      })
      .returning();

    return NextResponse.json({ data: newDocument, error: null });
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to create document" },
      { status: 500 }
    );
  }
}

