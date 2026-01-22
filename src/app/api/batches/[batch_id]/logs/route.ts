import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import type { GetSessionLogsResponse } from "@/lib/types/api";
import { logs, profiles } from "@drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<GetSessionLogsResponse>> {
  const user = await authorizeApiUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  try {
    const sessionLogs = await db
      .select({
        id: logs.id,
        createdAt: logs.createdAt,
        type: logs.type,
        category: logs.category,
        message: logs.message,
        orderId: logs.orderId,
        lineItemId: logs.lineItemId,
        profileId: logs.profileId,
        profileUsername: profiles.username,
      })
      .from(logs)
      .leftJoin(profiles, eq(logs.profileId, profiles.id))
      .where(eq(logs.batchId, batchId))
      .orderBy(desc(logs.createdAt));

    return NextResponse.json({ data: sessionLogs, error: null });
  } catch (error) {
    console.error("Error fetching session logs:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
