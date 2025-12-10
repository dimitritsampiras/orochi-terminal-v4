import { db } from "@/lib/clients/db";
import { NextResponse, type NextRequest } from "next/server";
import { products, productVariants } from "../../../../drizzle/schema";

import { and, asc, eq, gt, ilike, inArray } from "drizzle-orm";

import { createClient } from "@/lib/clients/supabase-server";
import { GetProductsResponse } from "@/lib/types/api";

export async function GET(request: NextRequest): Promise<NextResponse<GetProductsResponse>> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const PAGE_SIZE = 30;
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q");
  const allInStock = searchParams.get("allInStock") === "true";

  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1") || 1);

  const offset = (page - 1) * PAGE_SIZE;

  console.log("page", page, PAGE_SIZE, offset);
  try {
    if (allInStock) {
      // Return all products that have variants in stock, and only those variants
      const rows = await db
        .select({
          product: products,
          variant: productVariants,
        })
        .from(products)
        .innerJoin(productVariants, eq(products.id, productVariants.productId))
        .where(gt(productVariants.warehouseInventory, 0));

      const productMap = new Map<
        string,
        typeof products.$inferSelect & { variants: (typeof productVariants.$inferSelect)[] }
      >();

      for (const row of rows) {
        if (!productMap.has(row.product.id)) {
          productMap.set(row.product.id, { ...row.product, variants: [] });
        }
        productMap.get(row.product.id)!.variants.push(row.variant);
      }

      return NextResponse.json({
        data: Array.from(productMap.values()),
        error: null,
      });
    }

    // Normal pagination and search flow
    const whereConditions = [];
    if (q) {
      whereConditions.push(ilike(products.title, `%${q}%`));
    }

    const filteredProducts = await db
      .select()
      .from(products)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .limit(PAGE_SIZE)
      .offset(offset)
      .orderBy(asc(products.title));

    const productIds = filteredProducts.map((p) => p.id);
    let variants: (typeof productVariants.$inferSelect)[] = [];

    if (productIds.length > 0) {
      variants = await db.select().from(productVariants).where(inArray(productVariants.productId, productIds));
    }

    const data = filteredProducts.map((p) => ({
      ...p,
      variants: variants.filter((v) => v.productId === p.id),
    }));

    return NextResponse.json({
      data,
      error: null,
    });
  } catch (error) {
    console.log("error getting products", error);

    return NextResponse.json(
      {
        data: null,
        error: "Failed to get products",
      },
      {
        status: 500,
      }
    );
  }
}
