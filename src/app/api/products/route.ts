import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { GetProductsResponse } from "@/lib/types/api";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse<GetProductsResponse>> {
  try {
    const user = await authorizeApiUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;

    const query = searchParams.get("q") || "";

    const products = await db.query.products.findMany({
      with: {
        productVariants: true,
      },
      orderBy: { createdAt: "desc" },
      where: {
        status: 'ACTIVE',
        title: {
          ilike: `%${query}%`,
        },
      }
    });

    return NextResponse.json({ data: products, error: null });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ data: null, error: "Failed to fetch products" }, { status: 500 });
  }
}

