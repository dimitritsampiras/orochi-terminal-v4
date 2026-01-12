import { db } from "@/lib/clients/db";
import { easypost } from "@/lib/clients/easypost";
import { shippo } from "@/lib/clients/shippo";
import { fulfillOrder } from "./fulfill-order";

// Set to true to actually fulfill orders, false for dry-run (logging only)
const DRY_RUN = false;

export const bulkFulfillOrders = async () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`BULK FULFILL ORDERS - ${DRY_RUN ? "DRY RUN MODE" : "LIVE MODE"}`);
  console.log(`${"=".repeat(60)}\n`);

  // 1. Get all orders that are not fulfilled, not queued, and not cancelled
  const orders = await db.query.orders.findMany({
    where: {
      displayFulfillmentStatus: { ne: "FULFILLED" },
      queued: false,
      displayIsCancelled: false,
      createdAt: {
        gte: new Date("2025-07-01"),
      },
    },
    with: {
      shipments: true,
    },
  });

  console.log(`Found ${orders.length} unfulfilled, non-queued, non-cancelled orders`);

  const ordersWithShipments = orders.filter((order) => order.shipments.length > 0);
  console.log(`Of those, ${ordersWithShipments.length} have shipments\n`);

  // Stats tracking
  let fulfilled = 0;
  let skipped = 0;
  let failed = 0;
  const results: { order: string; status: string; reason?: string }[] = [];

  // 2. Process each order
  for (const order of ordersWithShipments) {
    const recentShipment = order.shipments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    if (!recentShipment) {
      skipped++;
      results.push({ order: order.name, status: "skipped", reason: "No recent shipment" });
      continue;
    }

    if (!recentShipment.isPurchased || recentShipment.isRefunded) {
      skipped++;
      results.push({
        order: order.name,
        status: "skipped",
        reason: `Shipment not purchased (${recentShipment.isPurchased}) or refunded (${recentShipment.isRefunded})`,
      });
      continue;
    }

    try {
      if (recentShipment.api === "SHIPPO") {
        if (!recentShipment.shippoTransactionId) {
          skipped++;
          results.push({ order: order.name, status: "skipped", reason: "No Shippo transaction ID" });
          continue;
        }

        const shippoTransaction = await shippo.transactions.get(recentShipment.shippoTransactionId);
        const trackingStatus = shippoTransaction.trackingStatus;

        if (trackingStatus !== "TRANSIT" && trackingStatus !== "DELIVERED") {
          skipped++;
          results.push({
            order: order.name,
            status: "skipped",
            reason: `Tracking status: ${trackingStatus} (needs TRANSIT or DELIVERED)`,
          });
          continue;
        }

        // Build tracking info for Shopify
        const trackingInfo = {
          company: recentShipment.chosenCarrierName ?? undefined,
          number: shippoTransaction.trackingNumber,
        };

        console.log(`[SHIPPO] Order ${order.name}:`);
        console.log(`  Tracking: ${trackingInfo.number} (${trackingInfo.company})`);
        console.log(`  Status: ${trackingStatus}`);

        if (DRY_RUN) {
          console.log(`  ⏸️  DRY RUN - Would fulfill order\n`);
          fulfilled++;
          results.push({ order: order.name, status: "would_fulfill", reason: "Dry run" });
        } else {
          const result = await fulfillOrder(order.id, trackingInfo);
          if (result.error) {
            console.log(`  ❌ Failed: ${result.error}\n`);
            failed++;
            results.push({ order: order.name, status: "failed", reason: result.error });
          } else {
            console.log(`  ✅ Fulfilled!\n`);
            fulfilled++;
            results.push({ order: order.name, status: "fulfilled" });
          }
        }
      } else if (recentShipment.api === "EASYPOST") {
        const easypostShipment = await easypost.Shipment.retrieve(recentShipment.shipmentId);
        const trackingStatus = easypostShipment.tracker?.status;

        if (trackingStatus !== "in_transit" && trackingStatus !== "delivered") {
          skipped++;
          results.push({
            order: order.name,
            status: "skipped",
            reason: `Tracking status: ${trackingStatus} (needs in_transit or delivered)`,
          });
          continue;
        }

        // Build tracking info for Shopify
        const trackingInfo = {
          company: easypostShipment.tracker?.carrier ?? recentShipment.chosenCarrierName ?? undefined,
          number: easypostShipment.tracker?.tracking_code ?? recentShipment.trackingNumber ?? "",
        };

        console.log(`[EASYPOST] Order ${order.name}:`);
        console.log(`  Tracking: ${trackingInfo.number} (${trackingInfo.company})`);
        console.log(`  Status: ${trackingStatus}`);

        if (DRY_RUN) {
          console.log(`  ⏸️  DRY RUN - Would fulfill order\n`);
          fulfilled++;
          results.push({ order: order.name, status: "would_fulfill", reason: "Dry run" });
        } else {
          const result = await fulfillOrder(order.id, trackingInfo);
          if (result.error) {
            console.log(`  ❌ Failed: ${result.error}\n`);
            failed++;
            results.push({ order: order.name, status: "failed", reason: result.error });
          } else {
            console.log(`  ✅ Fulfilled!\n`);
            fulfilled++;
            results.push({ order: order.name, status: "fulfilled" });
          }
        }
      } else {
        skipped++;
        results.push({ order: order.name, status: "skipped", reason: `Unknown API: ${recentShipment.api}` });
      }
    } catch (error) {
      console.error(`[ERROR] Order ${order.name}:`, error);
      failed++;
      results.push({ order: order.name, status: "error", reason: String(error) });
    }
  }

  // 3. Print summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log(`${"=".repeat(60)}`);
  console.log(`Total orders processed: ${ordersWithShipments.length}`);
  console.log(`${DRY_RUN ? "Would fulfill" : "Fulfilled"}: ${fulfilled}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`${"=".repeat(60)}\n`);

  return { fulfilled, skipped, failed, results };
};
