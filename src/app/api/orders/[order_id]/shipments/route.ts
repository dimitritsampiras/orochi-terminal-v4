import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { getRateForOrder, storeShipmentAndRate } from "@/lib/core/shipping/get-rate-for-order";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { CreateShipmentResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { NextResponse } from "next/server";

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ order_id: string }> }
): Promise<NextResponse<CreateShipmentResponse>> => {
  const user = await authorizeUser();
  if (!user) {
    return NextResponse.json<CreateShipmentResponse>({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const awaitedParams = await params;

  const orderId = buildResourceGid("Order", awaitedParams.order_id);

  const { data: order } = await shopify.request(orderQuery, {
    variables: {
      id: orderId,
    },
  });

  if (!order || order?.node?.__typename !== "Order") {
    return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 });
  }

  logger.info(`[create shipment] ${user.username} auto fetched shipment`, {
    category: "SHIPPING",
    orderId: order.node.id,
  });

  const { data, error } = await getRateForOrder(order.node);

  if (!data) {
    logger.error(`[create shipment] Error getting rate: ${error}`, {
      category: "SHIPPING",
      orderId: order.node.id,
    });
    return NextResponse.json({ data: null, error: error || "Unknown error" }, { status: 500 });
  }

  const { data: shipment, error: shipmentError } = await storeShipmentAndRate(order.node, data.rate, data.parcel);

  if (!shipment) {
    return NextResponse.json({ data: null, error: shipmentError || "Unknown error" }, { status: 500 });
  }

  logger.info(`[create shipment] Shipment auto-created by ${user.username}`, {
    category: "SHIPPING",
    orderId: order.node.id,
  });

  return NextResponse.json({ data: shipment, error: null });
};
