import { db } from "@/lib/clients/db";
import { VerifyItemSyncResponse } from "@/lib/types/api";
import { batches } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<VerifyItemSyncResponse>> => {
  const { batch_id } = await params;
  const batchId = parseInt(batch_id, 10);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  await db.update(batches).set({ itemSyncVerifiedAt: new Date() }).where(eq(batches.id, batchId));

  return NextResponse.json({ data: "success", error: null });
};
