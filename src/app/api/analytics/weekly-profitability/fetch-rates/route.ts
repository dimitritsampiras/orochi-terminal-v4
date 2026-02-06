import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import shopify from "@/lib/clients/shopify";
import { batchOrdersForShippingQuery } from "@/lib/graphql/analytics.graphql";
import { getRateForOrder } from "@/lib/core/shipping/get-rate-for-order";
import { db } from "@/lib/clients/db";
import { shippingRateCache, orders } from "@drizzle/schema";
import { inArray, sql } from "drizzle-orm";
import { sleep } from "@/lib/utils";

const requestSchema = z.object({
  weekStart: z.string().transform((str) => new Date(str)),
  weekEnd: z.string().transform((str) => new Date(str)),
});

// Shopify nodes() query has a hard limit of 100 IDs per request
const SHOPIFY_BATCH_SIZE = 100;
// Rate processing batch size (matching orochi-portal)
const RATE_BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 200;
const SINGLE_ORDER_TIMEOUT_MS = 15000; // 15 second timeout per order (faster failure)

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, orderId: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * POST /api/analytics/weekly-profitability/fetch-rates
 * Fetch shipping rates for ALL orders without shipping in a week
 *
 * Optimized flow (matching orochi-portal pattern):
 * 1. Get order IDs without shipping from database
 * 2. Pre-fetch ALL Shopify order data in batches of 100 (reduces API calls dramatically)
 * 3. Process rate fetching in parallel batches of 12
 */
export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const body = requestSchema.parse(json);

    // Step 1: Get order IDs without shipping
    const ordersResponse = await fetch(
      `${request.nextUrl.origin}/api/analytics/weekly-profitability/orders-without-shipping?` +
      new URLSearchParams({
        startDate: body.weekStart.toISOString(),
        endDate: body.weekEnd.toISOString(),
      }),
      { headers: request.headers }
    );

    if (!ordersResponse.ok) {
      throw new Error("Failed to fetch orders without shipping");
    }

    const { orderIds } = await ordersResponse.json();

    if (orderIds.length === 0) {
      return NextResponse.json({
        totalEstimatedCost: 0,
        successCount: 0,
        failedCount: 0,
        failedOrders: [],
      });
    }

    console.log(`[fetch-rates] Starting: ${orderIds.length} orders to process`);

    // Step 1.5: Check cache for existing rates
    console.log(`[fetch-rates] Checking cache for existing rates...`);
    const now = new Date();
    const cachedRates = await db
      .select()
      .from(shippingRateCache)
      .where(inArray(shippingRateCache.orderId, orderIds));

    const cacheMap = new Map<string, { cost: number; isValid: boolean }>();
    let cachedCount = 0;
    let cachedCost = 0;

    for (const cached of cachedRates) {
      const isValid = new Date(cached.expiresAt) > now;
      if (isValid && cached.rate && typeof cached.rate === 'object') {
        const rate = cached.rate as { rate?: { cost?: number } };
        const cost = rate.rate?.cost;
        if (cost !== undefined) {
          cacheMap.set(cached.orderId, { cost, isValid: true });
          cachedCount++;
          cachedCost += cost;
        }
      }
    }

    // Filter out orders that have valid cached rates
    const uncachedOrderIds = orderIds.filter((id: string) => !cacheMap.has(id));
    console.log(`[fetch-rates] Cache hit: ${cachedCount} orders ($${cachedCost.toFixed(2)}), ${uncachedOrderIds.length} need fetching`);

    // If all orders are cached, return early
    if (uncachedOrderIds.length === 0) {
      return NextResponse.json({
        totalEstimatedCost: cachedCost,
        successCount: cachedCount,
        failedCount: 0,
        failedOrders: [],
        fromCache: true,
      });
    }

    // Step 2: Pre-fetch ALL Shopify order data in batches of 100
    // This is the key optimization - reduces API calls from N to ceil(N/100)
    console.log(`[fetch-rates] Phase 1: Pre-fetching Shopify data in batches of ${SHOPIFY_BATCH_SIZE}`);

    const orderMap = new Map<string, any>();
    const shopifyFetchErrors: Array<{ orderId: string; error: string }> = [];
    const totalShopifyBatches = Math.ceil(uncachedOrderIds.length / SHOPIFY_BATCH_SIZE);

    for (let i = 0; i < uncachedOrderIds.length; i += SHOPIFY_BATCH_SIZE) {
      const batch = uncachedOrderIds.slice(i, i + SHOPIFY_BATCH_SIZE);
      const batchNum = Math.floor(i / SHOPIFY_BATCH_SIZE) + 1;

      try {
        const { data, errors } = await shopify.request(batchOrdersForShippingQuery, {
          variables: { ids: batch },
        });

        if (errors) {
          console.error(`[fetch-rates] Shopify GraphQL errors in batch ${batchNum}:`, errors);
          batch.forEach((id: string) => shopifyFetchErrors.push({ orderId: id, error: "GraphQL error" }));
          continue;
        }

        if (data?.nodes) {
          let validCount = 0;
          for (const node of data.nodes) {
            if (node?.__typename === "Order") {
              orderMap.set(node.id, node);
              validCount++;
            }
          }
          console.log(`[fetch-rates] Shopify batch ${batchNum}/${totalShopifyBatches}: fetched ${validCount}/${batch.length} orders`);
        }
      } catch (error) {
        console.error(`[fetch-rates] Shopify API error in batch ${batchNum}:`, error);
        batch.forEach((id: string) => shopifyFetchErrors.push({
          orderId: id,
          error: error instanceof Error ? error.message : "Unknown error"
        }));
      }
    }

    console.log(`[fetch-rates] Shopify pre-fetch complete: ${orderMap.size} orders loaded, ${shopifyFetchErrors.length} failed`);

    // Step 3: Process rate fetching in parallel batches of 12
    console.log(`[fetch-rates] Phase 2: Fetching rates in batches of ${RATE_BATCH_SIZE}`);

    // Start with cached results
    let totalEstimatedCost = cachedCost;
    let successCount = cachedCount;
    const failedOrders: Array<{ orderId: string; error: string }> = [...shopifyFetchErrors];
    const ratesToCache: Array<{ orderId: string; rate: any }> = [];

    // Only process orders that were successfully fetched from Shopify
    const ordersToProcess = uncachedOrderIds.filter((id: string) => orderMap.has(id));
    const totalRateBatches = Math.ceil(ordersToProcess.length / RATE_BATCH_SIZE);

    for (let i = 0; i < ordersToProcess.length; i += RATE_BATCH_SIZE) {
      const batch = ordersToProcess.slice(i, i + RATE_BATCH_SIZE);
      const batchNum = Math.floor(i / RATE_BATCH_SIZE) + 1;

      // Process batch in parallel with timeout protection
      const results = await Promise.allSettled(
        batch.map(async (orderId: string) => {
          return withTimeout(
            (async () => {
              try {
                const order = orderMap.get(orderId);
                if (!order) {
                  return { orderId, error: "Order not in cache" };
                }

                const { data, error } = await getRateForOrder(order, { shippingPriority: 'standard', withLogs: false });

                if (!data || error) {
                  return { orderId, error: error || "Unknown error" };
                }

                return { orderId, cost: data.rate.cost, rateData: data };
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : "Unknown error";
                return { orderId, error: errorMsg };
              }
            })(),
            SINGLE_ORDER_TIMEOUT_MS,
            orderId
          );
        })
      );

      // Process results and track per-batch stats
      let batchSuccess = 0;
      let batchFailed = 0;

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          const value = result.value;
          if (value.cost !== undefined) {
            totalEstimatedCost += value.cost;
            successCount++;
            batchSuccess++;
            // Collect rate data for caching
            if (value.rateData) {
              ratesToCache.push({ orderId: value.orderId, rate: value.rateData });
            }
          } else if (value.error) {
            failedOrders.push({ orderId: value.orderId, error: value.error });
            batchFailed++;
          }
        } else {
          // Promise rejected (timeout or unexpected error)
          const orderId = batch[j];
          const errorMsg = result.reason instanceof Error ? result.reason.message : "Unknown error";
          failedOrders.push({ orderId, error: errorMsg });
          batchFailed++;
          // Suppressed: Analytics context, avoid polluting logs with rate fetch failures
          // logger.warn(`[fetch-rates] Promise rejected for order ${orderId}: ${errorMsg}`, {
          //   category: "SHIPPING",
          //   orderId,
          // }, { suppress: true });
        }
      }

      // Display per-batch results including failures
      console.log(
        `[fetch-rates] Batch ${batchNum}/${totalRateBatches}: ` +
        `✓ ${batchSuccess} success, ✗ ${batchFailed} failed | ` +
        `Progress: ${i + batch.length}/${ordersToProcess.length}`
      );

      // Delay between batches (except for last batch)
      if (i + RATE_BATCH_SIZE < ordersToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    console.log(
      `[fetch-rates] Complete! ` +
      `✓ ${successCount} success (${cachedCount} cached), ✗ ${failedOrders.length} failed | ` +
      `Total estimated cost: $${totalEstimatedCost.toFixed(2)}`
    );

    // Step 4: Store fetched rates in cache (7-day expiration)
    // Only cache rates for orders that exist in the local database (FK constraint)
    if (ratesToCache.length > 0) {
      // Check which orders exist in DB
      const orderIdsToCache = ratesToCache.map(r => r.orderId);
      const existingOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.id, orderIdsToCache));

      const existingOrderIds = new Set(existingOrders.map(o => o.id));

      // Log drift orders (in Shopify but not in DB)
      const driftOrders = orderIdsToCache.filter(id => !existingOrderIds.has(id));
      if (driftOrders.length > 0) {
        // Extract just the order number from the GID for cleaner logging
        const driftOrderNumbers = driftOrders.map(id => id.replace('gid://shopify/Order/', ''));
        console.log(`[DRIFT] ${driftOrders.length} orders in Shopify but not in local DB:`);
        console.log(`[DRIFT] Order IDs: ${driftOrderNumbers.join(', ')}`);
      }

      // Filter to only cache orders that exist in DB
      const cacheable = ratesToCache.filter(r => existingOrderIds.has(r.orderId));

      if (cacheable.length > 0) {
        console.log(`[fetch-rates] Caching ${cacheable.length} rates (${driftOrders.length} skipped - not in DB)...`);
        const cacheExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        try {
          await db.insert(shippingRateCache)
            .values(cacheable.map(r => ({
              orderId: r.orderId,
              rate: r.rate,
              expiresAt: cacheExpiry,
            })))
            .onConflictDoUpdate({
              target: shippingRateCache.orderId,
              set: {
                rate: sql`excluded.rate`,
                expiresAt: sql`excluded.expires_at`,
              },
            });
          console.log(`[fetch-rates] Successfully cached ${cacheable.length} rates`);
        } catch (cacheError) {
          console.error(`[fetch-rates] Failed to cache rates:`, cacheError);
          // Don't fail the request if caching fails
        }
      } else {
        console.log(`[fetch-rates] No rates to cache (all ${driftOrders.length} orders not in DB)`);
      }
    }

    return NextResponse.json({
      totalEstimatedCost,
      successCount,
      failedCount: failedOrders.length,
      failedOrders: failedOrders.length > 0 ? failedOrders : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Failed to fetch rates:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
