import { getOrderQueue } from "@/lib/core/orders/get-order-queue";
import { QueueResponse } from "@/lib/types/api";
import { NextRequest, NextResponse } from "next/server";

// this url takes in a withItemData boolean url param
export const GET = async (request: NextRequest): Promise<NextResponse<QueueResponse>> => {
  const { searchParams } = request.nextUrl;
  const withItemData = searchParams.get("withItemData") === "true";
  const queue = await getOrderQueue();

  if (!queue) {
    return NextResponse.json({ data: null, error: "Error getting order queue" }, { status: 500 });
  }

  return NextResponse.json({ data: queue, error: null });
};
