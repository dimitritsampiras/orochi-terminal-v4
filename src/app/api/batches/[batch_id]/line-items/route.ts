import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
import { GetSessionLineItemsResponse } from "@/lib/types/api";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<GetSessionLineItemsResponse>> => {
  const { batch_id } = await params;
  const batchId = parseInt(batch_id, 10);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  const { data, error } = await getLineItemsByBatchId(batchId);
  if (error || !data) {
    return NextResponse.json({ data: null, error: error ?? "Failed to fetch line items" }, { status: 500 });
  }

  return NextResponse.json({ data: { lineItems: data.lineItems }, error: null });
};
