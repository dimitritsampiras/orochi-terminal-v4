import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { updateVariantSchema } from "@/lib/schemas/product-schema";
import { buildResourceGid } from "@/lib/utils";
import { productVariants } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ product_id: string; variant_id: string }> }
) {
  try {
    const user = await authorizeUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { variant_id } = await params;
    const variantGid = buildResourceGid("ProductVariant", variant_id);

    const rawBody = await req.json();
    const { warehouseInventory } = updateVariantSchema.parse(rawBody);

    let updatePayload: Partial<typeof productVariants.$inferInsert> = {};
    let logMessage = "";

    if (warehouseInventory !== undefined) {
      updatePayload.warehouseInventory = warehouseInventory;
      logMessage = `Product Variant ${variantGid} updated to ${warehouseInventory} by ${user.username}`;
    }

    await db.update(productVariants).set({ warehouseInventory }).where(eq(productVariants.id, variantGid));

    // Smart Logging: If we determined a semantic action occurred, log it
    if (logMessage) {
      // Fire and forget logging (don't await if you want faster response, or await for safety)
      await logger.info(logMessage, {
        profileId: user.id,
      });
    }
    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error updating variant:", error);
    return NextResponse.json({ data: null, error: "Failed to update variant" }, { status: 500 });
  }
}
