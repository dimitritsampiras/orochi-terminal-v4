import { NextRequest, NextResponse } from "next/server";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { db } from "@/lib/clients/db";
import { batches } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
import {
  getPremadeStockRequirements,
  premadeStockItemSchema,
  premadeStockRequirementsSchema,
} from "@/lib/core/session/get-premade-stock-requirements";
import { getBlankStockRequirements } from "@/lib/core/session/get-blank-stock-requirements";

import type {
  GetBlankStockRequirementsResponse,
  BlankStockItemWithInventory,
  VerifyBlankStockResponse,
} from "@/lib/types/api";

/**
 * GET /api/batches/[batch_id]/verify-blank-stock
 * Fetches blank stock requirements for the session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<GetBlankStockRequirementsResponse>> {
  const user = await authorizeApiUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id, 10);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  const batch = await db.query.batches.findFirst({
    where: { id: batchId },
  });

  if (!batch || !batch.premadeStockRequirementsJson) {
    return NextResponse.json({ data: null, error: "No premade stock requirements found" }, { status: 400 });
  }

  const { data: premadeStockRequirements } = premadeStockRequirementsSchema.safeParse(
    batch.premadeStockRequirementsJson
  );

  if (!premadeStockRequirements) {
    return NextResponse.json({ data: null, error: "Failed to parse premade stock requirements" }, { status: 500 });
  }

  try {
    const { data, error } = await getLineItemsByBatchId(batchId);

    if (error || !data) {
      return NextResponse.json({ data: null, error: error ?? "Failed to fetch line items" }, { status: 500 });
    }

    const { lineItems, batch } = data;

    // const premadeStock =

    // Then get blank requirements (excludes items fulfilled from premade stock)
    const { items, heldItems, unaccountedItems } = getBlankStockRequirements(lineItems, premadeStockRequirements.items);

    // Fetch inventory transactions for context
    const blankVariantIds = items.map((i) => i.blankVariantId);

    if (blankVariantIds.length === 0) {
      return NextResponse.json({ data: null, error: "No blank variants found" }, { status: 400 });
    }

    const currentTransactions = await db.query.inventoryTransactions.findMany({
      where: {
        blankVariantId: { in: blankVariantIds },
        batchId: batch.id,
        reason: { in: ["correction", "stock_take"] },
      },
    });

    // Build response items with transactions
    const itemsWithTransactions: BlankStockItemWithInventory[] = items.map((blankItem) => ({
      ...blankItem,
      inventoryTransactions: currentTransactions.filter((t) => t.blankVariantId === blankItem.blankVariantId),
    }));

    return NextResponse.json({
      data: {
        items: {
          blanks: itemsWithTransactions,
          held: heldItems,
          unaccounted: unaccountedItems,
        },
        isVerified: !!batch.blankStockVerifiedAt,
        verifiedAt: batch.blankStockVerifiedAt,
      },
      error: null,
    });
  } catch (error) {
    console.error("Error fetching blank stock requirements:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to fetch blank stock requirements" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/batches/[batch_id]/verify-blank-stock
 * Stores the blank stock requirements snapshot and marks session as verified
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<VerifyBlankStockResponse>> {
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
    const { data, error } = await getLineItemsByBatchId(batchId);

    if (error || !data) {
      return NextResponse.json({ data: null, error: error ?? "Failed to fetch line items" }, { status: 500 });
    }

    const { lineItems } = data;

    // Get premade stock first, then blank requirements
    const premadeStock = getPremadeStockRequirements(lineItems);
    const blankStock = getBlankStockRequirements(lineItems, premadeStock.items);

    // Store snapshot and mark as verified
    const verifiedAt = new Date();
    await db
      .update(batches)
      .set({
        blankStockVerifiedAt: verifiedAt,
        blankStockRequirementsJson: JSON.stringify(blankStock),
      })
      .where(eq(batches.id, batchId));

    return NextResponse.json({
      data: "success",
      error: null,
    });
  } catch (error) {
    console.error("Error applying blank stock verification:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to apply verification" },
      { status: 500 }
    );
  }
}
