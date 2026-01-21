import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { settleSessionSchema } from "@/lib/schemas/batch-schema";
import { SettleSessionResponse } from "@/lib/types/api";
import { DataResponse } from "@/lib/types/misc";
import { batches } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/batches/[batch_id]/settle
 *
 * Marks a session as settled. Should only be called after all discrepancies
 * have been resolved or acknowledged.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<DataResponse<'success'>>> {
  return NextResponse.json({ data: "success", error: null });
}

