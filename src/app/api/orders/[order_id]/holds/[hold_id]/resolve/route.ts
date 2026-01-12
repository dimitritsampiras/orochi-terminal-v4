import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { resolveOrderHoldSchema } from "@/lib/schemas/order-hold-schema";
import { buildResourceGid } from "@/lib/utils";
import { orderHolds } from "@drizzle/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ order_id: string; hold_id: string }> }
) {
  try {
    const user = await authorizeApiUser(["super_admin", "admin", "customer_support"]);

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { order_id, hold_id } = await params;
    const orderId = buildResourceGid("Order", order_id);
    const holdId = Number(hold_id);

    if (isNaN(holdId)) {
      return NextResponse.json({ data: null, error: "Invalid hold ID" }, { status: 400 });
    }

    // Check if hold exists and belongs to this order
    const existingHold = await db.query.orderHolds.findFirst({
      where: {
        id: holdId,
        orderId: orderId,
      },
    });

    if (!existingHold) {
      return NextResponse.json({ data: null, error: "Hold not found" }, { status: 404 });
    }

    if (existingHold.resolvedAt) {
      return NextResponse.json({ data: null, error: "Hold is already resolved" }, { status: 400 });
    }

    const body = await request.json();
    const { resolvedNotes } = resolveOrderHoldSchema.parse(body);

    const [updatedHold] = await db
      .update(orderHolds)
      .set({
        resolvedAt: new Date(),
        resolvedNotes: resolvedNotes || null,
        isResolved: true,
      })
      .where(and(eq(orderHolds.id, holdId), eq(orderHolds.orderId, orderId)))
      .returning();

    // Log the action
    await logger.info(`Order hold resolved: ${existingHold.cause}${resolvedNotes ? ` - ${resolvedNotes}` : ""}`, {
      orderId,
      profileId: user.id,
      metadata: { holdId, cause: existingHold.cause },
    });

    return NextResponse.json({ data: updatedHold, error: null });
  } catch (error) {
    console.error("Error resolving order hold:", error);
    return NextResponse.json({ data: null, error: "Failed to resolve order hold" }, { status: 500 });
  }
}

