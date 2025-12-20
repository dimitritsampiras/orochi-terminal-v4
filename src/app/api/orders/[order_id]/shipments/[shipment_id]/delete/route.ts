import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { DataResponse } from "@/lib/types/misc";
import { buildResourceGid } from "@/lib/utils";
import { shipments } from "@drizzle/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export type DeleteShipmentResponse = DataResponse<"success" | null>;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ order_id: string; shipment_id: string }> }
): Promise<NextResponse<DeleteShipmentResponse>> {
  const user = await authorizeUser(["superadmin", "admin"]);

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

  if (shipment.isPurchased) {
    return NextResponse.json({ data: null, error: "Cannot delete a purchased shipment" }, { status: 400 });
  }

  await db
    .delete(shipments)
    .where(
      and(eq(shipments.id, databaseShipmentUUID), eq(shipments.orderId, orderId), eq(shipments.isPurchased, false))
    );

  logger.info(`[delete shipment] Shipment ${databaseShipmentUUID} deleted by ${user.username}`, {
    category: "SHIPPING",
    orderId,
  });

  return NextResponse.json({ data: "success", error: null });
}
