import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { GetProductsResponse } from "@/lib/types/api";
import { type NextRequest, NextResponse } from "next/server";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest): Promise<NextResponse<GetProductsResponse>> {
  try {
    const user = await authorizeApiUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const query = searchParams.get("q") || "";

    const offset = (page - 1) * PAGE_SIZE;

    const products = await db.query.products.findMany({
      limit: PAGE_SIZE,
      offset: offset,
      with: {
        productVariants: true,
      },
      orderBy: { createdAt: "desc" },
      where: query
        ? {
            OR: [
              {
                title: {
                  ilike: `%${query}%`,
                },
              },
              {
                id: {
                  ilike: `%${query}%`,
                },
              },
            ],
          }
        : undefined,
    });

    // Transform the data to match the expected response format
    // The response expects variants to be named "variants" not "productVariants"
    const transformedProducts = products.map(({ productVariants, ...product }) => ({
      ...product,
      variants: productVariants,
    }));

    return NextResponse.json({ data: transformedProducts, error: null });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ data: null, error: "Failed to fetch products" }, { status: 500 });
  }
}

