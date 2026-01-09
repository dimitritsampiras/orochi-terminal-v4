import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { GetOrdersResponse } from "@/lib/types/api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse<GetOrdersResponse>> {
  const user = await authorizeApiUser();

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const defaultStartDate = new Date("2024-01-01");

  const startDateParam = searchParams.get("start_date");
  const endDateParam = searchParams.get("end_date");

  const startDate = startDateParam ? new Date(startDateParam) : defaultStartDate;
  const endDate = endDateParam ? new Date(endDateParam) : new Date();

  try {
    const orders = await db.query.orders.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        displayIsCancelled: false,
        queued: true,
      },
      with: {
        batches: {
          columns: {
            id: true,
            createdAt: true,
          },
        },
        lineItems: {
          columns: {
            id: true,
            name: true,
            productId: true,
            quantity: true,
            requiresShipping: true
          },
          with: {
            productVariant: {
              columns: {
                blankVariantId: true,
                id: true,
              },
            },
            product: {
              columns: {
                id: true,
                isBlackLabel: true,
                blankId: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: orders, error: null });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
