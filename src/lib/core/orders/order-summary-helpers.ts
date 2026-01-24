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
 */
export const getOrderPositionInQueue = async (
    orderId: string
): Promise<{ orderPosition: number; count: number }> => {
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
 * Get order's current fulfillment stage
 */
export const getOrderStage = async (order: OrderWithShipments): Promise<OrderDetails["statusInfo"]> => {
    try {
        const averageDailyOrderOutput = getAverageDailyOrderOutput();
        const { orderPosition } = await getOrderPositionInQueue(order.id);

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
            const shipmentInfo = await getShipmentInfo(order);
            if (shipmentInfo) {
                return {
                    status: "shipped",
                    daysToNext: null,
                    shipmentInfo,
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
 */
export const getOrderTimeline = async (order: OrderWithShipments): Promise<OrderDetails["timeline"]> => {
    try {
        const { orderPosition, count } = await getOrderPositionInQueue(order.id);
        const averageDailyOrderOutput = getAverageDailyOrderOutput();
        const estimatedDaysInQueue = Math.ceil(orderPosition / averageDailyOrderOutput);

        // Get batch information via raw SQL query to avoid Drizzle relational issues
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

        // Build shipment timeline
        const shipmentTimeline = await Promise.all(
            order.shipments.map(async (shipment) => {
                let status: string | null = null;

                try {
                    if (shipment.api === "SHIPPO" && shipment.shippoTransactionId) {
                        const transaction = await shippo.transactions.get(shipment.shippoTransactionId).catch(() => null);
                        status = transaction?.trackingStatus || null;
                    } else if (shipment.api === "EASYPOST") {
                        const s = await easypost.Shipment.retrieve(shipment.shipmentId);
                        status = s.tracker?.status || null;
                    }
                } catch (e) {
                    console.error("Error getting shipment status:", e);
                }

                return {
                    shipmentId: shipment.id,
                    createdAt: shipment.createdAt.toISOString(),
                    carrier: shipment.chosenCarrierName,
                    trackingNumber: shipment.trackingNumber,
                    status,
                    isPurchased: shipment.isPurchased,
                    isRefunded: shipment.isRefunded,
                };
            })
        );

        return {
            orderCreated: order.createdAt?.toISOString() || null,
            orderUpdated: order.updatedAt?.toISOString() || null,
            queuePosition: orderPosition,
            totalOrdersInQueue: count,
            estimatedDaysInQueue,
            batchInformation,
            shipmentTimeline: shipmentTimeline.length > 0 ? shipmentTimeline : null,
        };
    } catch (error) {
        console.error("Error fetching timeline data:", error);
        return null;
    }
};

/**
 * Get complete order details for the summary endpoint
 */
export const getOrderDetails = async (
    order: OrderWithShipments,
    shopifyOrder: ShopifyOrder
): Promise<OrderDetails> => {
    const stage = await getOrderStage(order);
    const stageDescription = PRESHIPMENT_STAGES.find((s) => s.name === stage?.status)?.description;
    const timeline = await getOrderTimeline(order);

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
