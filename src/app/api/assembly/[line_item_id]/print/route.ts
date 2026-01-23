import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { getOperator } from "@/lib/core/auth/get-operators";
import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";
import { logger } from "@/lib/core/logger";
import { markPrintedSchema } from "@/lib/schemas/assembly-schema";
import { MarkPrintedResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { lineItems, printLogs } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ line_item_id: string }> }
): Promise<NextResponse<MarkPrintedResponse>> {
  const authUser = await authorizeApiUser(["super_admin", "admin", "warehouse_staff", "operator"]);
  if (!authUser) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const operator = await getOperator(authUser)
  const user = operator ?? authUser;

  const { line_item_id: parsedLineItemId } = await params;
  const lineItemId = buildResourceGid("LineItem", parsedLineItemId);

  const body = await request.json();
  const parsed = markPrintedSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
  }

  const { printId, batchId, skipInventoryAdjustment } = parsed.data;

  try {
    // 1. Get line item with related data
    const lineItem = await db.query.lineItems.findFirst({
      where: { id: lineItemId },
      with: {
        order: true,
        product: { with: { prints: true } },
        productVariant: { with: { blankVariant: true } },
      },
    });

    if (!lineItem) {
      return NextResponse.json({ data: null, error: "Line item not found" }, { status: 404 });
    }

    const blankVariant = lineItem.productVariant?.blankVariant;
    const blankVariantId = blankVariant?.id;

    // 2. Check if this print was already logged as active
    const existingPrintLog = await db.query.printLogs.findFirst({
      where: { lineItemId, printId, active: true },
    });

    if (existingPrintLog) {
      return NextResponse.json({ data: null, error: "Print already marked as completed" }, { status: 400 });
    }

    // 3. Create print log
    await db.insert(printLogs).values({
      lineItemId,
      printId,
      active: true,
    });

    let inventoryChanged = false;

    // 4. Determine if we should decrement blank inventory
    // Logic mirrors old SvelteKit: decrement if (!hasDeprecatedBlankStock || userExplicitlyChoseToDecrement)
    // - If hasDeprecatedBlankStock is false → always decrement (first print)
    // - If hasDeprecatedBlankStock is true AND status is partially_printed → don't decrement (same blank, different print location)
    // - If hasDeprecatedBlankStock is true AND status is NOT partially_printed → user was prompted, respect skipInventoryAdjustment
    const shouldDecrementBlank =
      blankVariantId &&
      (!lineItem.hasDeprecatedBlankStock ||
        (lineItem.completionStatus !== "partially_printed" && !skipInventoryAdjustment));

    if (shouldDecrementBlank) {
      await adjustInventory({ type: "blank", variantId: blankVariantId }, -1, "assembly_usage", {
        profileId: user.id,
        batchId,
        lineItemId,
        orderIdForLog: lineItem.orderId,
        logMessage: `[assembly] Blank used for ${lineItem.name} by ${user.username} due to print.`,
      });
      inventoryChanged = true;
    }

    // 5. Update line item status
    const activePrintLogs = await db.query.printLogs.findMany({
      where: { lineItemId, active: true },
    });

    const totalPrints = lineItem.product?.prints?.length ?? 0;
    const newStatus = activePrintLogs.length >= totalPrints ? "printed" : "partially_printed";

    // Only set hasDeprecatedBlankStock to true if we actually decremented (or it was already true)
    await db
      .update(lineItems)
      .set({
        completionStatus: newStatus,
        hasDeprecatedBlankStock: lineItem.hasDeprecatedBlankStock || inventoryChanged,
      })
      .where(eq(lineItems.id, lineItemId));

    // 6. Log the action
    await logger.info(`[assembly] ${lineItem.name} marked as ${newStatus} by ${user.username}. ${skipInventoryAdjustment ? "Inventory adjustment was skipped" : ""}`, {
      orderId: lineItem.orderId,
      profileId: user.id,
      lineItemId,
      batchId,
      category: "ASSEMBLY",
    });

    return NextResponse.json({
      data: {
        status: newStatus,
        lineItemId,
        inventoryChanged,
      },
      error: null,
    });
  } catch (error) {
    console.error("Error marking print:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to mark print" },
      { status: 500 }
    );
  }
}

