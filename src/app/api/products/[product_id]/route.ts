import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { updateProductSchema } from "@/lib/schemas/product-schema";
import { buildResourceGid } from "@/lib/utils";
import { products } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ product_id: string }> }) {
  try {
    const user = await authorizeUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { product_id } = await params;

    const productGid = buildResourceGid("Product", product_id);

    const rawBody = await req.json();
    const { isBlackLabel } = updateProductSchema.parse(rawBody);

    let updatePayload: Partial<typeof products.$inferInsert> = {};
    let logMessage = "";

    if (isBlackLabel !== undefined) {
      updatePayload.isBlackLabel = isBlackLabel;
      logMessage = `Product ${product_id} isBlackLabel updated to ${isBlackLabel} by ${user.username}`;
    }

    await db.update(products).set(updatePayload).where(eq(products.id, productGid));

    // Smart Logging: If we determined a semantic action occurred, log it
    if (logMessage) {
      // Fire and forget logging (don't await if you want faster response, or await for safety)
      await logger.info(logMessage, {
        profileId: user.id,
      });
    }
    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ data: null, error: "Failed to update product" }, { status: 500 });
  }
}
