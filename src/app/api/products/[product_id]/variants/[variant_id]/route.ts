import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";
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
    const user = await authorizeApiUser(['admin', 'super_admin']);

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { variant_id } = await params;
    const variantGid = buildResourceGid("ProductVariant", variant_id);

    const variant = await db.query.productVariants.findFirst({
      where: { id: variantGid },
    });

    if (!variant) {
      return NextResponse.json({ data: null, error: "Variant not found" }, { status: 404 });
    }

    const rawBody = await req.json();
    const { batchId, newInventory } = updateVariantSchema.parse(rawBody);

    let updatePayload: Partial<typeof productVariants.$inferInsert> = {};
    let logMessage = "";

    if (newInventory !== undefined) {
      await adjustInventory(
        { type: "product", variantId: variantGid },
        newInventory - variant.warehouseInventory,
        "correction",
        {
          profileId: user.id,
          batchId,
          logMessage: `Product Variant ${variantGid} updated to ${newInventory} by ${user.username}`,
        }
      );
    }

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error updating variant:", error);
    return NextResponse.json({ data: null, error: "Failed to update variant" }, { status: 500 });
  }
}
