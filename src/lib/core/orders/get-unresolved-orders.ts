import { db } from "@/lib/clients/db";

// 1) an order is not fulfilled, not queued, and is in zero batches/sessions
export const ordersWithNoSessionHistory = async () => {
  const orders = await db.query.orders.findMany({
    where: {
      displayFulfillmentStatus: { ne: "FULFILLED" },
      queued: false,
      displayIsCancelled: false,
    },
    with: {
      batches: {
        columns: {
          id: true,
        },
      },
      logs: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Filter to only orders with zero batch history
  return orders.filter((order) => {
    const nonAutomatedLogs = order.logs.filter((log) => log.category !== "AUTOMATED");

    return order.batches.length === 0 && nonAutomatedLogs.length <= 3; // account for VA actions
  });
};

/**
 * orders that are not:
 * - fulfilled
 * - queued
 * - cancelled
 * - who's latest session was more than a week
 * - no "resolved" order holds
 */
export const ordersGoneStale = async () => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const orders = await db.query.orders.findMany({
    where: {
      displayFulfillmentStatus: { ne: "FULFILLED" },
      queued: false,
      displayIsCancelled: false,
    },
    with: {
      batches: {
        columns: {
          id: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        limit: 1,
      },
      orderHolds: {
        columns: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return orders.filter((order) => {
    // Must have at least one batch
    if (order.batches.length === 0) return false;

    // Latest batch must be older than a week
    const latestBatch = order.batches[0];
    if (latestBatch.createdAt > oneWeekAgo) return false;

    // must show no order holds
    const hasNoOrderHolds = order.orderHolds.length === 0;
    if (!hasNoOrderHolds) return false;

    return true;
  });
};

export type OrdersGoneStale = Awaited<ReturnType<typeof ordersGoneStale>>;
