import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";
import { updateBlankVariantSchema } from "@/lib/schemas/product-schema";
import { blankVariants } from "@drizzle/schema";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { DeleteBlankVariantResponse } from "@/lib/types/api";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ blank_id: string; blank_variant_id: string }> }
) {
  try {
    const user = await authorizeApiUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { blank_variant_id, blank_id } = await params;

    const rawBody = await req.json();
    const { newQuantity, weight, volume, batchId } = updateBlankVariantSchema.parse(rawBody);

    // Handle quantity update via adjustInventory
    if (newQuantity !== undefined) {
      const currentVariant = await db.query.blankVariants.findFirst({
        where: { id: blank_variant_id },
        columns: { quantity: true, color: true, size: true },
      });

      if (!currentVariant) {
        return NextResponse.json({ data: null, error: "Blank variant not found" }, { status: 404 });
      }

      const delta = newQuantity - currentVariant.quantity;

      if (delta !== 0) {
        await adjustInventory({ type: "blank", variantId: blank_variant_id }, delta, "correction", {
          profileId: user.id,
          batchId,
          logMessage: `Blank inventory correction: ${currentVariant.color}/${currentVariant.size} changed from ${currentVariant.quantity} to ${newQuantity} by ${user.username}`,
        });
      }
    }

    // Handle other field updates
    let updatePayload: Partial<typeof blankVariants.$inferInsert> = {};
    const logMessages: string[] = [];

    if (weight !== undefined) {
      updatePayload.weight = weight;
      logMessages.push(`weight to ${weight}oz`);
    }

    if (volume !== undefined) {
      updatePayload.volume = volume;
      logMessages.push(`volume to ${volume}`);
    }

    if (Object.keys(updatePayload).length > 0) {
      await db
        .update(blankVariants)
        .set(updatePayload)
        .where(and(eq(blankVariants.id, blank_variant_id), eq(blankVariants.blankId, blank_id)));

      if (logMessages.length > 0) {
        await logger.info(`Blank Variant ${blank_variant_id} updated: ${logMessages.join(", ")} by ${user.username}`, {
          profileId: user.id,
        });
      }
    }

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error updating blank variant:", error);
    return NextResponse.json({ data: null, error: "Failed to update blank variant" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ blank_id: string; blank_variant_id: string }> }
): Promise<NextResponse<DeleteBlankVariantResponse>> {
  try {
    const user = await authorizeApiUser(["super_admin", "admin"]);

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { blank_variant_id, blank_id } = await params;

    await db
      .delete(blankVariants)
      .where(and(eq(blankVariants.id, blank_variant_id), eq(blankVariants.blankId, blank_id)));

    await logger.info(`Blank Variant ${blank_variant_id} deleted by ${user.username}`, {
      profileId: user.id,
    });

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error deleting blank variant:", error);
    return NextResponse.json({ data: null, error: "Failed to delete blank variant" }, { status: 500 });
  }
}
