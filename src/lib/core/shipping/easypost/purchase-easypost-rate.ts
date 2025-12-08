import { db } from "@/lib/clients/db";

import { logger } from "../../logger";
import { Transaction } from "shippo";
import { DataResponse } from "@/lib/types/misc";

import { shipments } from "@drizzle/schema";
import { DrizzleError, eq } from "drizzle-orm";
import { Shipment } from "@easypost/api";
import { easypost } from "@/lib/clients/easypost";
import { handleEasypostError } from "./handle-easypost-errors";

export const purchaseEasypostRateAndUpdateDatabase = async (
  shipmentId: string,
  orderId?: string
): Promise<DataResponse<Shipment>> => {
  const shipment = await db.query.shipments.findFirst({
    where: {
      shipmentId,
      api: "EASYPOST",
    },
    with: {
      order: true,
    },
  });

  if (!shipment) {
    logger.error(`[purchase easypost shipment] ShipmentId ${shipmentId} not found in database`, {
      category: "SHIPPING",
      orderId,
    });
    return { data: null, error: "Shipment not found" };
  }

  // this should never really happen, but just in case
  if (!shipment.order) {
    logger.error(`[purchase easypost shipment] Order not found when querying database shipment ${shipmentId}`, {
      category: "SHIPPING",
      orderId,
    });
    return { data: null, error: "Order not found" };
  }

  if (shipment.isPurchased) {
    logger.info(`[purchase easypost shipment] Shipment ${shipmentId} already purchased`, {
      category: "SHIPPING",
      orderId,
    });
    return { data: null, error: "Shipment already purchased" };
  }

  try {
    const easypostShipment = await easypost.Shipment.retrieve(shipment.shipmentId);
    if (!easypostShipment) {
      logger.error(`[purchase easypost shipment] ShipmentId ${shipmentId} not found in Easypost`, {
        category: "SHIPPING",
        orderId,
      });
      return { data: null, error: "Shipment not found in Easypost" };
    }

    const rate = easypostShipment.rates.find((rate) => rate.id === shipment.chosenRateId);

    if (!rate) {
      logger.error(
        `[purchase easypost shipment] RateId ${shipment.chosenRateId} not found for shipmentId ${shipmentId}`,
        {
          category: "SHIPPING",
          orderId,
        }
      );
      return { data: null, error: "Rate not found for shipment" };
    }

    const purchasedShipment = await easypost.Shipment.buy(shipment.shipmentId, rate.id);

    // Update database to mark as purchased
    await db
      .update(shipments)
      .set({
        isPurchased: true,
      })
      .where(eq(shipments.shipmentId, shipmentId));

    return { data: purchasedShipment, error: null };
  } catch (error) {
    if (error instanceof DrizzleError) {
      return { data: null, error: error.message };
    }
    const errorMessage = handleEasypostError(error, orderId ?? shipment.order.id, "purchase easypost shipment");
    return { data: null, error: errorMessage };
  }
};
