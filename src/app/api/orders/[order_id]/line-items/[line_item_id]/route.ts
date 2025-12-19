import { db } from "@/lib/clients/db";
import { createClient } from "@/lib/clients/supabase-server";
import { editLineItemSchema } from "@/lib/schemas/order-schema";
import { lineItems, userRole } from "../../../../../../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { buildResourceGid } from "@/lib/utils";
import { logger } from "@/lib/core/logger";

// TODO: edit these roles god damn
const authorizedRoles: (typeof userRole.enumValues)[number][] = ["superadmin", "admin", "warehouse", "va"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ line_item_id: string; order_id: string }> }
) {
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

    const awaitedParmas = await params;
    const orderId = buildResourceGid("Order", awaitedParmas.order_id);
    const lineItemId = buildResourceGid("LineItem", awaitedParmas.line_item_id);

    const rawBody = await req.json();

    const { completionStatus } = editLineItemSchema.parse(rawBody);

    const lineItemUpdatePayload: Partial<typeof lineItems.$inferInsert> = {};

    let logMessage = "";

    if (completionStatus) {
      lineItemUpdatePayload.completionStatus = completionStatus;
      logMessage = `Line item marked as '${completionStatus.replaceAll("_", " ")}' by ${user.username}`;
    }

    await db
      .update(lineItems)
      .set(lineItemUpdatePayload)
      .where(and(eq(lineItems.id, lineItemId), eq(lineItems.orderId, orderId)));

    if (logMessage) {
      await logger.info(logMessage, {
        orderId: orderId,
        profileId: user.id,
      });
    }

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error updating line item:", error);
    return NextResponse.json({ data: null, error: "Failed to update line item" }, { status: 500 });
  }
}
