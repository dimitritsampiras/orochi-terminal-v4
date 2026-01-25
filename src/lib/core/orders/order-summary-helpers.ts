import { db } from "@/lib/clients/db";
import { shippo } from "@/lib/clients/shippo";
import { easypost } from "@/lib/clients/easypost";
import { orders, shipments, batches, ordersBatches } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import dayjs from "dayjs";
import { z } from "zod";
import { getOrderQueue } from "./get-order-queue";

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

export const orderDetailsSchema = z.object({
    name: z.string(),
    cancelledAt: z.string().nullable(),
    shippingMethod: z.string(),
    statusInfo: z
        .object({
            status: z.enum(["queued", "sourcing", "processing", "shipped"]),
            daysToNext: z.number().nullable(),
            estimatedShipDate: z.string(),
            stageNumber: z.number(),
            shipmentInfo: z
                .object({
                    trackingStatus: z.string(),
                    trackingNumber: z.string(),
                    trackingURL: z.string(),
                    carrier: z.string(),
                })
                .nullable(),
        })
        .nullable(),
    totalStages: z.number(),
    stageDescription: z.string().optional(),
    timeline: z
        .object({
            orderCreated: z.string().nullable(),
            orderUpdated: z.string().nullable(),
            queuePosition: z.number().nullable(),
            totalOrdersInQueue: z.number().nullable(),
            estimatedDaysInQueue: z.number().nullable(),
            batchInformation: z
                .object({
                    batchId: z.number().nullable(),
                    batchCreated: z.string().nullable(),
                    isActive: z.boolean().nullable(),
                })
                .nullable(),
            shipmentTimeline: z
                .array(
                    z.object({
                        shipmentId: z.string(),
                        createdAt: z.string().nullable(),
                        carrier: z.string().nullable(),
                        trackingNumber: z.string().nullable(),
                        status: z.string().nullable(),
                        isPurchased: z.boolean().nullable(),
                        isRefunded: z.boolean().nullable(),
                    })
                )
                .nullable(),
        })
        .nullable(),
});

export type OrderDetails = z.infer<typeof orderDetailsSchema>;

type OrderWithShipments = typeof orders.$inferSelect & {
    shipments: (typeof shipments.$inferSelect)[];
};

interface ShopifyOrder {
    __typename: "Order";
    name: string;
    cancelledAt: string | null;
}

const PRESHIPMENT_STAGES = [
    { name: "queued", description: "Your order is in our fulfillment queue." },
    { name: "sourcing", description: "We're preparing your items for production." },
    { name: "processing", description: "Your order is being printed and packed." },
    { name: "shipped", description: "Your order has shipped and is on its way!" },
];

// ============================================================================
// QUEUE POSITION CACHE
// ============================================================================

interface QueuePositionData {
    orderPosition: number;
    count: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get average daily order output - default to 10 orders per day
 */
export const getAverageDailyOrderOutput = (): number => {
    // Simplified version - returns a reasonable default
    return 10;
};

/**
 * Get order's position in the fulfillment queue using existing getOrderQueue
 * Can accept pre-fetched queue position data to avoid duplicate queries
 */
export const getOrderPositionInQueue = async (
    orderId: string,
    cachedQueueData?: QueuePositionData
): Promise<{ orderPosition: number; count: number }> => {
    // If we have cached data, return it immediately
    if (cachedQueueData) {
        return cachedQueueData;
    }

    try {
        const queue = await getOrderQueue({ withItemData: false, withBatchData: false });
        const orderPosition = queue.findIndex((o) => o.id === orderId);
        return {
            orderPosition: orderPosition === -1 ? 0 : orderPosition,
            count: queue.length,
        };
    } catch (error) {
        console.error("Error getting order position in queue:", error);
        return { orderPosition: 0, count: 0 };
    }
};

/**
 * Get shipment tracking info from Shippo or EasyPost
 */
const getShipmentInfo = async (
    order: OrderWithShipments
): Promise<{ trackingStatus: string; trackingNumber: string; trackingURL: string; carrier: string } | null> => {
    const purchasedShipments = order.shipments
        .filter((s) => s.isPurchased && !s.isRefunded)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const lastShipment = purchasedShipments[0];
    if (!lastShipment) return null;

    try {
        if (lastShipment.api === "SHIPPO" && lastShipment.shippoTransactionId) {
            const transaction = await shippo.transactions.get(lastShipment.shippoTransactionId).catch(() => null);

            if (transaction?.trackingStatus) {
                return {
                    trackingStatus: transaction.trackingStatus,
                    trackingNumber: transaction.trackingNumber || "",
                    trackingURL: transaction.trackingUrlProvider || "",
                    carrier: lastShipment.chosenCarrierName || "",
                };
            }
        }

        if (lastShipment.api === "EASYPOST") {
            const shipment = await easypost.Shipment.retrieve(lastShipment.shipmentId);
            if (shipment.tracker?.status) {
                return {
                    trackingStatus: shipment.tracker.status,
                    trackingNumber: shipment.tracker.tracking_code,
                    trackingURL: shipment.tracker.public_url,
                    carrier: shipment.tracker.carrier,
                };
            }
        }
    } catch (error) {
        console.error("Error getting shipment info:", error);
    }

    return null;
};

/**
 * Shared helper to fetch tracking data for a single shipment
 */
const getShipmentTrackingData = async (shipment: typeof shipments.$inferSelect) => {
    let status: string | null = null;
    let trackingNumber: string | null = shipment.trackingNumber;
    let trackingURL: string | null = null; // trackingURL not stored in DB, retrieved from API
    let carrier: string | null = shipment.chosenCarrierName;

    try {
        if (shipment.api === "SHIPPO" && shipment.shippoTransactionId) {
            const transaction = await shippo.transactions.get(shipment.shippoTransactionId).catch(() => null);
            status = transaction?.trackingStatus || null;
            trackingNumber = transaction?.trackingNumber || trackingNumber;
            trackingURL = transaction?.trackingUrlProvider || null;
            carrier = shipment.chosenCarrierName || ""; // Shippo transaction doesn't always have carrier name easily
        } else if (shipment.api === "EASYPOST") {
            const s = await easypost.Shipment.retrieve(shipment.shipmentId);
            status = s.tracker?.status || null;
            trackingNumber = s.tracker?.tracking_code || trackingNumber;
            trackingURL = s.tracker?.public_url || null;
            carrier = s.tracker?.carrier || carrier;
        }
    } catch (e) {
        console.error("Error getting shipment status:", e);
    }

    return {
        shipmentId: shipment.id,
        status,
        trackingNumber,
        trackingURL,
        carrier,
        createdAt: shipment.createdAt,
        isPurchased: shipment.isPurchased,
        isRefunded: shipment.isRefunded
    };
};

/**
 * Get order's current fulfillment stage
 * @param order - The order with shipments
 * @param cachedQueueData - Pre-fetched queue position data
 * @param cachedShipmentData - Pre-fetched shipment tracking data
 */
export const getOrderStage = async (
    order: OrderWithShipments,
    cachedQueueData?: QueuePositionData,
    cachedShipmentData?: Awaited<ReturnType<typeof getShipmentTrackingData>>[]
): Promise<OrderDetails["statusInfo"]> => {
    try {
        const averageDailyOrderOutput = getAverageDailyOrderOutput();
        const { orderPosition } = await getOrderPositionInQueue(order.id, cachedQueueData);

        const daysTilInSession = Math.ceil(orderPosition / averageDailyOrderOutput);
        const estimatedShipDate = dayjs()
            .add(daysTilInSession + 3, "days")
            .toISOString();

        // If order is still in queue
        if (order.queued) {
            if (orderPosition > averageDailyOrderOutput) {
                return {
                    status: "queued",
                    daysToNext: Math.ceil(orderPosition / averageDailyOrderOutput) + 1,
                    estimatedShipDate,
                    stageNumber: 1,
                    shipmentInfo: null,
                };
            } else {
                return {
                    status: "sourcing",
                    daysToNext: 2,
                    estimatedShipDate,
                    stageNumber: 2,
                    shipmentInfo: null,
                };
            }
        }

        // Check if shipped
        if (order.shipments.length > 0) {
            // Find the latest valid shipment from cached data if available, or compute locally (avoid if possible)
            let latestShipmentInfo = null;

            if (cachedShipmentData) {
                // Use cached data
                const validShipments = cachedShipmentData
                    .filter(s => s.isPurchased && !s.isRefunded)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

                if (validShipments.length > 0) {
                    const latest = validShipments[0];
                    if (latest.status) {
                        latestShipmentInfo = {
                            trackingStatus: latest.status,
                            trackingNumber: latest.trackingNumber || "",
                            trackingURL: latest.trackingURL || "",
                            carrier: latest.carrier || ""
                        };
                    }
                }
            } else {
                // Fallback (redundant, but keeps signature valid if called without cache)
                const shipmentInfo = await getShipmentInfo(order);
                latestShipmentInfo = shipmentInfo;
            }

            if (latestShipmentInfo) {
                return {
                    status: "shipped",
                    daysToNext: null,
                    shipmentInfo: latestShipmentInfo,
                    estimatedShipDate,
                    stageNumber: 4,
                };
            }
        }

        // Default: processing
        return {
            status: "processing",
            daysToNext: 1,
            estimatedShipDate,
            stageNumber: 3,
            shipmentInfo: null,
        };
    } catch (error) {
        console.error("Error getting order stage:", error);
        return {
            status: "processing" as const,
            daysToNext: 1,
            estimatedShipDate: dayjs().add(3, "days").toISOString(),
            stageNumber: 3,
            shipmentInfo: null,
        };
    }
};

/**
 * Get order timeline including queue position and batch info
 * @param order - The order with shipments
 * @param cachedQueueData - Pre-fetched queue position data
 * @param cachedShipmentData - Pre-fetched shipment tracking data
 */
export const getOrderTimeline = async (
    order: OrderWithShipments,
    cachedQueueData?: QueuePositionData,
    cachedShipmentData?: Awaited<ReturnType<typeof getShipmentTrackingData>>[]
): Promise<OrderDetails["timeline"]> => {
    try {
        const { orderPosition, count } = await getOrderPositionInQueue(order.id, cachedQueueData);
        const averageDailyOrderOutput = getAverageDailyOrderOutput();
        const estimatedDaysInQueue = Math.ceil(orderPosition / averageDailyOrderOutput);

        // Get batch information via raw SQL query
        const orderBatchResult = await db
            .select({ batchId: ordersBatches.batchId })
            .from(ordersBatches)
            .where(eq(ordersBatches.orderId, order.id))
            .limit(1);

        let batchInformation = null;
        if (orderBatchResult.length > 0 && orderBatchResult[0].batchId) {
            const batchResult = await db
                .select()
                .from(batches)
                .where(eq(batches.id, orderBatchResult[0].batchId))
                .limit(1);

            if (batchResult.length > 0) {
                const batch = batchResult[0];
                batchInformation = {
                    batchId: batch.id,
                    batchCreated: batch.createdAt.toISOString(),
                    isActive: batch.active,
                };
            }
        }

        // Build shipment timeline using cached data if available
        let shipmentTimelineResults;

        if (cachedShipmentData) {
            shipmentTimelineResults = cachedShipmentData.map(s => ({
                shipmentId: s.shipmentId,
                createdAt: s.createdAt.toISOString(),
                carrier: s.carrier,
                trackingNumber: s.trackingNumber,
                status: s.status,
                isPurchased: s.isPurchased,
                isRefunded: s.isRefunded
            }));
        } else {
            // Fallback to fetch individually
            shipmentTimelineResults = await Promise.all(
                order.shipments.map(async (shipment) => {
                    const data = await getShipmentTrackingData(shipment);
                    return {
                        shipmentId: data.shipmentId,
                        createdAt: data.createdAt.toISOString(),
                        carrier: data.carrier,
                        trackingNumber: data.trackingNumber,
                        status: data.status,
                        isPurchased: data.isPurchased,
                        isRefunded: data.isRefunded
                    };
                })
            );
        }

        return {
            orderCreated: order.createdAt?.toISOString() || null,
            orderUpdated: order.updatedAt?.toISOString() || null,
            queuePosition: orderPosition,
            totalOrdersInQueue: count,
            estimatedDaysInQueue,
            batchInformation,
            shipmentTimeline: shipmentTimelineResults.length > 0 ? shipmentTimelineResults : null,
        };
    } catch (error) {
        console.error("Error fetching timeline data:", error);
        return null;
    }
};

/**
 * Get complete order details for the summary endpoint
 * Optimized to fetch heavy data in parallel once
 */
export const getOrderDetails = async (
    order: OrderWithShipments,
    shopifyOrder: ShopifyOrder
): Promise<OrderDetails> => {
    // OPTIMIZATION: Fetch heavy external data in parallel
    // 1. Queue Position (DB)
    // 2. Shipment Tracking (External APIs - Shippo/EasyPost)
    const [queueData, shipmentData] = await Promise.all([
        getOrderPositionInQueue(order.id),
        Promise.all(order.shipments.map(s => getShipmentTrackingData(s)))
    ]);

    // OPTIMIZATION: Run independent stage and timeline calculations in parallel
    // passing the pre-fetched data
    const [stage, timeline] = await Promise.all([
        getOrderStage(order, queueData, shipmentData),
        getOrderTimeline(order, queueData, shipmentData)
    ]);

    const stageDescription = PRESHIPMENT_STAGES.find((s) => s.name === stage?.status)?.description;

    return {
        name: order.name,
        cancelledAt: shopifyOrder.cancelledAt,
        shippingMethod: order.shippingPriority,
        statusInfo: stage,
        totalStages: 4,
        stageDescription,
        timeline,
    };
};
