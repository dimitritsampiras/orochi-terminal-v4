import shopify from "@/lib/clients/shopify";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { getRateForOrder } from "@/lib/core/shipping/get-rate-for-order";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { getRatesSchema } from "@/lib/schemas/order-schema";
import { GetRateResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ order_id: string }> }
): Promise<NextResponse<GetRateResponse>> {
  try {
    const user = await authorizeUser();
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { order_id } = await params;
    const orderId = buildResourceGid("Order", order_id);

    const body = await request.json();
    const { data: parsedData, error: lineItemIdsError } = getRatesSchema.safeParse(body);

    if (!parsedData?.lineItemIds) {
      return NextResponse.json({ data: null, error: "Invalid request" }, { status: 400 });
    }

    const { lineItemIds } = parsedData;

    const { data: shopifyData } = await shopify.request(orderQuery, {
      variables: { id: orderId },
    });

    if (!shopifyData || shopifyData.node?.__typename !== "Order") {
      return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 });
    }

    const order = shopifyData.node;

    logger.info(`[fetch rates] ${user.username} manually fetched rates for ${lineItemIds.length} item(s)`, {
      category: "SHIPPING",
      orderId: order.id,
    });

    const { data, error } = await getRateForOrder(order, {
      targetLineItemIds: lineItemIds,
    });

    if (!data) {
      return NextResponse.json({ data: null, error: error || "Failed to fetch rates" }, { status: 500 });
    }

    // Sort all rates by cost (cheapest first)
    const sortedRates = data.otherRates.toSorted((a, b) => a.cost - b.cost);

    return NextResponse.json({
      data: {
        rate: data.rate,
        otherRates: sortedRates,
        parcel: data.parcel,
      },
      error: null,
    });
  } catch (error) {
    console.error("Error fetching rates:", error);
    return NextResponse.json({ data: null, error: "Failed to fetch rates" }, { status: 500 });
  }
}
