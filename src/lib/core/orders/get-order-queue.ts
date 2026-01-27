import { db } from "@/lib/clients/db";
import { fulfillmentPriority, shippingPriority } from "@drizzle/schema";
import dayjs from "dayjs";

// Define strict scores for hierarchy
const FULFILLMENT_SCORE = {
  critical: 4,
  urgent: 3,
  priority: 2, // Included 'priority' from schema between normal/urgent
  normal: 1,
  low: 0,
};

const SHIPPING_SCORE = {
  fastest: 2,
  express: 1,
  standard: 0,
};

type Options = {
  withItemData?: boolean;
  withBatchData?: boolean;
};

export const getOrderQueue = async (
  options: Options = {
    withItemData: true,
    withBatchData: true,
  }
) => {
  try {
    // Run both queries in parallel
    const [queue, activeHolds] = await Promise.all([
      db.query.orders.findMany({
        where: {
          createdAt: { gte: new Date("2024-01-01") },
          displayIsCancelled: false,
          queued: true,
          displayFulfillmentStatus: { ne: "FULFILLED" },
        },
        with: {
          batches: {
            columns: {
              id: true,
              createdAt: true,
            },
          },
          lineItems: {
            columns: {
              id: true,
              name: true,
              productId: true,
              quantity: true,
              requiresShipping: true,
            },
            with: {
              productVariant: {
                columns: {
                  blankVariantId: true,
                  id: true,
                },
              },
              product: {
                columns: {
                  id: true,
                  isBlackLabel: true,
                  blankId: true,
                },
              },
            },
          },
        },
      }),
      // Small query - just get order IDs with active holds
      db.query.orderHolds.findMany({
        where: { isResolved: false },
        columns: { orderId: true },
      }),
    ]);

    // Create a Set for O(1) lookup
    const ordersWithHolds = new Set(activeHolds.map((h) => h.orderId));

    const now = dayjs();
    const cutoffDate = now.subtract(28, "day");

    const EXCLUDED_PRODUCT_ID = "gid://shopify/Product/9127560413398";

    return queue
      .filter((order) => !ordersWithHolds.has(order.id))
      .filter((order) => !order.lineItems.some((item) => item.productId === EXCLUDED_PRODUCT_ID))
      .sort((a, b) => {
        // Helper to get effective fulfillment score (Promotes Low -> Normal if old)
        const getFulfillmentScore = (order: (typeof queue)[number]) => {
          const rawPrio = order.fulfillmentPriority;
          // Default to normal (1) if unknown
          let score = FULFILLMENT_SCORE[rawPrio as keyof typeof FULFILLMENT_SCORE] ?? 1;

          // Logic: Promote 'low' to 'normal' if older than 28 days
          if (rawPrio === "low" && order.createdAt && dayjs(order.createdAt).isBefore(cutoffDate)) {
            score = FULFILLMENT_SCORE.normal;
          }
          return score;
        };

        const scoreA = getFulfillmentScore(a);
        const scoreB = getFulfillmentScore(b);

        // 1. Fulfillment Priority (Descending: Critical > Urgent > Normal > Low)
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        // 2. Shipping Priority (Descending: Fastest > Express > Standard)
        const shipA = SHIPPING_SCORE[a.shippingPriority as keyof typeof SHIPPING_SCORE] ?? 0;
        const shipB = SHIPPING_SCORE[b.shippingPriority as keyof typeof SHIPPING_SCORE] ?? 0;

        if (shipA !== shipB) {
          return shipB - shipA;
        }

        // 3. Creation Date (Ascending: Oldest orders first)
        const dateA = a.createdAt ? dayjs(a.createdAt).valueOf() : Number.MAX_SAFE_INTEGER;
        const dateB = b.createdAt ? dayjs(b.createdAt).valueOf() : Number.MAX_SAFE_INTEGER;

        return dateA - dateB;
      });
  } catch (error) {
    console.error("Error getting order queue", error);
    return [];
  }
};

export type OrderQueue = Awaited<ReturnType<typeof getOrderQueue>>;
