import { OrderQuery } from "@/lib/types/admin.generated";
import { createShippoShipment } from "./shippo/create-shippo-shipment";
import { createParcelFromOrder, GeneralParcel } from "./create-parcel-from-order";
import { logger } from "../logger";
import { ShippingOptions } from "@/lib/types/shipping.types";
import { db } from "@/lib/clients/db";
import { DataResponse } from "@/lib/types/misc";
import { Shipment as EasyPostShipment } from "@easypost/api";
import { Shipment, Shipment as ShippoShipment } from "shippo";
import { shipmentApi, shipments, shippingPriority } from "@drizzle/schema";
import { createEasypostShipment } from "./easypost/create-easypost-shipment";

// TODO: add extra product ids to shipment
type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;

type GetRateResponse = DataResponse<{ rate: NormalizedShipmentRate; parcel: GeneralParcel } | null>;

type NormalizedShipmentRate = {
  cost: number;
  rateId: string;
  api: (typeof shipmentApi.enumValues)[number];
  shipmentId: string;
  eta: number | undefined;
  carrierName: string;
  serviceName: string | undefined;
  serviceToken: string | undefined;
};

/**
 *
 * Gets easyship or shippo rate for an order
 *
 * @param order - The order to get the rate for
 * @param options - The options for the rate
 * @returns The rate for the order
 */
export const getRateForOrder = async (order: Order, options?: ShippingOptions): Promise<GetRateResponse> => {
  // 1. Determine which items we are actually shipping right now
  const itemsToShip = resolveLineItems(order, options?.targetLineItemIds);

  if (!itemsToShip.data) {
    return { data: null, error: itemsToShip.error };
  }

  // 2. Create a "virtual" order that only contains these items
  // This ensures the parcel calculation only considers what's being shipped
  const shipmentOrder: Order = {
    ...order,
    lineItems: {
      ...order.lineItems,
      nodes: itemsToShip.data,
    },
  };

  const { data: parcel, error: parcelError } = await createParcelFromOrder(shipmentOrder);

  if (!parcel) {
    return { data: null, error: parcelError };
  }

  const databaseOrder = await db.query.orders.findFirst({
    where: { id: order.id },
    columns: { shippingPriority: true },
  });

  if (!databaseOrder) {
    logger.error("[get rate for order] Database order not found", {
      category: "SHIPPING",
      orderId: order.id,
    });
    return { data: null, error: "Order not found in database" };
  }

  // TODO: only choose one of the two shipments based on the api option
  const [
    { data: shippoShipment, error: shippoShipmentError },
    { data: easypostShipment, error: easypostShipmentError },
  ] = await Promise.all([
    createShippoShipment(shipmentOrder, parcel, {
      ...options,
      shippingPriority: databaseOrder.shippingPriority,
    }),
    createEasypostShipment(shipmentOrder, parcel, {
      ...options,
      shippingPriority: databaseOrder.shippingPriority,
    }),
  ]);

  if (!shippoShipment || !easypostShipment) {
    logger.error("[get rate for order] Error creating shipments. One or both (easypost or shippo) failed to create.", {
      category: "SHIPPING",
      orderId: order.id,
    });
    return { data: null, error: shippoShipmentError || easypostShipmentError || "Unknown error" };
  }

  const rates = standardizeShipmentRates({
    shippoShipment,
    easypostShipment,
  });

  let rate: NormalizedShipmentRate | null = null;

  switch (databaseOrder.shippingPriority) {
    case "standard":
      rate = determineCheapestRate(rates);
      break;
    case "express":
      rate = determineExpressPriorityRate(rates, order);
      break;
    case "fastest":
      rate = determineFastestRate(rates, order);
      break;
    default:
      // Fallback to cheapest if priority is unknown or handled incorrectly
      logger.warn(
        `[get rate for order] Unknown shipping priority: ${databaseOrder.shippingPriority}. Defaulting to standard.`,
        {
          category: "SHIPPING",
          orderId: order.id,
        }
      );
      rate = determineCheapestRate(rates);
      break;
  }

  if (!rate) {
    logger.error("[get rate for order] No rate found for shipping priority", {
      category: "SHIPPING",
      orderId: order.id,
    });
    return { data: null, error: "No rate found for shipping priority" };
  }

  return { data: { rate, parcel }, error: null };
};

/**
 *
 * stores rate and shipment after generating shipment
 */
export const storeShipmentAndRate = async (order: Order, rate: NormalizedShipmentRate, parcel: GeneralParcel) => {
  try {
    if (!rate) {
      return { error: "No rate", data: null };
    }

    const shipment = await db
      .insert(shipments)
      .values({
        orderId: order.id,
        shipmentId: rate.shipmentId,
        api: rate.api,
        chosenCarrierName: rate.carrierName,
        chosenRateId: rate.rateId,
        cost: rate.cost.toFixed(2),
        parcelSnapshot: parcel,
        lineItemIds: parcel.items.map((item) => item.lineItemId),
      })
      .returning();

    return { data: shipment[0], error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[store rate] Error storing rate: ${errorMessage}`, {
      category: "SHIPPING",
      orderId: order.id,
    });
    return { error: "Error storing rate", data: null };
  }
};

/**
 *
 * Resolves the line items to ship based on the target line item ids
 */
const resolveLineItems = (order: Order, targetIds?: string[]): DataResponse<Order["lineItems"]["nodes"]> => {
  // Case A: User specified specific items
  if (targetIds) {
    if (targetIds.length === 0) {
      return { data: null, error: "Please specify at least one target line item" };
    }

    const selectedItems = order.lineItems.nodes.filter((item) => targetIds.includes(item.id));

    if (selectedItems.length === 0) {
      return { data: null, error: "No matching line items found for the provided IDs" };
    }

    return { data: selectedItems, error: null };
  }

  // Case B: Auto-detect fulfillable items
  const fulfillableItems = determineFulfillableLineItems(order);

  if (!fulfillableItems || fulfillableItems.length === 0) {
    return { data: null, error: "No fulfillable line items found" };
  }

  return { data: fulfillableItems, error: null };
};

/**
 *
 * Determines the fulfillable line items for an order. Meant only to run if target line item ids are not provided.
 *
 */
const determineFulfillableLineItems = (order: Order) => {
  const fulfillableLineItems = order.lineItems.nodes.filter((lineItem) => {
    if (!lineItem.requiresShipping) {
      logger.info(
        `[get rate for order] auto filtering ${lineItem.name} while fetching rate because it is not fulfillable`,
        {
          category: "SHIPPING",
          orderId: order.id,
        }
      );
      return false;
    }

    if (lineItem.unfulfilledQuantity <= 0) {
      logger.info(
        `[get rate for order] auto filtering ${lineItem.name} while fetching rate because it is not fulfillable`,
        {
          category: "SHIPPING",
          orderId: order.id,
        }
      );
      return false;
    }

    return true;
  });
  return fulfillableLineItems;
};

/**
 *
 * Standardizes the shipment rates from easypost and shippo into a single array of normalized shipment rates
 */
const standardizeShipmentRates = ({
  easypostShipment,
  shippoShipment,
}: {
  easypostShipment: EasyPostShipment;
  shippoShipment: ShippoShipment;
}): NormalizedShipmentRate[] => {
  const normalizedShippoRates = shippoShipment.rates.map<NormalizedShipmentRate>((rate) => ({
    cost: parseFloat(rate.amount),
    rateId: rate.objectId,
    api: "SHIPPO" satisfies (typeof shipmentApi.enumValues)[number],
    shipmentId: shippoShipment.objectId,
    eta: rate.estimatedDays,
    carrierName: rate.provider,
    serviceName: rate.servicelevel.name,
    serviceToken: rate.servicelevel.token,
  }));

  const normalizedEasypostRates = easypostShipment.rates.map<NormalizedShipmentRate>((rate) => ({
    cost: parseFloat(rate.rate),
    rateId: rate.id,
    api: "EASYPOST" as (typeof shipmentApi.enumValues)[number],
    shipmentId: easypostShipment.id,
    eta: rate.delivery_days,
    carrierName: rate.carrier,
    serviceName: rate.service,
    serviceToken: `ep-${rate.service.toLowerCase().replace(" ", "-")}`,
  }));

  return [...normalizedShippoRates, ...normalizedEasypostRates];
};

/**
 * Determines the cheapest rate from a list of shipment rates
 */
const determineCheapestRate = (rates: NormalizedShipmentRate[]): NormalizedShipmentRate | null => {
  if (rates.length === 0) {
    return null;
  }

  return rates.toSorted((a, b) => a.cost - b.cost)[0];
};

/**
 * Determines the express priority rate from a list of shipment rates
 * // TODO: determine correct threshold
 */
const determineExpressPriorityRate = (rates: NormalizedShipmentRate[], order: Order): NormalizedShipmentRate | null => {
  if (rates.length === 0) {
    return null;
  }

  // get order total
  const orderTotal = Number.parseFloat(order.totalPriceSet?.shopMoney?.amount ?? "0");
  // make sure a rate is never over 30% of an order's total value
  const EXPRESS_PRIORITY_RATE_THRESHOLD = 0.25;
  const threshold = orderTotal * EXPRESS_PRIORITY_RATE_THRESHOLD;

  // Filter rates that are within the threshold
  const affordableRates = rates.filter((rate) => rate.cost <= threshold && rate.eta !== undefined);

  if (affordableRates.length === 0) {
    logger.warn("[get rate for order] No affordable rates found for express priority", {
      category: "SHIPPING",
      orderId: order.id,
    });
    // No affordable rates, default to cheapest
    return determineCheapestRate(rates);
  }

  // Find the fastest rate among affordable ones (lowest ETA)
  return affordableRates.toSorted((a, b) => a.eta! - b.eta!)[0];
};

/**
 * Determines the fastest rate from a list of shipment rates
 * // TODO: determine correct threshold
 */
const determineFastestRate = (rates: NormalizedShipmentRate[], order: Order): NormalizedShipmentRate | null => {
  if (rates.length === 0) {
    return null;
  }

  // get order total
  const orderTotal = Number.parseFloat(order.totalPriceSet?.shopMoney?.amount ?? "0");
  // make sure a rate is never over 40% of an order's total value
  const FASTEST_RATE_THRESHOLD = 0.4;
  const threshold = orderTotal * FASTEST_RATE_THRESHOLD;

  // Find the fastest rate among all rates (no matter the cost)
  const fastestRate = rates
    .filter((rate) => rate.eta !== undefined) // Only consider rates with ETA
    .toSorted((a, b) => a.eta! - b.eta!)[0]; // Sort by ETA (fastest first)

  if (!fastestRate) {
    return null;
  }

  // Warn if the fastest rate is above our threshold
  if (fastestRate.cost > threshold) {
    logger.warn("[get rate for order] Fastest rate exceeds threshold", {
      category: "SHIPPING",
      orderId: order.id,
    });
  }

  return fastestRate;
};
