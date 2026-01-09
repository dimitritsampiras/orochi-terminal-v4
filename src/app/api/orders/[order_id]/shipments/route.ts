import shopify from "@/lib/clients/shopify";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { getRateForOrder, storeShipmentAndRate } from "@/lib/core/shipping/get-rate-for-order";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { createShipmentSchema } from "@/lib/schemas/order-schema";
import { CreateShipmentResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { NextResponse } from "next/server";

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ order_id: string }> }
): Promise<NextResponse<CreateShipmentResponse>> => {
  const user = await authorizeApiUser();
  if (!user) {
    return NextResponse.json<CreateShipmentResponse>({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const awaitedParams = await params;
  const orderId = buildResourceGid("Order", awaitedParams.order_id);

  const { data: shopifyOrder } = await shopify.request(orderQuery, {
    variables: { id: orderId },
  });

  if (!shopifyOrder || shopifyOrder.node?.__typename !== "Order") {
    return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 });
  }

  const order = shopifyOrder.node;

  const rawBody = await req.json().catch(() => ({}));
  const { data: parsedData, error: parseError } = createShipmentSchema.safeParse(rawBody);

  if (!parsedData) {
    console.log("invalid request", parseError);
    return NextResponse.json({ data: null, error: parseError?.message || "Invalid request" }, { status: 400 });
  }

  const { customShipment } = parsedData;

  // Custom shipment: rate + parcel provided directly, just store it
  if (customShipment) {
    logger.info(`[create shipment] ${user.username} creating custom shipment with ${customShipment.rate.carrierName}`, {
      category: "SHIPPING",
      orderId: order.id,
    });

    const { data: shipment, error: shipmentError } = await storeShipmentAndRate(
      order,
      customShipment.rate,
      customShipment.parcel
    );

    if (!shipment) {
      return NextResponse.json({ data: null, error: shipmentError || "Failed to store shipment" }, { status: 500 });
    }

    logger.info(`[create shipment] Custom shipment created by ${user.username}`, {
      category: "SHIPPING",
      orderId: order.id,
    });

    return NextResponse.json({ data: shipment, error: null });
  }

  // Auto shipment: fetch rate automatically
  logger.info(`[create shipment] ${user.username} auto-creating shipment`, {
    category: "SHIPPING",
    orderId: order.id,
  });

  const { data, error } = await getRateForOrder(order);

  if (!data) {
    logger.error(`[create shipment] Error getting rate: ${error}`, {
      category: "SHIPPING",
      orderId: order.id,
    });
    return NextResponse.json({ data: null, error: error || "Failed to get rate" }, { status: 500 });
  }

  const { data: shipment, error: shipmentError } = await storeShipmentAndRate(order, data.rate, data.parcel);

  if (!shipment) {
    return NextResponse.json({ data: null, error: shipmentError || "Failed to store shipment" }, { status: 500 });
  }

  logger.info(`[create shipment] Shipment auto-created by ${user.username}`, {
    category: "SHIPPING",
    orderId: order.id,
  });

  return NextResponse.json({ data: shipment, error: null });
};
