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

  const { batchId, reduceInventory } = parsed.data;

  try {
    // 1. Get line item with related data
    const lineItem = await db.query.lineItems.findFirst({
      where: { id: lineItemId },
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

    let inventoryChanged = false;

    // 3. Optionally reduce product variant inventory
    if (reduceInventory) {
      await adjustInventory(
        { type: "product", variantId: productVariantId },
        -1,
        "assembly_usage",
        {
          profileId: user.id,
          batchId,
          lineItemId,
          logMessage: `[assembly] Reduced product inventory for ${lineItem.name} (fulfilled from stock)`,
        }
      );
      inventoryChanged = true;
    }

    // 4. Update line item status
    await db
      .update(lineItems)
      .set({
        completionStatus: "in_stock",
      })
      .where(eq(lineItems.id, lineItemId));

    // 5. Log the action
    await logger.info(`[assembly] ${lineItem.name} fulfilled from stock${reduceInventory ? " (inventory reduced)" : ""}`, {
      orderId: lineItem.orderId,
      profileId: user.id,
      lineItemId,
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

