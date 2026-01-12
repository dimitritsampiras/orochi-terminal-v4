import { db } from "@/lib/clients/db";
import { unstable_cache } from "next/cache";

// 1) an order is not fulfilled, not queued, and is in zero batches/sessions
const _ordersWithNoSessionHistory = async () => {
  const orders = await db.query.orders.findMany({
    where: {
      createdAt: { gte: new Date("2025-06-01") },
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

export const ordersWithNoSessionHistory = unstable_cache(
  _ordersWithNoSessionHistory,
  ["orders-with-no-session-history"],
  { revalidate: 300, tags: ["dashboard-stats"] } // 5 minutes cache
);

/**
 * orders that are not:
 * - fulfilled
 * - queued
 * - cancelled
 * - who's latest session was more than a week
 * - no "resolved" order holds
 */
const _ordersGoneStale = async () => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const orders = await db.query.orders.findMany({
    where: {
      createdAt: { gte: new Date("2025-06-01") },
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

export const ordersGoneStale = unstable_cache(
  _ordersGoneStale,
  ["orders-gone-stale"],
  { revalidate: 300, tags: ["dashboard-stats"] } // 5 minutes cache
);

const _activeOrderHolds = async () => {
  const activeHolds = await db.query.orderHolds.findMany({
    where: {
      resolvedAt: { isNull: true },
    },
  });
  return activeHolds;
};

export const activeOrderHolds = unstable_cache(
  _activeOrderHolds,
  ["active-order-holds"],
  { revalidate: 300, tags: ["dashboard-stats"] } // 5 minutes cache
);

/** @deprecated Use `activeOrderHolds` instead */
export const activeOrdeHolds = activeOrderHolds;

export type OrdersGoneStale = Awaited<ReturnType<typeof _ordersGoneStale>>;
export type OrdersWithNoSessionHistory = Awaited<ReturnType<typeof _ordersWithNoSessionHistory>>;
