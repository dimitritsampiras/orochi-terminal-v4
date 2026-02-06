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
  event: z.string(),
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
  console.log('[shippo webhook] Received request');
  try {
    const body = await request.json();
    const parsedBody = shippoTrackingUpdateSchema.safeParse(body);

    if (!parsedBody.success) {
      console.log("[shippo webhook] Invalid request body", parsedBody.error.message);
      return new NextResponse("OK", { status: 200 });
    }

    if (parsedBody.data.event !== "track_updated") {
      return new NextResponse("OK", { status: 200 });
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
          { trackingNumber },
          ...(transaction ? [{ shippoTransactionId: transaction }] : []),
        ],
        api: "SHIPPO",
      },
      with: { order: true },
    });

    if (!shipment) {
      console.log("[shippo webhook] Shipment not found for", trackingNumber, transaction);
      return new NextResponse("OK", { status: 200 });
    }

    if (!shipment.order) {
      console.log("[shippo webhook] Order not found for shipment", shipment.id);
      return new NextResponse("OK", { status: 200 });
    }

    if (status === "DELIVERED" || status === "TRANSIT") {
      if (shipment.order.displayFulfillmentStatus !== "FULFILLED" && shipment.order.displayIsCancelled === false) {
        await fulfillOrder(shipment.order.id, {
          company: carrier,
          orderNumber: shipment.order.name,
          number: trackingNumber || shipment.trackingNumber || "",
        });
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (e) {
    console.error("[shippo webhook] Error", e);
    return new NextResponse("OK", { status: 200 });
  }
}
