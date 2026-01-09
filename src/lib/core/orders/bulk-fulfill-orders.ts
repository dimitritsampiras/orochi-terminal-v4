import { db } from "@/lib/clients/db";
import { easypost } from "@/lib/clients/easypost";
import { shippo } from "@/lib/clients/shippo";

export const bulkFulfillOrders = async () => {
  // 1. Get all orders that are not fulfilled, not queued, and are in zero batches/sessions
  const orders = await db.query.orders.findMany({
    where: {
      displayFulfillmentStatus: { ne: "FULFILLED" },
      queued: false,
      displayIsCancelled: false,
    },
    with: {
      shipments: true,
    },
  });

  const ordersWithShipments = orders.filter((order) => order.shipments.length > 0);
  // 2. Fulfill each order
  let i = 0;
  for (const order of ordersWithShipments) {
    const recentShipment = order.shipments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    if (!recentShipment) {
      // console.log(`[bulk fulfill orders] No recent shipment found for order ${order.id}`);
      continue;
    }

    if (!recentShipment.isPurchased || recentShipment.isRefunded) {
      // console.log(`[bulk fulfill orders] Shipment ${recentShipment.id} is not purchased or refunded`);
      continue;
    }

    if (recentShipment.api === "SHIPPO") {
      // await fulfillShippoOrder(order.id);
      if (recentShipment.shippoTransactionId) {
        const shippoTransaction = await shippo.transactions.get(recentShipment.shippoTransactionId);
        const trackingStatus = shippoTransaction.trackingStatus;
        if (trackingStatus === "TRANSIT" || trackingStatus === "DELIVERED") {
          i++;
          console.log("order", order.name);
          console.log("shippoTransaction", shippoTransaction.trackingNumber, shippoTransaction.trackingStatus);
        }
      }
    } else if (recentShipment.api === "EASYPOST") {
      const easypostShipment = await easypost.Shipment.retrieve(recentShipment.shipmentId);
      const trackingStatus = easypostShipment.tracker.status;
      if (trackingStatus === "in_transit" || trackingStatus === "delivered") {
        i++;
        console.log("order", order.name);
        console.log(
          "easypostShipment",
          easypostShipment.tracker.tracking_code,
          trackingStatus,
          easypostShipment.tracker.carrier
        );
      }

      // await fulfillEasypostOrder(order.id);
    }
    // await fulfillOrder(order.id);
  }
};
