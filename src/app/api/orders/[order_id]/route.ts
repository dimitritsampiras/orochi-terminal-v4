import { db } from "@/lib/clients/db";
import { createClient } from "@/lib/clients/supabase-server";
import { type NextRequest, NextResponse } from "next/server";
import { orders, products, profiles, userRole } from "../../../../../drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { editOrderSchema } from "@/lib/schemas/order-schema";
import { logger } from "@/lib/core/logger";
import { buildResourceGid } from "@/lib/utils";

// TODO: edit these roles god damn
const authorizedRoles: (typeof userRole.enumValues)[number][] = ["superadmin", "admin", "warehouse", "va"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ order_id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.profiles.findFirst({
      where: { id: authUser.id },
    });

    if (user === undefined || !authorizedRoles.includes(user.role)) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const awaitedParams = await params;

    const orderId = buildResourceGid("Order", awaitedParams.order_id);

    const rawBody = await req.json();

    const { queued, fulfillmentPriority, shippingPriority } = editOrderSchema.parse(rawBody);

    let updatePayload: Partial<typeof orders.$inferInsert> = {};
    let logMessage = "";

    if (queued !== undefined) {
      updatePayload.queued = queued;
      logMessage = `Order ${queued ? "queued" : "unqueued"} by ${user.username}`;
    }

    if (fulfillmentPriority !== undefined) {
      updatePayload.fulfillmentPriority = fulfillmentPriority;
      logMessage = `Fulfillment priority updated to ${fulfillmentPriority} by ${user.username}`;
    }

    if (shippingPriority !== undefined) {
      updatePayload.shippingPriority = shippingPriority;
      logMessage = `Shipping priority updated to ${shippingPriority} by ${user.username}`;
    }

    await db.update(orders).set(updatePayload).where(eq(orders.id, orderId));

    // Smart Logging: If we determined a semantic action occurred, log it
    if (logMessage) {
      // Fire and forget logging (don't await if you want faster response, or await for safety)
      await logger.info(logMessage, {
        orderId: orderId,
        profileId: user.id,
      });
    }

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ data: null, error: "Failed to update order" }, { status: 500 });
  }
}
