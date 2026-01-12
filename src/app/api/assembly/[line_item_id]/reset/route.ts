import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";
import { logger } from "@/lib/core/logger";
import { resetLineItemSchema } from "@/lib/schemas/assembly-schema";
import { ResetLineItemResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { lineItems, printLogs } from "@drizzle/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ line_item_id: string }> }
): Promise<NextResponse<ResetLineItemResponse>> {
  const user = await authorizeApiUser(["super_admin", "admin", "warehouse_staff"]);
  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { line_item_id: parsedLineItemId } = await params;
  const lineItemId = buildResourceGid("LineItem", parsedLineItemId);

  const body = await request.json();
  const parsed = resetLineItemSchema.safeParse(body);

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
        productVariant: true,
      },
    });

    if (!lineItem) {
      return NextResponse.json({ data: null, error: "Line item not found" }, { status: 404 });
    }

    // 2. Check if item is already not_printed
    if (lineItem.completionStatus === "not_printed") {
      return NextResponse.json({ data: null, error: "Item is already in not_printed status" }, { status: 400 });
    }

    const previousStatus = lineItem.completionStatus;
    let inventoryChanged = false;

    // 3. Special case: If was "in_stock", increment product variant inventory back
    // This matches the old SvelteKit behavior - only product variant gets restored, not blank
    if (previousStatus === "in_stock" && lineItem.productVariant) {
      await adjustInventory(
        { type: "product", variantId: lineItem.productVariant.id },
        1, // Add back the stock
        "correction",
        {
          profileId: user.id,
          batchId,
          lineItemId,
          logMessage: `[assembly] Reset ${lineItem.name} from in_stock by ${user.username} - product inventory restored`,
        }
      );
      inventoryChanged = true;
    }

    // 4. If item was oos_blank, reset other skipped items in the order too
    if (previousStatus === "oos_blank" && lineItem.orderId) {
      await db
        .update(lineItems)
        .set({ completionStatus: "not_printed" })
        .where(and(eq(lineItems.orderId, lineItem.orderId), eq(lineItems.completionStatus, "skipped")));
    }

    // 5. Deactivate all print logs for this line item
    await db.update(printLogs).set({ active: false }).where(eq(printLogs.lineItemId, lineItemId));

    // 6. Reset line item status
    // Note: We do NOT reset hasDeprecatedBlankStock - this is intentional!
    // The "already printed" dialog will appear on next print attempt,
    // giving the user the choice to decrement blank again or not.
    await db
      .update(lineItems)
      .set({
        completionStatus: "not_printed",
        // Only reset variant stock flag if we actually restored it
        hasDeprecatedVariantStock: previousStatus === "in_stock" ? false : lineItem.hasDeprecatedVariantStock,
      })
      .where(eq(lineItems.id, lineItemId));

    // 7. Log the action
    await logger.info(`[assembly] ${lineItem.name} reset to not_printed (was ${previousStatus}) by ${user.username}`, {
      orderId: lineItem.orderId,
      profileId: user.id,
      category: "ASSEMBLY",
      metadata: { batchId, previousStatus, inventoryRestored: inventoryChanged },
    });

    return NextResponse.json({
      data: {
        status: "not_printed",
        lineItemId,
        inventoryChanged,
      },
      error: null,
    });
  } catch (error) {
    console.error("Error resetting line item:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to reset line item" },
      { status: 500 }
    );
  }
}

