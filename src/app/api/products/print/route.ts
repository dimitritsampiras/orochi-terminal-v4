import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";
import { logger } from "@/lib/core/logger";
import { printProductSchema } from "@/lib/schemas/product-schema";
import { PrintProductResponse } from "@/lib/types/api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse<PrintProductResponse>> {
  // const { product_id, print_id } = await req.json();
  const user = await authorizeApiUser(["admin", "super_admin", "warehouse_staff"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.json();
  const { data: body } = printProductSchema.safeParse(rawBody);

  if (!body) {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }

  const productVariant = await db.query.productVariants.findFirst({
    where: { id: body.product_variant_id },
    with: {
      blankVariant: true,
      product: true,
    },
  });

  if (!productVariant) {
    return NextResponse.json({ data: null, error: "Product variant not found" }, { status: 404 });
  }

  if (productVariant.product?.isBlackLabel) {
    return NextResponse.json({ data: null, error: "Cannot print black label products" }, { status: 400 });
  }

  if (!productVariant.blankVariantId) {
    return NextResponse.json({ data: null, error: "Product has no blank" }, { status: 400 });
  }

  const logMessage = `[print] ${productVariant.title} was printed | ${body.reason}`;

  await adjustInventory({ type: "blank", variantId: productVariant.blankVariantId }, -1, "manual_print", {
    profileId: user.id,
    batchId: body.batch_id,
    lineItemId: body.line_item_id,
    logMessage: logMessage,
  });

  return NextResponse.json({ data: "success", error: null });
}
