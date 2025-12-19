import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { prodouctVariantSizeToBlankSize } from "@/lib/core/products/prodouct-variant-size-to-blank-size";
import { syncBlankSchema } from "@/lib/schemas/product-schema";
import { SyncBlankResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { blankVariants, products, productVariants } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ product_id: string }> }
): Promise<NextResponse<SyncBlankResponse>> {
  try {
    const user = await authorizeUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { product_id } = await params;
    const productGid = buildResourceGid("Product", product_id);

    const rawBody = await req.json();
    const validationResult = syncBlankSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
    }

    const { blank_id, color } = validationResult.data;

    // 1. Update product with blank_id
    await db.update(products).set({ blankId: blank_id }).where(eq(products.id, productGid));

    // 2. Fetch product variants and blank variants
    // We fetch the product with its variants to get the variant titles
    const productData = await db.query.products.findFirst({
      where: { id: productGid },
      with: {
        productVariants: true,
      },
    });

    if (!productData) {
      return NextResponse.json({ data: null, error: "Product not found" }, { status: 404 });
    }

    // Fetch blank variants for the given blank_id
    const blankVariantsData = await db.query.blankVariants.findMany({
      where: { blankId: blank_id },
    });

    if (!blankVariantsData || blankVariantsData.length === 0) {
      return NextResponse.json(
        { data: null, error: "No blank variants found for the selected blank" },
        { status: 404 }
      );
    }

    console.log("blank variants data", blankVariantsData);
    // 3. Match and update variants
    const updates = [];

    for (const pVariant of productData.productVariants) {
      const size = prodouctVariantSizeToBlankSize(pVariant.title.toLowerCase());

      if (!size) {
        console.warn(`Could not determine size for variant: ${pVariant.title}`);
        continue;
      }

      const matchingBlankVariant = blankVariantsData.find((bv) => {
        return bv.color.toLowerCase() === color.toLowerCase() && bv.size === size;
      });

      if (matchingBlankVariant) {
        updates.push(
          db
            .update(productVariants)
            .set({ blankVariantId: matchingBlankVariant.id })
            .where(eq(productVariants.id, pVariant.id))
        );
      } else {
        updates.push(
          db
            .update(productVariants)
            .set({ blankVariantId: null })
            .where(eq(productVariants.id, pVariant.id))
        );
        logger.warn(
          `No matching blank variant found for product variant: ${pVariant.title} (Color: ${color}, Size: ${size}) when trying to sync.`
        );
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error syncing blank to product:", error);
    return NextResponse.json({ data: null, error: "Failed to sync blank to product" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ product_id: string }> }
): Promise<NextResponse<SyncBlankResponse>> {
  try {
    const user = await authorizeUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { product_id } = await params;
    const productGid = buildResourceGid("Product", product_id);

    // 1. Unlink Product
    await db.update(products).set({ blankId: null }).where(eq(products.id, productGid));

    // 2. Unlink all variants for this product
    await db.update(productVariants).set({ blankVariantId: null }).where(eq(productVariants.productId, productGid));

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error disconnecting blank from product:", error);
    return NextResponse.json({ data: null, error: "Failed to disconnect blank from product" }, { status: 500 });
  }
}
