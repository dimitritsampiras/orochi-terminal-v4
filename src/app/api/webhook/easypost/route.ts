// app/api/webhook/easypost/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/clients/db";
import { fulfillOrder } from "@/lib/core/orders/fulfill-order";
import { EasypostShipmentStatus } from "@/lib/types/shipping.types";

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
  description: z.string(),
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
  try {
    const rawBody = await request.json();
    const parsedBody = easypostEventSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      console.log("[easypost webhook] Invalid event payload", parsedBody.error.message);
      return new NextResponse("OK", { status: 200 });
    }

    const event = parsedBody.data;
    if (event.description !== "tracker.updated") {
      return new NextResponse("OK", { status: 200 });
    }

    const tracker = event.result;
    const trackingNumber = tracker.tracking_code;
    const status = tracker.status;
    const carrier = tracker.carrier ?? "EASYPOST";

    if (!tracker.shipment_id) {
      console.log("[easypost webhook] No shipment_id in tracker, skipping");
      return new NextResponse("OK", { status: 200 });
    }

    const shipment = await db.query.shipments.findFirst({
      where: {
        OR: [{ trackingNumber }, ...(tracker.shipment_id ? [{ shipmentId: tracker.shipment_id }] : [])],
        api: "EASYPOST",
      },
      with: { order: true },
    });

    if (!shipment) {
      console.log("[easypost webhook] Shipment not found for", trackingNumber);
      return new NextResponse("OK", { status: 200 });
    }

    const order = shipment.order;
    if (!order) {
      console.log("[easypost webhook] Order not found for shipment", shipment.id);
      return new NextResponse("OK", { status: 200 });
    }

    const isPositiveStatus = status === "in_transit" || status === "delivered";
    if (isPositiveStatus && order.displayFulfillmentStatus !== "FULFILLED" && order.displayIsCancelled === false) {
      await fulfillOrder(order.id, {
        company: carrier,
        number: shipment.trackingNumber ?? "",
      });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (e) {
    console.error("[easypost webhook] Error", e);
    return new NextResponse("OK", { status: 200 });
  }
}
