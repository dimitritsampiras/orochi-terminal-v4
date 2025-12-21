import { easypost } from "@/lib/clients/easypost";
import { shippo } from "@/lib/clients/shippo";
import { orders, shipments } from "@drizzle/schema";
import { Transaction, Shipment as ShippoShipment } from "shippo";
import { type Shipment as EasyPostShipment } from "@easypost/api"; // You might need to check this import path
import { logger } from "../logger";

// Define the shape of the enhanced shipment data
// We add the specific info fields to the database shipment type

type BaseShipment = typeof shipments.$inferSelect;

export type ShippoShipmentData = BaseShipment & {
  api: "SHIPPO";
  shippoInfo: ShippoShipment & {
    chosenRate: ShippoShipment["rates"][number] | null;
    transaction: Transaction | null;
    issues: string[];
  };
};

export type EasyPostShipmentData = BaseShipment & {
  api: "EASYPOST";
  easypostInfo: Omit<EasyPostShipment, "lowestRate"> & {
    chosenRate: EasyPostShipment["rates"][number] | null;
    issues: string[];
  };
};

export type OrderShipmentData = ShippoShipmentData | EasyPostShipmentData;

export const retrieveShipmentDataFromOrder = async (
  orderShipments: (typeof shipments.$inferSelect)[]
): Promise<OrderShipmentData[]> => {
  const orderShipmentWithShippoInfo = orderShipments
    .filter((orderShipment) => orderShipment.api === "SHIPPO")
    .map(async (orderShipment): Promise<ShippoShipmentData | null> => {
      return shippo.shipments
        .get(orderShipment.shipmentId)
        .then(async (shippoShipment) => {
          let transaction: Transaction | null = null;
          let issues: string[] = [];

          if (orderShipment.shippoTransactionId) {
            transaction = await shippo.transactions.get(orderShipment.shippoTransactionId).catch(() => null);
            if (transaction === null) {
              issues.push(`Transaction ${orderShipment.shippoTransactionId} not found in Shippo`);
            }
          }

          // We need to match the type structure explicitly
          const shippoData: ShippoShipmentData = {
            ...orderShipment,
            api: "SHIPPO", // Type assertion for discriminated union
            shippoInfo: {
              ...shippoShipment,
              chosenRate: shippoShipment.rates.find((rate) => rate.objectId === orderShipment.chosenRateId) || null,
              transaction,
              issues,
            },
          };
          return shippoData;
        })
        .catch((err) => {
          logger.error(`Failed to retrieve Shippo shipment ${orderShipment.shipmentId}:`, err);
          return null;
        });
    });

  const orderShipmentWithEasypostInfo = orderShipments
    .filter((orderShipment) => orderShipment.api === "EASYPOST")
    .map(async (orderShipment): Promise<EasyPostShipmentData | null> => {
      return easypost.Shipment.retrieve(orderShipment.shipmentId)
        .then(async (easypostShipment) => {
          // Convert EasyPost class instance to plain object (removes _params, prototype, etc.)
          const plainShipment = JSON.parse(JSON.stringify(easypostShipment)) as typeof easypostShipment;
          const easypostData: EasyPostShipmentData = {
            ...orderShipment,
            api: "EASYPOST",
            easypostInfo: {
              chosenRate: plainShipment.rates.find((rate) => rate.id === orderShipment.chosenRateId) || null,
              issues: [],
              ...plainShipment,
            },
          };
          return easypostData;
        })
        .catch((err) => {
          logger.error(`Failed to retrieve EasyPost shipment ${orderShipment.shipmentId}:`, err);
          return null;
        });
    });

  const orderShipmentWithData = await Promise.all([...orderShipmentWithShippoInfo, ...orderShipmentWithEasypostInfo]);

  return orderShipmentWithData
    .filter((item): item is OrderShipmentData => item !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};
