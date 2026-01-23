import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { getOperator } from "@/lib/core/auth/get-operators";
import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";
import { logger } from "@/lib/core/logger";
import { reportMisprintSchema } from "@/lib/schemas/assembly-schema";
import { ReportMisprintResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ line_item_id: string }> }
): Promise<NextResponse<ReportMisprintResponse>> {
  const authUser = await authorizeApiUser(["super_admin", "admin", "warehouse_staff", "operator"]);
  if (!authUser) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const operator = await getOperator(authUser);
  const user = operator ?? authUser;

  const { line_item_id: parsedLineItemId } = await params;
  const lineItemId = buildResourceGid("LineItem", parsedLineItemId);

  const body = await request.json();
  const parsed = reportMisprintSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
  }

  const { batchId, notes } = parsed.data;

  try {
    // 1. Get line item with related data
    const lineItem = await db.query.lineItems.findFirst({
      where: { id: lineItemId },
      with: {
        productVariant: { with: { blankVariant: true } },
      },
    });

    if (!lineItem) {
      return NextResponse.json({ data: null, error: "Line item not found" }, { status: 404 });
    }

    const blankVariant = lineItem.productVariant?.blankVariant;
    const blankVariantId = blankVariant?.id;

    if (!blankVariantId) {
      return NextResponse.json({ data: null, error: "No blank variant linked to this line item" }, { status: 400 });
    }

    // 2. Adjust blank inventory by -1 with reason "misprint"
    await adjustInventory(
      { type: "blank", variantId: blankVariantId },
      -1,
      "misprint",
      {
        profileId: user.id,
        batchId,
        orderIdForLog: lineItem.orderId,
        lineItemId,
        logMessage: `[assembly] Inventory adjusted for misprint: ${lineItem.name}`,
      }
    );

    // 3. Log the action
    await logger.info(`[assembly] Misprint reported for ${lineItem.name} by ${user.username}: ${notes}`, {
      orderId: lineItem.orderId,
      profileId: user.id,
      lineItemId,
      category: "ASSEMBLY",
      batchId,
    });

    return NextResponse.json({
      data: {
        status: lineItem.completionStatus,
        lineItemId,
        inventoryChanged: true,
      },
      error: null,
    });
  } catch (error) {
    console.error("Error reporting misprint:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to report misprint" },
      { status: 500 }
    );
  }
}
