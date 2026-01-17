import { NextRequest, NextResponse } from "next/server";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { db } from "@/lib/clients/db";
import { batches } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
import { createPickingRequirements } from "@/lib/core/session/create-picking-requirements";
import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";

import type {
  GetPremadeStockRequirementsResponse,
  VerifyPremadeStockResponse,
  PremadeStockItemWithInventory,
} from "@/lib/types/api";
import { getPremadeStockRequirements } from "@/lib/core/session/get-premade-stock-requirements";

/**
 * GET /api/batches/[batch_id]/verify-premade-stock
 * Fetches premade stock requirements for the session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<GetPremadeStockRequirementsResponse>> {
  const user = await authorizeApiUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id, 10);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  try {
    // Get line items for the batch
    const { data, error } = await getLineItemsByBatchId(batchId);

    if (error || !data) {
      return NextResponse.json({ data: null, error: error ?? "Failed to fetch line items" }, { status: 500 });
    }

    const { lineItems, batch } = data;

    // Create picking requirements to get aggregated stock list
    const { items, heldItems, unaccountedItems } = getPremadeStockRequirements(lineItems);

    // Get current inventory for all product variants
    const productVariantIds = items.map((item) => item.productVariantId);

    if (productVariantIds.length === 0) {
      return NextResponse.json({ data: null, error: "No products found" }, { status: 400 });
    }

    const currentInventories = await db.query.productVariants.findMany({
      where: { id: { in: productVariantIds } },
      columns: { id: true, warehouseInventory: true },
    });

    const currentTransactions = await db.query.inventoryTransactions.findMany({
      where: {
        productVariantId: { in: productVariantIds },
        batchId: batch.id,
        reason: { in: ["correction", "stock_take"] },
      },
    });

    const inventoryMap = new Map(currentInventories.map((pv) => [pv.id, pv.warehouseInventory]));

    // Build response items
    const itemWithInventory: PremadeStockItemWithInventory[] = items.map((stockItem) => ({
      ...stockItem,
      currentInventory: inventoryMap.get(stockItem.productVariantId) ?? 0,
      inventoryTransactions: currentTransactions.filter((t) => t.productVariantId === stockItem.productVariantId),
    }));

    // Sort: overstock first (non-black label), then black label
    items.sort((a, b) => {
      if (a.isBlackLabel !== b.isBlackLabel) {
        return a.isBlackLabel ? 1 : -1;
      }
      return a.productName.localeCompare(b.productName);
    });

    return NextResponse.json({
      data: {
        items: {
          premade: itemWithInventory,
          held: heldItems,
          unaccounted: unaccountedItems,
        },
        isVerified: !!batch.premadeStockVerifiedAt,
        verifiedAt: batch.premadeStockVerifiedAt,
      },
      error: null,
    });
  } catch (error) {
    console.error("Error fetching premade stock requirements:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to fetch premade stock requirements" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/batches/[batch_id]/verify-premade-stock
 * Stores the premade stock requirements snapshot and marks session as verified
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<VerifyPremadeStockResponse>> {
  const user = await authorizeApiUser(["admin", "super_admin"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id, 10);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  try {
    // Fetch line items to get current requirements
    const { data, error } = await getLineItemsByBatchId(batchId);

    if (error || !data) {
      return NextResponse.json({ data: null, error: error ?? "Failed to fetch line items" }, { status: 500 });
    }

    const { lineItems } = data;

    // Get premade stock requirements and store as snapshot
    const snapshot = getPremadeStockRequirements(lineItems);


    // Store snapshot and mark as verified
    const verifiedAt = new Date();
    await db
      .update(batches)
      .set({
        premadeStockVerifiedAt: verifiedAt,
        premadeStockRequirementsJson: JSON.stringify(snapshot),
      })
      .where(eq(batches.id, batchId));

    return NextResponse.json({
      data: "success",
      error: null,
    });
  } catch (error) {
    console.error("Error applying premade stock verification:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to apply verification" },
      { status: 500 }
    );
  }
}
