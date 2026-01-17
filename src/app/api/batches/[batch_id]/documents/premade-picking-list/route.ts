import { NextRequest, NextResponse } from "next/server";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
import { generatePremadePickingList } from "@/lib/core/pdf/generate-premade-picking-list";

/**
 * GET /api/batches/[batch_id]/documents/premade-picking-list
 * Generates and returns the premade picking list PDF (ephemeral - not stored)
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
    // Fetch line items for the batch
    const { data, error } = await getLineItemsByBatchId(batchId);

    if (error || !data) {
      return NextResponse.json({ error: error ?? "Failed to fetch line items" }, { status: 500 });
    }

    const { lineItems, batch } = data;

    // Generate the PDF
    const pdfResult = await generatePremadePickingList(lineItems, batch);

    if (pdfResult.error || !pdfResult.data) {
      return NextResponse.json({ error: pdfResult.error ?? "Failed to generate PDF" }, { status: 500 });
    }

    // Return the PDF with headers to open in browser
    return new NextResponse(pdfResult.data, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="premade-picking-list-session-${batchId}.pdf"`,
        "Content-Length": pdfResult.data.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating premade picking list:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

