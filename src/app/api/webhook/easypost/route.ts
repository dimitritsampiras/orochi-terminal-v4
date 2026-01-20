// app/api/webhook/easypost/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import EasyPostClient from "@easypost/api";
import { db } from "@/lib/clients/db";
import { fulfillOrder } from "@/lib/core/orders/fulfill-order";
import { EasypostShipmentStatus } from "@/lib/types/shipping.types";
import { eq, or } from "drizzle-orm";

const easypostTrackingStatuses = [
  "unknown",
  "pre_transit",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "return_to_sender",
  "failure",
  "cancelled",
] as [EasypostShipmentStatus, ...EasypostShipmentStatus[]];

const easypostEventSchema = z.object({
  id: z.string(),
  object: z.literal("Event"),
  description: z.enum(["tracker.updated"]),
  result: z.object({
    id: z.string(),
    object: z.literal("Tracker"),
    tracking_code: z.string(),
    status: z.enum(easypostTrackingStatuses),
    carrier: z.string().nullable(),
    shipment_id: z.string().nullable().optional(),
    public_url: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  const rawBody = await request.json();

  const parsedBody = easypostEventSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return new NextResponse("Invalid event payload", { status: 400 });
  }

  const event = parsedBody.data;

  // 4) Only handle tracker.updated events
  if (event.description !== "tracker.updated") {
    return new NextResponse("Ignored event type", { status: 200 });
  }

  const tracker = event.result;
  const trackingNumber = tracker.tracking_code;
  const status = tracker.status;
  const carrier = tracker.carrier ?? "EASYPOST";

  if (!tracker.shipment_id) {
    return new NextResponse("Shipment ID not found", { status: 404 });
  }

  const shipment = await db.query.shipments.findFirst({
    where: {
      OR: [{ trackingNumber: trackingNumber }, { shipmentId: tracker.shipment_id ?? undefined }],
      api: "EASYPOST",
    },
    with: {
      order: true,
    },
  });

  if (!shipment) {
    return new NextResponse("Shipment not found", { status: 404 });
  }

  const order = shipment.order;

  if (!order) {
    return new NextResponse("Order not found", { status: 404 });
  }

  const isPositiveStatus = status === "in_transit" || status === "delivered";

  if (isPositiveStatus && order.displayFulfillmentStatus !== "FULFILLED" && order.displayIsCancelled === false) {
    await fulfillOrder(order.id, {
      company: carrier,
      number: shipment.trackingNumber,
    });
  }

  return new NextResponse("OK", { status: 200 });
}
