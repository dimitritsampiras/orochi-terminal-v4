import { db } from "@/lib/clients/db";

import { fulfillOrder } from "@/lib/core/orders/fulfill-order";
import { NextRequest, NextResponse } from "next/server";
import { TrackingStatus } from "shippo";
import z from "zod";

const trackingStatuses = ["DELIVERED", "FAILURE", "TRANSIT", "RETURNED", "UNKNOWN", "PRE_TRANSIT"] as [
  TrackingStatus["status"],
  ...TrackingStatus["status"][]
];

const shippoTrackingUpdateSchema = z.object({
  event: z.enum(["track_updated"]),
  data: z.object({
    carrier: z.string(),
    tracking_number: z.string(),
    transaction: z.string().nullable(),
    tracking_status: z.object({
      status: z.enum(trackingStatuses),
    }),
  }),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log(body);

  const parsedBody = shippoTrackingUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    return new NextResponse("Invalid request body", { status: 400 });
  }

  const {
    tracking_number: trackingNumber,
    transaction,
    tracking_status: { status },
    carrier,
  } = parsedBody.data.data;

  const shipment = await db.query.shipments.findFirst({
    where: {
      OR: [
        { trackingNumber: trackingNumber },
        ...(transaction ? [{ shippoTransactionId: transaction }] : []),
      ],
      api: "SHIPPO",
    },
    with: {
      order: true,
    },
  });

  if (!shipment) {
    return new NextResponse("Shipment not found", { status: 404 });
  }

  if (!shipment.order) {
    return new NextResponse("Order not found", { status: 404 });
  }

  if (status === "DELIVERED" || status === "TRANSIT") {
    if (shipment.order.displayFulfillmentStatus !== "FULFILLED" && shipment.order.displayIsCancelled === false) {
      await fulfillOrder(shipment.order.id, {
        company: carrier,
        number: trackingNumber || shipment.trackingNumber,
      });
    }
  }

  return new NextResponse("OK", { status: 200 });
}
