import { db } from "@/lib/clients/db";
import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
import { createSortedAssemblyLine } from "@/lib/core/session/create-assembly-line";
import { getPremadeStockRequirements } from "@/lib/core/session/get-premade-stock-requirements";
import { startSession } from "@/lib/core/session/start-session";
import type { DataResponse } from "@/lib/types/misc";
import { batches } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";

/**
 * GET /api/batches/[batch_id]/start
 * Preview the session start
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batch_id: string }> },
) {
  const { batch_id } = await params;
  const batchId = Number.parseInt(batch_id, 10);
  if (Number.isNaN(batchId)) {
    return NextResponse.json(
      { data: null, error: "Invalid batch ID" },
      { status: 400 },
    );
  }

  const { data, error } = await getLineItemsByBatchId(batchId);

  if (!data) {
    return NextResponse.json(
      { data: null, error: error ?? "Failed to get line items" },
      { status: 500 },
    );
  }

  const { items: premadeStockItems, malformedItems } = getPremadeStockRequirements(
    data.lineItems,
  );

  const assemblyResult = await createSortedAssemblyLine(
    batchId,
    data.lineItems,
    premadeStockItems,
  );

  if (!assemblyResult.data) {
    return NextResponse.json(
      { data: null, error: assemblyResult.error ?? "Failed to create preview" },
      { status: 500 },
    );
  }

  const { assemblyLine, pickingRequirements } = assemblyResult.data;

  return NextResponse.json({
    data: {
      filteredItems: data.filteredLineItems,
      assemblyLine: assemblyLine.map((item) => ({
        id: item.id,
        name: item.name,
        orderName: item.order.name,
        fulfillmentType: item.expectedFulfillment ?? "print",
        position: item.itemPosition,
      })),
      malformedItems,
      pickingRequirements: pickingRequirements,
    },
    error: null,
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ batch_id: string }> },
): Promise<NextResponse<DataResponse<"success">>> {

  const user = await authorizeApiUser(['super_admin', 'admin']);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = Number.parseInt(batch_id, 10);
  if (Number.isNaN(batchId)) {
    return NextResponse.json(
      { data: null, error: "Invalid batch ID" },
      { status: 400 },
    );
  }

  const session = await db.query.batches.findFirst({
    where: { id: batchId },
  });

  if (!session) {
    return NextResponse.json(
      { data: null, error: "Session not found" },
      { status: 404 },
    );
  }

  if (!session.premadeStockVerifiedAt) {
    return NextResponse.json(
      { data: null, error: "Premade stock must be verified before starting" },
      { status: 400 },
    );
  }

  if (!session.blankStockVerifiedAt) {
    return NextResponse.json(
      { data: null, error: "Blank stock must be verified before starting" },
      { status: 400 },
    );
  }

  const { data, error } = await getLineItemsByBatchId(batchId);

  if (!data) {
    return NextResponse.json(
      { data: null, error: error ?? "Failed to get line items" },
      { status: 500 },
    );
  }

  // Generate session documents (picking list + assembly list PDFs)
  // This also stores assemblyLineJson and pickingListJson
  const docResult = await startSession(data.lineItems, data.batch);

  if (docResult.error || !docResult.data) {
    return NextResponse.json(
      { data: null, error: docResult.error ?? "Failed to generate session documents" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: "success", error: null });
}
