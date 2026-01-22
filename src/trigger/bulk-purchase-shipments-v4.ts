import { task, logger, metadata } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { getRateForOrder, storeShipmentAndRate } from "@/lib/core/shipping/get-rate-for-order";
import { purchaseShippoRateAndUpdateDatabase } from "@/lib/core/shipping/shippo/purchase-shippo-rate";
import { purchaseEasypostRateAndUpdateDatabase } from "@/lib/core/shipping/easypost/purchase-easypost-rate";
import { createAndStoreShippingDocs } from "@/lib/core/shipping/create-and-store-shipping-docs";
import { shipments } from "@drizzle/schema";

export type ShipmentStatus = "none" | "unpurchased" | "purchased" | "refunded";

export interface OrderToPurchase {
  orderId: string; // Full GID
  orderName: string;
  status: ShipmentStatus;
  shipmentId?: string; // DB UUID for unpurchased shipments
}

// JSON-safe type for metadata (no undefined values, uses type for index signature compatibility)
export type TaskItemStatus = {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  error: string | null;
};

export interface BulkPurchasePayload {
  orders: OrderToPurchase[];
  sessionId: number;
}

export interface BulkPurchaseMetadata {
  items: TaskItemStatus[];
  progress: number;
  completed: number;
  failed: number;
}

// Helper to parse GID to numeric ID
function parseGid(gid: string): string | null {
  const match = gid.match(/\/(\d+)$/);
  return match ? match[1] : null;
}

export const bulkPurchaseShipmentsTask = task({
  id: "bulk-purchase-shipments-v4",
  maxDuration: 3600,
  run: async (payload: BulkPurchasePayload) => {
    const { orders, sessionId } = payload;

    logger.info(`Starting bulk purchase for ${orders.length} orders`, { sessionId });

    // Initialize metadata for realtime tracking
    const items: TaskItemStatus[] = orders.map((o) => ({
      id: o.orderId,
      label: o.orderName,
      status: "pending" as const,
      error: null,
    }));

    metadata.set("items", items);
    metadata.set("progress", 0);
    metadata.set("completed", 0);
    metadata.set("failed", 0);

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];

      // Update item to running
      items[i].status = "running";
      metadata.set("items", items);

      try {
        await processOrder(order, sessionId);
        items[i].status = "completed";
        completed++;
        logger.info(`Completed ${order.orderName}`, { orderId: order.orderId });
      } catch (error) {
        items[i].status = "failed";
        items[i].error = error instanceof Error ? error.message : "Unknown error";
        failed++;
        logger.error(`Failed ${order.orderName}: ${items[i].error}`, { orderId: order.orderId });
      }

      // Update progress
      const progress = Math.round(((completed + failed) / orders.length) * 100);
      metadata.set("items", items);
      metadata.set("progress", progress);
      metadata.set("completed", completed);
      metadata.set("failed", failed);
    }

    logger.info(`Bulk purchase complete: ${completed} succeeded, ${failed} failed`);

    return {
      completed,
      failed,
      total: orders.length,
    };
  },
});

async function processOrder(order: OrderToPurchase, sessionId: number): Promise<void> {
  const { status, shipmentId, orderId } = order;
  const numericOrderId = parseGid(orderId);

  if (!numericOrderId) {
    throw new Error("Invalid order ID");
  }

  if (status === "unpurchased" && shipmentId) {
    // Purchase existing unpurchased shipment
    const shipment = await db.query.shipments.findFirst({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new Error("Shipment not found");
    }

    if (shipment.isPurchased) {
      // Already purchased (possibly by another process) - treat as success
      return;
    }

    if (shipment.api === "SHIPPO") {
      const { data, error } = await purchaseShippoRateAndUpdateDatabase(shipmentId, orderId);
      if (!data) {
        if (error === "Shipment already purchased") return; // Race condition handled
        throw new Error(error || "Failed to purchase Shippo shipment");
      }
      if (data.labelUrl) {
        await createAndStoreShippingDocs(shipment, orderId, data.labelUrl, sessionId.toString());
      }
    } else if (shipment.api === "EASYPOST") {
      const { data, error } = await purchaseEasypostRateAndUpdateDatabase(shipmentId, orderId);
      if (!data) {
        if (error === "Shipment already purchased") return;
        throw new Error(error || "Failed to purchase EasyPost shipment");
      }
      if (data.postage_label?.label_url) {
        await createAndStoreShippingDocs(shipment, orderId, data.postage_label.label_url, sessionId.toString());
      }
    }
  } else {
    // Create new shipment with auto-purchase (for "none" or "refunded" status)

    // Check if order already has an active purchased shipment (race condition prevention)
    const existingActiveShipment = await db.query.shipments.findFirst({
      where: { orderId, isPurchased: true, isRefunded: false },
    });

    if (existingActiveShipment) {
      // Already has active shipment - treat as success
      return;
    }

    // Fetch order from Shopify
    const { data: shopifyOrder } = await shopify.request(orderQuery, {
      variables: { id: orderId },
    });

    if (!shopifyOrder || shopifyOrder.node?.__typename !== "Order") {
      throw new Error("Order not found in Shopify");
    }

    const shopifyOrderData = shopifyOrder.node;

    // Get rate
    const { data: rateData, error: rateError } = await getRateForOrder(shopifyOrderData);
    if (!rateData) {
      throw new Error(rateError || "Failed to get rate");
    }

    // Store shipment
    const { data: shipment, error: shipmentError } = await storeShipmentAndRate(
      shopifyOrderData,
      rateData.rate,
      rateData.parcel
    );

    if (!shipment) {
      throw new Error(shipmentError || "Failed to store shipment");
    }

    // Purchase the shipment
    if (shipment.api === "SHIPPO") {
      const { data: purchaseData, error: purchaseError } = await purchaseShippoRateAndUpdateDatabase(
        shipment.id,
        orderId
      );
      if (purchaseData?.labelUrl) {
        await createAndStoreShippingDocs(shipment, orderId, purchaseData.labelUrl, sessionId.toString());
      } else if (purchaseError) {
        throw new Error(purchaseError);
      }
    } else if (shipment.api === "EASYPOST") {
      const { data: purchaseData, error: purchaseError } = await purchaseEasypostRateAndUpdateDatabase(
        shipment.id,
        orderId
      );
      if (purchaseData?.postage_label?.label_url) {
        await createAndStoreShippingDocs(shipment, orderId, purchaseData.postage_label.label_url, sessionId.toString());
      } else if (purchaseError) {
        throw new Error(purchaseError);
      }
    }
  }
}
