import "dotenv/config";
import { db } from "../src/lib/clients/db";
import { easypost } from "../src/lib/clients/easypost";
import { shippo } from "../src/lib/clients/shippo";
import { fulfillOrder } from "../src/lib/core/orders/fulfill-order";

const BATCH_SIZE = 10;
const DELAY_MS = 500;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getEasypostTrackingStatus(shipmentId: string): Promise<string | null> {
  try {
    const epShipment = await easypost.Shipment.retrieve(shipmentId);
    return epShipment.tracker?.status ?? null;
  } catch (error) {
    console.error(`[EasyPost] Error fetching shipment ${shipmentId}:`, error);
    return null;
  }
}

async function getShippoTrackingStatus(carrier: string, trackingNumber: string): Promise<string | null> {
  try {
    const track = await shippo.trackingStatus.get(carrier.toLowerCase(), trackingNumber);
    return track.trackingStatus?.status ?? null;
  } catch (error) {
    console.error(`[Shippo] Error fetching tracking for ${trackingNumber}:`, error);
    return null;
  }
}

function shouldFulfill(api: "SHIPPO" | "EASYPOST", status: string): boolean {
  if (api === "EASYPOST") {
    return status === "in_transit" || status === "delivered" || status === "out_for_delivery";
  }
  if (api === "SHIPPO") {
    return status === "TRANSIT" || status === "DELIVERED";
  }
  return false;
}

async function main() {
  console.log("Starting bulk fulfillment check...\n");

  const cutoffDate = new Date("2025-09-01");

  // Get unfulfilled, non-cancelled orders created after Sept 2025
  const orders = await db.query.orders.findMany({
    where: {
      displayFulfillmentStatus: { ne: "FULFILLED" },
      displayIsCancelled: false,
      createdAt: { gt: cutoffDate },
    },
    with: {
      shipments: true,
    },
  });

  console.log(`Found ${orders.length} unfulfilled orders after ${cutoffDate.toISOString().split("T")[0]}.\n`);

  // Filter to orders that have a purchased shipment with tracking
  const eligibleOrders = orders.filter((order) =>
    order.shipments.some((s) => s.isPurchased && s.trackingNumber)
  );

  console.log(`${eligibleOrders.length} orders have purchased shipments with tracking.\n`);

  if (eligibleOrders.length === 0) {
    console.log("No eligible orders found. Exiting.");
    return;
  }

  let fulfilled = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < eligibleOrders.length; i += BATCH_SIZE) {
    const batch = eligibleOrders.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} orders)...`);

    for (const order of batch) {
      const shipment = order.shipments.find((s) => s.isPurchased && s.trackingNumber);
      if (!shipment) continue;

      console.log(`\n[${order.name}] Checking shipment (${shipment.api})...`);

      let status: string | null = null;

      if (shipment.api === "EASYPOST") {
        status = await getEasypostTrackingStatus(shipment.shipmentId);
      } else if (shipment.api === "SHIPPO" && shipment.chosenCarrierName && shipment.trackingNumber) {
        status = await getShippoTrackingStatus(shipment.chosenCarrierName, shipment.trackingNumber);
      }

      if (!status) {
        console.log(`[${order.name}] Could not fetch tracking status. Skipping.`);
        skipped++;
        continue;
      }

      console.log(`[${order.name}] Tracking status: ${status}`);

      if (shouldFulfill(shipment.api, status)) {
        console.log(`[${order.name}] Status indicates fulfillment. Fulfilling order...`);

        const result = await fulfillOrder(order.id, {
          company: shipment.chosenCarrierName ?? (shipment.api === "EASYPOST" ? "EasyPost" : "Shippo"),
          number: shipment.trackingNumber!,
          orderNumber: order.name,
        });

        if (result.data === "success") {
          console.log(`[${order.name}] Successfully fulfilled!`);
          fulfilled++;
        } else {
          console.log(`[${order.name}] Failed to fulfill: ${result.error}`);
          errors++;
        }
        console.log('should fulfill order', order.name, 'status', status, 'api', shipment.api);

      } else {
        console.log(`[${order.name}] Status does not require fulfillment. Skipping.`);
        skipped++;
      }

      await sleep(DELAY_MS);
    }
  }

  console.log("\n========== Summary ==========");
  console.log(`Total checked: ${eligibleOrders.length}`);
  console.log(`Fulfilled: ${fulfilled}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log("==============================\n");
}

main()
  .catch(console.error)
  .finally(() => process.exit());
