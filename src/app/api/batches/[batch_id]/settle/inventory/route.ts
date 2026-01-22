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
  const reqId = Math.random().toString(36).substring(7);
  console.log(`[settle/inventory:${reqId}] Request received`);

  const user = await authorizeApiUser(["super_admin", "admin"]);

  if (!user) {
    console.log(`[settle/inventory:${reqId}] Unauthorized`);
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id, 10);

  if (isNaN(batchId)) {
    console.log(`[settle/inventory:${reqId}] Invalid batch ID: ${batch_id}`);
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    console.log(`[settle/inventory:${reqId}] Body:`, JSON.stringify(body));

    const parsed = adjustSettlementInventorySchema.safeParse(body);

    if (!parsed.success) {
      console.log(`[settle/inventory:${reqId}] Validation failed:`, parsed.error.message);
      return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
    }

    const { targetType, targetId, changeAmount, lineItemId, notes } = parsed.data;
    console.log(`[settle/inventory:${reqId}] Parsed: targetType=${targetType}, targetId=${targetId}, changeAmount=${changeAmount}, lineItemId=${lineItemId}`);

    // Build target for adjustInventory
    const target =
      targetType === "blankVariant"
        ? { type: "blank" as const, variantId: targetId }
        : { type: "product" as const, variantId: targetId };

    const direction = changeAmount > 0 ? "increased" : "decreased";
    const logMessage = `[settlement] Inventory ${direction} by ${Math.abs(changeAmount)}${notes ? `: ${notes}` : ""
      } by ${user.username}`;

    console.log(`[settle/inventory:${reqId}] Calling adjustInventory...`);

    const result = await adjustInventory(target, changeAmount, "manual_adjustment", {
      profileId: user.id,
      batchId,
      lineItemId,
      logMessage,
    });

    console.log(`[settle/inventory:${reqId}] adjustInventory completed:`, result);

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error(`[settle/inventory:${reqId}] ERROR:`, error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to adjust inventory" },
      { status: 500 }
    );
  }
}
