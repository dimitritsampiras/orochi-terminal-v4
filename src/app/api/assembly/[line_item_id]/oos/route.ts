import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { getOperator } from "@/lib/core/auth/get-operators";
import { logger } from "@/lib/core/logger";
import { markOosSchema } from "@/lib/schemas/assembly-schema";
import { MarkOosResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { lineItems } from "@drizzle/schema";
import { and, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ line_item_id: string }> }
): Promise<NextResponse<MarkOosResponse>> {
  const authUser = await authorizeApiUser(["super_admin", "admin", "warehouse_staff", "operator"]);
  if (!authUser) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const operator = await getOperator(authUser)
  const user = operator ?? authUser;

  const { line_item_id: parsedLineItemId } = await params;
  // Rebuild the full Shopify GID from the parsed ID
  const lineItemId = buildResourceGid("LineItem", parsedLineItemId);

  const body = await request.json();
  const parsed = markOosSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
  }

  const { batchId } = parsed.data;

  try {
    // 1. Get line item with related data
    const lineItem = await db.query.lineItems.findFirst({
      where: { id: lineItemId },
      with: {
        order: true,
      },
    });

    if (!lineItem) {
      return NextResponse.json({ data: null, error: "Line item not found" }, { status: 404 });
    }

    // 2. Check if item is already marked as oos_blank
    if (lineItem.completionStatus === "oos_blank") {
      return NextResponse.json({ data: null, error: "Item already marked as out of stock" }, { status: 400 });
    }

    // 3. Mark this line item as oos_blank
    await db.update(lineItems).set({ completionStatus: "oos_blank" }).where(eq(lineItems.id, lineItemId));

    // 4. Mark all other line items in this order as skipped
    // (because if one item is OOS, the whole order can't be completed)
    await db
      .update(lineItems)
      .set({ completionStatus: "skipped" })
      .where(and(eq(lineItems.orderId, lineItem.orderId), ne(lineItems.id, lineItemId)));

    // 5. Log the action
    await logger.info(
      `[assembly] ${lineItem.name} marked as out of stock by ${user.username}. Other items in order marked as skipped.`,
      {
        orderId: lineItem.orderId,
        profileId: user.id,
        category: "ASSEMBLY",
        metadata: { batchId },
        batchId,
      }
    );

    return NextResponse.json({
      data: {
        status: "oos_blank",
        lineItemId,
        inventoryChanged: false, // No inventory change for OOS
      },
      error: null,
    });
  } catch (error) {
    console.error("Error marking as OOS:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to mark as out of stock" },
      { status: 500 }
    );
  }
}

