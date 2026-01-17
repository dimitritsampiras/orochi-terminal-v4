import { NextRequest, NextResponse } from "next/server";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { db } from "@/lib/clients/db";
import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
import { generateBlankPickingList } from "@/lib/core/pdf/generate-blank-picking-list";
import { premadeStockRequirementsSchema } from "@/lib/core/session/get-premade-stock-requirements";

/**
 * GET /api/batches/[batch_id]/documents/blank-picking-list
 * Generates and returns the blank picking list PDF (ephemeral - not stored)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
) {
  const user = await authorizeApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id, 10);

  if (isNaN(batchId)) {
    return NextResponse.json({ error: "Invalid batch ID" }, { status: 400 });
  }

  try {
    // First, get the batch to check for premade stock requirements snapshot
    const batch = await db.query.batches.findFirst({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    if (!batch.premadeStockRequirementsJson) {
      return NextResponse.json(
        { error: "Premade stock must be verified before generating blank picking list" },
        { status: 400 }
      );
    }

    // Parse the premade stock requirements snapshot
    const { data: premadeStockRequirements } = premadeStockRequirementsSchema.safeParse(
      batch.premadeStockRequirementsJson
    );

    if (!premadeStockRequirements) {
      return NextResponse.json({ error: "Failed to parse premade stock requirements" }, { status: 500 });
    }

    // Fetch line items for the batch
    const { data, error } = await getLineItemsByBatchId(batchId);

    if (error || !data) {
      return NextResponse.json({ error: error ?? "Failed to fetch line items" }, { status: 500 });
    }

    const { lineItems, batch: batchData } = data;

    // Generate the PDF
    const pdfResult = await generateBlankPickingList(lineItems, batchData, premadeStockRequirements.items);

    if (pdfResult.error || !pdfResult.data) {
      return NextResponse.json({ error: pdfResult.error ?? "Failed to generate PDF" }, { status: 500 });
    }

    // Return the PDF with headers to open in browser
    return new NextResponse(new Uint8Array(pdfResult.data), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="blank-picking-list-session-${batchId}.pdf"`,
        "Content-Length": pdfResult.data.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating blank picking list:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

