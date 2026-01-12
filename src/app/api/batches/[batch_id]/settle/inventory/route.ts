import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";
import { adjustSettlementInventorySchema } from "@/lib/schemas/batch-schema";
import { AdjustSettlementInventoryResponse } from "@/lib/types/api";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/batches/[batch_id]/settle/inventory
 *
 * Adds an inventory correction transaction as part of session settlement.
 * Uses the adjustInventory function to create a proper transaction trail.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<AdjustSettlementInventoryResponse>> {
  const user = await authorizeApiUser(["super_admin", "admin"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id, 10);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = adjustSettlementInventorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
    }

    const { targetType, targetId, changeAmount, lineItemId, notes } = parsed.data;

    // Build target for adjustInventory
    const target =
      targetType === "blankVariant"
        ? { type: "blank" as const, variantId: targetId }
        : { type: "product" as const, variantId: targetId };

    const direction = changeAmount > 0 ? "increased" : "decreased";
    const logMessage = `[settlement] Inventory ${direction} by ${Math.abs(changeAmount)}${
      notes ? `: ${notes}` : ""
    } by ${user.username}`;

    console.log(batchId, lineItemId);

    await adjustInventory(target, changeAmount, "manual_adjustment", {
      profileId: user.id,
      batchId,
      lineItemId,
      logMessage,
    });

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error("Error adjusting inventory:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to adjust inventory" },
      { status: 500 }
    );
  }
}
