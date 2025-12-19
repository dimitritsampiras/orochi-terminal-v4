import { db } from "@/lib/clients/db";
import { shippo } from "@/lib/clients/shippo";
import { logger } from "../../logger";
import { Transaction } from "shippo";
import { DataResponse } from "@/lib/types/misc";
import { handleShippoError } from "./handle-shippo-errors";
import { shipments } from "@drizzle/schema";
import { eq } from "drizzle-orm";

export const purchaseShippoRateAndUpdateDatabase = async (
  databaseShipmentUUID: string,
  orderId?: string
): Promise<DataResponse<Transaction>> => {
  const shipment = await db.query.shipments.findFirst({
    where: {
      id: databaseShipmentUUID,
      api: "SHIPPO",
    },
    with: {
      order: true,
    },
  });

  if (!shipment) {
    logger.error(`[purchase shippo shipment] ShipmentId ${databaseShipmentUUID} not found in database`, {
      category: "SHIPPING",
      orderId,
    });
    return { data: null, error: "Shipment not found" };
  }

  // this should never really happen, but just in case
  if (!shipment.order) {
    logger.error(`[purchase shippo shipment] Order not found when querying database shipment`, {
      category: "SHIPPING",
      orderId,
    });
    return { data: null, error: "Order not found" };
  }

  if (shipment.isPurchased) {
    logger.info(`[purchase shippo shipment] Shipment already purchased`, {
      category: "SHIPPING",
      orderId,
    });
    return { data: null, error: "Shipment already purchased" };
  }

  if (shipment.isRefunded) {
    logger.info(`[purchase shippo shipment] Shipment already refunded`, {
      category: "SHIPPING",
      orderId,
    });
    return { data: null, error: "Shipment already refunded" };
  }

  try {
    const shippoShipment = await shippo.shipments.get(shipment.shipmentId);
    if (!shippoShipment) {
      logger.error(`[purchase shippo shipment] ShipmentId ${databaseShipmentUUID} not found in Shippo`, {
        category: "SHIPPING",
        orderId,
      });
      return { data: null, error: "Shipment not found in Shippo" };
    }

    const rate = shippoShipment.rates.find((rate) => rate.objectId === shipment.chosenRateId);

    if (!rate) {
      logger.error(
        `[purchase shippo shipment] RateId ${shipment.chosenRateId} not found for shipmentId ${databaseShipmentUUID}`,
        {
          category: "SHIPPING",
          orderId,
        }
      );
      return { data: null, error: "Rate not found for shipment" };
    }

    const transaction = await shippo.transactions.create({
      rate: rate.objectId,
    });

    if (transaction.status === "ERROR") {
      logger.error(`[purchase shippo shipment] Transaction status returned error`, {
        category: "SHIPPING",
        orderId,
        metadata: JSON.stringify({
          error: transaction.messages,
        }),
      });
      return { data: null, error: "Error purchasing shippo shipment" };
    }

    if (transaction.status === "SUCCESS" || transaction.status === "QUEUED") {
      // Update database to mark as purchased
      await db
        .update(shipments)
        .set({
          isPurchased: true,
          shippoTransactionId: transaction.objectId,
        })
        .where(eq(shipments.id, databaseShipmentUUID));

      return { data: transaction, error: null };
    }

    return { data: null, error: "Unknown issue: shippo transaction was not successful" };
  } catch (error) {
    const errorMessage = handleShippoError(error, orderId ?? shipment.order.id, "purchase shippo shipment");
    return { data: null, error: errorMessage };
  }
};
