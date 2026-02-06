#!/usr/bin/env tsx

/**
 * Cache Shipping Rates Script
 *
 * Fetches and caches shipping rates for all queued orders in the database.
 * This is a standalone script that bypasses web server timeout limits.
 *
 * Usage:
 *   pnpm cache-rates
 */

// Load environment variables from .env file
import 'dotenv/config';

import { db } from "@/lib/clients/db";
import {
    orders,
    lineItems,
    shippingRateCache,
} from "@drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { fetchShopifyOrder } from "@/lib/core/shipping/fetch-shopify-order";
import { getRateForOrder } from "@/lib/core/shipping/get-rate-for-order";

const BATCH_SIZE = 12;
const DELAY_BETWEEN_BATCHES_MS = 150;
const PROGRESS_BAR_WIDTH = 24;

function renderProgress(done: number, total: number, label?: string): void {
    if (total === 0) return;
    const pct = done / total;
    const filled = Math.round(PROGRESS_BAR_WIDTH * pct);
    const bar = '█'.repeat(filled) + '░'.repeat(PROGRESS_BAR_WIDTH - filled);
    const pctStr = (pct * 100).toFixed(0);
    const tail = label ? ` — ${label}` : '';
    process.stdout.write(`\r  Progress [${bar}] ${done}/${total} (${pctStr}%)${tail}    `);
}

async function main() {
    console.log('🚢 Caching shipping rates for all queued orders...\n');

    // 1. Fetch all queued, unfulfilled orders
    const queuedOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
            and(
                eq(orders.queued, true),
                eq(orders.displayIsCancelled, false),
                sql`${orders.displayFulfillmentStatus} NOT IN ('FULFILLED', 'RESTOCKED')`
            )
        );

    const total = queuedOrders.length;
    const orderIds = queuedOrders.map(o => o.id);

    if (total === 0) {
        console.log('✅ No queued orders found. Nothing to do!');
        return;
    }

    console.log(`📦 Found ${total} queued orders\n`);

    // 2. Bulk fetch existing cache entries
    console.log('🔍 Checking existing cache...');
    const allCachedEntries = await db
        .select()
        .from(shippingRateCache)
        .where(inArray(shippingRateCache.orderId, orderIds));

    const cacheMap = new Map();
    for (const entry of allCachedEntries) {
        cacheMap.set(entry.orderId, entry);
    }

    // 3. Bulk fetch line item IDs from database (for explicit selection)
    const orderLineItems = await db
        .select({
            orderId: lineItems.orderId,
            lineItemId: lineItems.id
        })
        .from(lineItems)
        .where(
            and(
                inArray(lineItems.orderId, orderIds),
                eq(lineItems.requiresShipping, true)
            )
        );

    const lineItemMap = new Map<string, string[]>();
    for (const item of orderLineItems) {
        const existing = lineItemMap.get(item.orderId!) || [];
        existing.push(item.lineItemId);
        lineItemMap.set(item.orderId!, existing);
    }

    // 4. Separate cached (fresh) vs needs fetching
    const now = new Date();
    const cachedOrders: string[] = [];
    const needsFreshRates: Array<{ id: string }> = [];

    for (const order of queuedOrders) {
        const cached = cacheMap.get(order.id);
        if (cached && new Date(cached.expiresAt) > now) {
            cachedOrders.push(order.id);
        } else {
            needsFreshRates.push(order);
        }
    }

    console.log(`✓ ${cachedOrders.length} orders have fresh cache`);
    console.log(`⚡ ${needsFreshRates.length} orders need rate fetching\n`);

    if (needsFreshRates.length === 0) {
        console.log('✅ All rates are already cached!');
        return;
    }

    // 5. Process orders in batches
    let successCount = 0;
    let noRateCount = 0;
    let errorCount = 0;
    let processed = 0;

    console.log(`🚀 Fetching rates in batches of ${BATCH_SIZE}...\n`);

    for (let i = 0; i < needsFreshRates.length; i += BATCH_SIZE) {
        const batch = needsFreshRates.slice(i, i + BATCH_SIZE);

        const ratesToInsert: any[] = [];

        // Process batch concurrently
        const settled = await Promise.allSettled(batch.map(async (order) => {
            try {
                // Fetch live Shopify order
                const shopifyOrder = await fetchShopifyOrder(order.id);

                if (!shopifyOrder) {
                    return { type: 'no-rate' as const };
                }

                // Get line items from database for explicit selection
                const targetLineItemIds = lineItemMap.get(order.id) || [];

                if (targetLineItemIds.length === 0) {
                    return { type: 'no-rate' as const };
                }

                // Fetch shipping rate with explicit line item selection
                const rateResult = await getRateForOrder(shopifyOrder as any, {
                    targetLineItemIds,
                    withLogs: false
                });

                if (rateResult.error) {
                    if (rateResult.error.includes("No fulfillable") || rateResult.error.includes("No items")) {
                        return { type: 'no-rate' as const };
                    }
                    return { type: 'error' as const, error: rateResult.error };
                }

                if (rateResult.data) {
                    return {
                        type: 'success' as const,
                        rateData: {
                            orderId: order.id,
                            rate: rateResult.data,
                            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        }
                    };
                }

                return { type: 'no-rate' as const };
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                return { type: 'error' as const, error: errorMsg };
            }
        }));

        // Process results
        for (const result of settled) {
            if (result.status === 'fulfilled') {
                const val = result.value;
                if (val.type === 'success') {
                    successCount++;
                    ratesToInsert.push(val.rateData);
                } else if (val.type === 'no-rate') {
                    noRateCount++;
                } else {
                    errorCount++;
                }
            } else {
                errorCount++;
            }
        }

        // Bulk insert cache entries
        if (ratesToInsert.length > 0) {
            try {
                await db.insert(shippingRateCache)
                    .values(ratesToInsert)
                    .onConflictDoUpdate({
                        target: shippingRateCache.orderId,
                        set: {
                            rate: sql`excluded.rate`,
                            expiresAt: sql`excluded.expires_at`
                        }
                    });
            } catch (err) {
                console.error("\nBulk cache insert failed:", err);
            }
        }

        processed += batch.length;
        renderProgress(processed, needsFreshRates.length, `Batch ${Math.floor(i / BATCH_SIZE) + 1}`);

        // Delay between batches
        if (i + BATCH_SIZE < needsFreshRates.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
        }
    }

    process.stdout.write('\n\n');
    console.log('='.repeat(60));
    console.log('📊 RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Successfully cached: ${successCount}`);
    console.log(`⚠️  No rate available:  ${noRateCount}`);
    console.log(`❌ Errors:             ${errorCount}`);
    console.log(`📝 Total processed:    ${processed}`);
    console.log(`💾 Previously cached:  ${cachedOrders.length}`);
    console.log('='.repeat(60));
    console.log('\n✨ Done! Rates are now cached for 7 days.');
}

main().catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
