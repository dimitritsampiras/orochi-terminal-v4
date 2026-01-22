import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { updateLineItemStatusSchema } from "@/lib/schemas/batch-schema";
import { UpdateLineItemStatusResponse } from "@/lib/types/api";
import { lineItems } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/batches/[batch_id]/settle/line-item-status
 *
 * Updates a line item's completion status as part of session settlement.
 * Logs the change with settlement context.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<UpdateLineItemStatusResponse>> {
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
    const parsed = updateLineItemStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
    }

    const { lineItemId, newStatus, notes } = parsed.data;

    // Get line item to verify it exists and get previous status
    const lineItem = await db.query.lineItems.findFirst({
      where: { id: lineItemId },
    });

    if (!lineItem) {
      return NextResponse.json({ data: null, error: "Line item not found" }, { status: 404 });
    }

    const previousStatus = lineItem.completionStatus;

    // Update the status
    await db.update(lineItems).set({ completionStatus: newStatus }).where(eq(lineItems.id, lineItemId));

    // Log the change with settlement context
    await logger.info(
      `[settlement] Line item status changed from '${previousStatus}' to '${newStatus}'${notes ? `: ${notes}` : ""} by ${user.username}`,
      {
        profileId: user.id,
        orderId: lineItem.orderId,
        batchId,
      }
    );

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error("Error updating line item status:", error);
    return NextResponse.json({ data: null, error: "Failed to update line item status" }, { status: 500 });
  }
}

