import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";
import { logger } from "@/lib/core/logger";
import { markStockedSchema } from "@/lib/schemas/assembly-schema";
import { MarkStockedResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { lineItems } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ line_item_id: string }> }
): Promise<NextResponse<MarkStockedResponse>> {
  const user = await authorizeApiUser(["super_admin", "admin", "warehouse_staff"]);
  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { line_item_id: parsedLineItemId } = await params;
  // Rebuild the full Shopify GID from the parsed ID
  const lineItemId = buildResourceGid("LineItem", parsedLineItemId);

  const body = await request.json();
  const parsed = markStockedSchema.safeParse(body);

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
        product: true,
        productVariant: true,
      },
    });

    if (!lineItem) {
      return NextResponse.json({ data: null, error: "Line item not found" }, { status: 404 });
    }

    // 2. Check if item is already in_stock
    if (lineItem.completionStatus === "in_stock") {
      return NextResponse.json({ data: null, error: "Item already marked as in stock" }, { status: 400 });
    }

    const productVariantId = lineItem.variantId;

    if (!productVariantId) {
      return NextResponse.json({ data: null, error: "No product variant linked to this line item" }, { status: 400 });
    }

    // 3. Check if inventory was already adjusted for this line item
    const existingTransaction = await db.query.inventoryTransactions.findFirst({
      where: { lineItemId, reason: "assembly_usage" },
    });

    let inventoryChanged = false;

    // 4. Decrement product variant stock (only if not already done)
    if (!existingTransaction) {
      await adjustInventory({ type: "product", variantId: productVariantId }, -1, "assembly_usage", {
        profileId: user.id,
        batchId,
        lineItemId,
        logMessage: `[assembly] Pre-printed stock used for ${lineItem.name}`,
      });
      inventoryChanged = true;
    }

    // 5. Update line item status
    await db
      .update(lineItems)
      .set({
        completionStatus: "in_stock",
        hasDeprecatedVariantStock: true,
      })
      .where(eq(lineItems.id, lineItemId));

    // 6. Log the action
    await logger.info(`[assembly] ${lineItem.name} fulfilled from stock`, {
      orderId: lineItem.orderId,
      profileId: user.id,
      category: "ASSEMBLY",
    });

    return NextResponse.json({
      data: {
        status: "in_stock",
        lineItemId,
        inventoryChanged,
      },
      error: null,
    });
  } catch (error) {
    console.error("Error marking as stocked:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to mark as stocked" },
      { status: 500 }
    );
  }
}

