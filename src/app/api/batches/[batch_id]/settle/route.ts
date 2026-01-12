import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { settleSessionSchema } from "@/lib/schemas/batch-schema";
import { SettleSessionResponse } from "@/lib/types/api";
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
): Promise<NextResponse<SettleSessionResponse>> {
  const user = await authorizeApiUser(["super_admin", "admin"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id, 10);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = settleSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
    }

    const { notes } = parsed.data;

    // Verify batch exists
    const batch = await db.query.batches.findFirst({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ data: null, error: "Session not found" }, { status: 404 });
    }

    // Mark as settled by setting settledAt timestamp
    // A session is considered settled if settledAt is not null
    await db
      .update(batches)
      .set({
        settledAt: new Date(),
      })
      .where(eq(batches.id, batchId));

    // Log the settlement
    await logger.info(
      `[settlement] Session ${batchId} settled${notes ? `: ${notes}` : ""} by ${user.username}`,
      {
        profileId: user.id,
      }
    );

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error("Error settling session:", error);
    return NextResponse.json({ data: null, error: "Failed to settle session" }, { status: 500 });
  }
}

