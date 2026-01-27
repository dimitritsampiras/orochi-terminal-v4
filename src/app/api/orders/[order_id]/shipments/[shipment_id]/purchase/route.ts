import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { createAndStoreShippingDocs } from "@/lib/core/shipping/create-and-store-shipping-docs";
import { purchaseEasypostRateAndUpdateDatabase } from "@/lib/core/shipping/easypost/purchase-easypost-rate";
import { purchaseShippoRateAndUpdateDatabase } from "@/lib/core/shipping/shippo/purchase-shippo-rate";
import { purchaseShipmentSchema } from "@/lib/schemas/order-schema";
import { PurchaseShipmentResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ order_id: string; shipment_id: string }> }
): Promise<NextResponse<PurchaseShipmentResponse>> {
  const user = await authorizeApiUser(["super_admin", "admin", "warehouse_staff"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { order_id: unparsedOrderId, shipment_id: databaseShipmentUUID } = await params;

  const body = await request.json().catch(() => ({}));
  const { sessionId } = purchaseShipmentSchema.parse(body);
  
  const orderId = buildResourceGid("Order", unparsedOrderId);

  const shipment = await db.query.shipments.findFirst({
    where: { id: databaseShipmentUUID },
  });

  if (!shipment) {
    return NextResponse.json({ data: null, error: "Shipment not found" }, { status: 404 });
  }

  if (shipment.isPurchased) {
    return NextResponse.json({ data: null, error: "Shipment already purchased" }, { status: 400 });
  }

  if (shipment.isRefunded) {
    return NextResponse.json({ data: null, error: "Shipment already refunded" }, { status: 400 });
  }

  if (shipment.api === "SHIPPO") {
    const { data, error } = await purchaseShippoRateAndUpdateDatabase(databaseShipmentUUID, orderId);

    if (data && data.labelUrl) {
      await createAndStoreShippingDocs(shipment, orderId, data.labelUrl, sessionId);
      return NextResponse.json({ data: "success", error: null });
    }

    return NextResponse.json({ data: null, error });
  }

  if (shipment.api === "EASYPOST") {
    const { data, error } = await purchaseEasypostRateAndUpdateDatabase(databaseShipmentUUID, orderId);

    if (data && data.postage_label.label_url) {
      await createAndStoreShippingDocs(shipment, orderId, data.postage_label.label_url, sessionId);
      return NextResponse.json({ data: "success", error: null });
    }

    return NextResponse.json({ data: null, error });
  }

  return NextResponse.json({ data: null, error: "Unknown error" }, { status: 500 });
}
