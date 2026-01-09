import { db } from "@/lib/clients/db";
import { easypost } from "@/lib/clients/easypost";
import { shippo } from "@/lib/clients/shippo";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { DataResponse } from "@/lib/types/misc";
import { buildResourceGid } from "@/lib/utils";
import { shipments } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export type RefundShipmentResponse = DataResponse<"success" | null>;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ order_id: string; shipment_id: string }> }
): Promise<NextResponse<RefundShipmentResponse>> {
  const user = await authorizeApiUser(["superadmin", "admin"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { order_id: unparsedOrderId, shipment_id: databaseShipmentUUID } = await params;
  const orderId = buildResourceGid("Order", unparsedOrderId);

  const shipment = await db.query.shipments.findFirst({
    where: { id: databaseShipmentUUID },
  });

  if (!shipment) {
    return NextResponse.json({ data: null, error: "Shipment not found" }, { status: 404 });
  }

  if (!shipment.isPurchased) {
    return NextResponse.json({ data: null, error: "Shipment has not been purchased" }, { status: 400 });
  }

  if (shipment.isRefunded) {
    return NextResponse.json({ data: null, error: "Shipment already refunded" }, { status: 400 });
  }

  try {
    if (shipment.api === "SHIPPO" && shipment.shippoTransactionId) {
      const refund = await shippo.refunds.create({
        transaction: shipment.shippoTransactionId,
      });

      if (refund) {
        await db.update(shipments).set({ isRefunded: true }).where(eq(shipments.id, databaseShipmentUUID));

        logger.info(`[refund shipment] Shippo shipment ${databaseShipmentUUID} refunded by ${user.username}`, {
          category: "SHIPPING",
          orderId,
        });

        return NextResponse.json({ data: "success", error: null });
      }

      return NextResponse.json({ data: null, error: "Failed to create Shippo refund" }, { status: 500 });
    }

    if (shipment.api === "EASYPOST") {
      const refundedShipment = await easypost.Shipment.refund(shipment.shipmentId);

      if (refundedShipment.refund_status === "submitted" || refundedShipment.refund_status === "refunded") {
        await db.update(shipments).set({ isRefunded: true }).where(eq(shipments.id, databaseShipmentUUID));

        logger.info(`[refund shipment] EasyPost shipment ${databaseShipmentUUID} refunded by ${user.username}`, {
          category: "SHIPPING",
          orderId,
        });

        return NextResponse.json({ data: "success", error: null });
      }

      return NextResponse.json(
        { data: null, error: `Refund status: ${refundedShipment.refund_status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: null, error: "Unknown shipment API" }, { status: 400 });
  } catch (error) {
    logger.error(`[refund shipment] Error refunding shipment: ${error}`, {
      category: "SHIPPING",
      orderId,
    });

    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

