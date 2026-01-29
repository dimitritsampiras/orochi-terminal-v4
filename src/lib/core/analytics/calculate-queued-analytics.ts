
import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import {
    orders,
    lineItems,
    productVariants,
    blankVariants,
    blanks,
    shippingRateCache,
    globalSettings,
    warehouseExpenses,
    batches,
    ordersBatches,
} from "@drizzle/schema";
import { eq, and, inArray, sql, gte, lte, or, sum } from "drizzle-orm";
import { fetchShopifyOrder } from "@/lib/core/shipping/fetch-shopify-order";
import { getRateForOrder } from "@/lib/core/shipping/get-rate-for-order";
import { startOfDay, subDays, endOfDay } from "date-fns";

export type QueuedAnalyticsSummary = {
    counts: {
        critical: { orders: number; items: number };
        urgent: { orders: number; items: number };
        normal: { orders: number; items: number };
        low: { orders: number; items: number };
        priority: { orders: number; items: number };
    };
    costs: {
        // Material costs
        blanks: number;
        ink: number;
        supplementary: number;

        // Per-item production costs
        printerRepairs: number;
        pretreat: number;
        electricity: number;
        neckLabels: number;
        parchmentPaper: number;

        // Per-order fulfillment costs
        thankYouCards: number;
        polymailers: number;
        cleaningSolution: number;
        integratedPaper: number;
        blankPaper: number;

        // Totals with buffer
        itemCostsSubtotal: number;
        itemCostsWithBuffer: number;
        orderCostsSubtotal: number;
        orderCostsWithBuffer: number;
        grandTotal: number;
    };
    labor: {
        totalCost: number;
        costPerItem: number;
        workDaysNeeded: number;
        itemsPerDay: number;
    };
};

export type ShippingProgressUpdate = {
    processed: number;
    total: number;
    currentCost: number;
    breakdown: {
        aggregate: { avg: number; count: number; total: number };
        domestic: { avg: number; count: number; total: number };
        ca: { avg: number; count: number; total: number };
        uk: { avg: number; count: number; total: number };
        de: { avg: number; count: number; total: number };
        au: { avg: number; count: number; total: number };
        row: { avg: number; count: number; total: number };
    };
};

export async function getQueuedAnalyticsSummary(cutoffDate?: Date): Promise<QueuedAnalyticsSummary> {
    // 1. Get Queued Orders & Items Counts
    // Build where conditions
    const whereConditions = [eq(orders.queued, true), eq(orders.displayIsCancelled, false)];
    if (cutoffDate) {
        whereConditions.push(gte(orders.createdAt, cutoffDate));
    }

    const allQueuedOrders = await db
        .select({
            id: orders.id,
            priority: orders.fulfillmentPriority,
        })
        .from(orders)
        .where(and(...whereConditions));

    const orderIds = allQueuedOrders.map((o) => o.id);

    let validLineItems: { orderId: string; quantity: number }[] = [];
    if (orderIds.length > 0) {
        validLineItems = await db
            .select({
                orderId: lineItems.orderId,
                quantity: lineItems.quantity,
            })
            .from(lineItems)
            .where(
                and(
                    inArray(lineItems.orderId, orderIds),
                    eq(lineItems.requiresShipping, true)
                )
            ); // Filtering tips/giftcards
    }

    // Aggregate counts
    const counts = {
        critical: { orders: 0, items: 0 },
        urgent: { orders: 0, items: 0 },
        normal: { orders: 0, items: 0 },
        low: { orders: 0, items: 0 },
        priority: { orders: 0, items: 0 },
    };

    const orderItemCounts = new Map<string, number>();
    for (const item of validLineItems) {
        // Assuming quantity might be > 1, assume "number of lineitems" means individual units or SKU lines?
        // "Number of lineitems: look at the number of fulfillable lineitems" usually implies units if calculating workload.
        // But text says "lineitems". Let's assume quantity sum.
        const current = orderItemCounts.get(item.orderId!) || 0;
        orderItemCounts.set(item.orderId!, current + item.quantity);
    }

    for (const order of allQueuedOrders) {
        const qty = orderItemCounts.get(order.id) || 0;
        const p = order.priority || "normal";
        if (counts[p]) {
            counts[p].orders++;
            counts[p].items += qty;
        }
    }

    const totalFulfillableItems = Object.values(counts).reduce(
        (acc, c) => acc + c.items,
        0
    );

    // 2. Costs: Blanks, Ink, Supplementary
    // Blanks: Join to get costs
    let totalBlankCost = 0;
    if (orderIds.length > 0) {
        const blanksData = await db
            .select({
                qty: lineItems.quantity,
                cost: blanks.customsPrice,
            })
            .from(lineItems)
            .innerJoin(productVariants, eq(lineItems.variantId, productVariants.id))
            .innerJoin(
                blankVariants,
                eq(productVariants.blankVariantId, blankVariants.id)
            )
            .innerJoin(blanks, eq(blankVariants.blankId, blanks.id))
            .where(
                and(
                    inArray(lineItems.orderId, orderIds),
                    eq(lineItems.requiresShipping, true)
                )
            );

        totalBlankCost = blanksData.reduce(
            (acc, item) => acc + item.qty * (item.cost || 0),
            0
        );
    }

    // Settings
    const settings = await db.query.globalSettings.findFirst();

    // Per-item production costs
    const inkCostPerItem = settings?.inkCostPerItem ?? 1.20;
    const printerRepairCostPerItem = settings?.printerRepairCostPerItem ?? 0.45;
    const pretreatCostPerItem = settings?.pretreatCostPerItem ?? 0.27;
    const electricityCostPerItem = settings?.electricityCostPerItem ?? 0.24;
    const neckLabelCostPerItem = settings?.neckLabelCostPerItem ?? 0.08;
    const parchmentPaperCostPerItem = settings?.parchmentPaperCostPerItem ?? 0.06;

    // Per-order fulfillment costs
    const thankYouCardCostPerOrder = settings?.thankYouCardCostPerOrder ?? 0.14;
    const polymailerCostPerOrder = settings?.polymailerCostPerOrder ?? 0.09;
    const cleaningSolutionCostPerOrder = settings?.cleaningSolutionCostPerOrder ?? 0.08;
    const integratedPaperCostPerOrder = settings?.integratedPaperCostPerOrder ?? 0.06;
    const blankPaperCostPerOrder = settings?.blankPaperCostPerOrder ?? 0.02;

    // Other settings
    const supplementaryCostPerItem = settings?.supplementaryItemCost ?? 0;
    const costBufferPercentage = settings?.costBufferPercentage ?? 10.0;

    // Calculate costs
    const totalInkCost = totalFulfillableItems * inkCostPerItem;
    const totalSupplementaryCost = totalFulfillableItems * supplementaryCostPerItem;

    // Calculate new detailed per-item costs
    const totalPrinterRepairs = totalFulfillableItems * printerRepairCostPerItem;
    const totalPretreat = totalFulfillableItems * pretreatCostPerItem;
    const totalElectricity = totalFulfillableItems * electricityCostPerItem;
    const totalNeckLabels = totalFulfillableItems * neckLabelCostPerItem;
    const totalParchmentPaper = totalFulfillableItems * parchmentPaperCostPerItem;

    // Calculate per-order costs (total orders, not items)
    const totalOrders = allQueuedOrders.length;
    const totalThankYouCards = totalOrders * thankYouCardCostPerOrder;
    const totalPolymailers = totalOrders * polymailerCostPerOrder;
    const totalCleaningSolution = totalOrders * cleaningSolutionCostPerOrder;
    const totalIntegratedPaper = totalOrders * integratedPaperCostPerOrder;
    const totalBlankPaper = totalOrders * blankPaperCostPerOrder;

    // Calculate subtotals
    const itemCostsSubtotal = totalBlankCost + totalInkCost + totalSupplementaryCost +
        totalPrinterRepairs + totalPretreat + totalElectricity +
        totalNeckLabels + totalParchmentPaper;

    const orderCostsSubtotal = totalThankYouCards + totalPolymailers +
        totalCleaningSolution + totalIntegratedPaper + totalBlankPaper;

    // Apply buffer
    const bufferMultiplier = 1 + (costBufferPercentage / 100);
    const itemCostsWithBuffer = itemCostsSubtotal * bufferMultiplier;
    const orderCostsWithBuffer = orderCostsSubtotal * bufferMultiplier;
    const grandTotal = itemCostsWithBuffer + orderCostsWithBuffer;

    // 3. Labor Costs
    // fetch payroll expenses in last 30 days
    const thirtyDaysAgo = subDays(new Date(), 30);
    const payrollExpenses = await db
        .select()
        .from(warehouseExpenses)
        .where(
            and(
                eq(warehouseExpenses.category, "salary"),
                gte(warehouseExpenses.date, thirtyDaysAgo)
            )
        );

    let totalPayrollInPeriod = 0;
    let totalItemsInPeriod = 0; // Items processed in those sessions
    let totalDaysInPeriod = 0;

    for (const expense of payrollExpenses) {
        if (!expense.periodStart || !expense.periodEnd) continue;

        totalPayrollInPeriod += expense.amount;

        // Roughly calculate working days in this period (assuming 5.5 days/week)
        const days =
            (expense.periodEnd.getTime() - expense.periodStart.getTime()) /
            (1000 * 3600 * 24);
        // Adjust for work weeks: days * (5.5 / 7) ?? Or just take raw days if it's "sessions created in those time ranges"
        // The user says: "fetch all the sessions that were created in those time ranges"
        // So we find batches in that range.

        const batchesInPeriod = await db
            .select({ id: batches.id })
            .from(batches)
            .where(
                and(
                    gte(batches.createdAt, expense.periodStart),
                    lte(batches.createdAt, expense.periodEnd)
                )
            );

        const batchIds = batchesInPeriod.map((b) => b.id);
        if (batchIds.length > 0) {
            const batchItems = await db
                .select({ qty: lineItems.quantity })
                .from(ordersBatches)
                .innerJoin(lineItems, eq(ordersBatches.orderId, lineItems.orderId))
                .where(inArray(ordersBatches.batchId, batchIds));

            const count = batchItems.reduce((acc, i) => acc + i.qty, 0);
            totalItemsInPeriod += count;
        }

        // Accumulate time for "Work days needed" calc fallback? 
        // Actually user says: "from the previous calculation see how many lineitems they do per work day"
        // So we need distinct days count or just utilize the period length?
        // Let's assume the expenses cover contiguous periods or we just sum the duration.
        totalDaysInPeriod += days;
    }

    let laborCostPerItem = 0;
    if (totalItemsInPeriod > 0) {
        laborCostPerItem = totalPayrollInPeriod / totalItemsInPeriod;
    }

    const totalLaborCost = totalFulfillableItems * laborCostPerItem;

    // Work Days Needed
    // "assume that the warehouse is open 5.5 days per week"
    // We need throughput: Items Per Work Day.
    // totalItemsInPeriod / (Total Days in Period * 5.5/7)? 
    // User says "fetch all sessions created in those time ranges... calculate total payroll... divide by total number of lineitems". This gave cost per item.
    // Then "Total work days needed... from the previous calculation see how many lineitems they do per work day"
    // Use totalItemsInPeriod and totalDaysInPeriod.

    // Calculate effective work days in the historical period
    // If totalDaysInPeriod is raw calendar days (e.g. 30), then work days ~ 30 * (5.5/7)
    const effectiveWorkDaysHistory = totalDaysInPeriod * (5.5 / 7);

    let itemsPerWorkDay = 0;
    if (effectiveWorkDaysHistory > 0) {
        itemsPerWorkDay = totalItemsInPeriod / effectiveWorkDaysHistory;
    }

    let workDaysNeeded = 0;
    if (itemsPerWorkDay > 0) {
        workDaysNeeded = totalFulfillableItems / itemsPerWorkDay;
    }

    return {
        counts,
        costs: {
            // Material costs
            blanks: totalBlankCost,
            ink: totalInkCost,
            supplementary: totalSupplementaryCost,

            // Per-item production costs
            printerRepairs: totalPrinterRepairs,
            pretreat: totalPretreat,
            electricity: totalElectricity,
            neckLabels: totalNeckLabels,
            parchmentPaper: totalParchmentPaper,

            // Per-order fulfillment costs
            thankYouCards: totalThankYouCards,
            polymailers: totalPolymailers,
            cleaningSolution: totalCleaningSolution,
            integratedPaper: totalIntegratedPaper,
            blankPaper: totalBlankPaper,

            // Totals with buffer
            itemCostsSubtotal,
            itemCostsWithBuffer,
            orderCostsSubtotal,
            orderCostsWithBuffer,
            grandTotal,
        },
        labor: {
            totalCost: totalLaborCost,
            costPerItem: laborCostPerItem,
            workDaysNeeded,
            itemsPerDay: itemsPerWorkDay,
        },
    };
}

export async function* calculateShippingCostsGenerator(cutoffDate?: Date): AsyncGenerator<ShippingProgressUpdate> {
    // Build where conditions
    const whereConditions = [eq(orders.queued, true), eq(orders.displayIsCancelled, false)];
    if (cutoffDate) {
        whereConditions.push(gte(orders.createdAt, cutoffDate));
    }

    // 1. Query all queued orders
    const queuedOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(...whereConditions));

    const total = queuedOrders.length;
    const orderIds = queuedOrders.map(o => o.id);

    if (orderIds.length === 0) {
        return; // No orders to process
    }

    // 2. Bulk fetch ALL cache entries upfront (single query)
    console.log(`[Financials] Fetching cache for ${total} orders...`);
    const allCachedEntries = await db
        .select()
        .from(shippingRateCache)
        .where(inArray(shippingRateCache.orderId, orderIds));

    const cacheMap = new Map();
    for (const entry of allCachedEntries) {
        cacheMap.set(entry.orderId, entry);
    }

    // 3. Bulk fetch country codes for all orders
    const orderInfos = await db
        .select({
            id: orders.id,
            code: orders.displayDestinationCountryCode
        })
        .from(orders)
        .where(inArray(orders.id, orderIds));

    const countryMap = new Map();
    for (const info of orderInfos) {
        countryMap.set(info.id, info.code || "UNKNOWN");
    }

    // 4. Separate orders into cached (fresh) vs. needs fresh rates
    const now = new Date();
    const cachedOrders: Array<{ id: string; cached: any }> = [];
    const needsFreshRates: Array<{ id: string }> = [];

    for (const order of queuedOrders) {
        const cached = cacheMap.get(order.id);
        if (cached && new Date(cached.expiresAt) > now) {
            // Fresh cache available
            cachedOrders.push({ id: order.id, cached });
        } else {
            // No cache or expired
            needsFreshRates.push(order);
        }
    }

    console.log(`[Financials] Cache: ${cachedOrders.length} fresh, ${needsFreshRates.length} need fetching`);

    let processed = 0;
    let totalShippingCost = 0;

    const breakdown = {
        aggregate: { avg: 0, count: 0, total: 0 },
        domestic: { avg: 0, count: 0, total: 0 },
        ca: { avg: 0, count: 0, total: 0 },
        uk: { avg: 0, count: 0, total: 0 },
        de: { avg: 0, count: 0, total: 0 },
        au: { avg: 0, count: 0, total: 0 },
        row: { avg: 0, count: 0, total: 0 },
    };

    // Helper: Update breakdown with cost
    const updateBreakdown = (cost: number, countryCode: string) => {
        if (cost > 0) {
            breakdown.aggregate.total += cost;
            breakdown.aggregate.count++;

            const c = countryCode.toUpperCase();
            if (c === 'US') { breakdown.domestic.total += cost; breakdown.domestic.count++; }
            else if (c === 'CA') { breakdown.ca.total += cost; breakdown.ca.count++; }
            else if (c === 'GB' || c === 'UK') { breakdown.uk.total += cost; breakdown.uk.count++; }
            else if (c === 'DE') { breakdown.de.total += cost; breakdown.de.count++; }
            else if (c === 'AU') { breakdown.au.total += cost; breakdown.au.count++; }
            else { breakdown.row.total += cost; breakdown.row.count++; }
        }
    };

    // Helper: Recalculate averages
    const recalcAvg = () => {
        const calcAvg = (b: any) => b.count > 0 ? b.total / b.count : 0;
        breakdown.aggregate.avg = calcAvg(breakdown.aggregate);
        breakdown.domestic.avg = calcAvg(breakdown.domestic);
        breakdown.ca.avg = calcAvg(breakdown.ca);
        breakdown.uk.avg = calcAvg(breakdown.uk);
        breakdown.de.avg = calcAvg(breakdown.de);
        breakdown.au.avg = calcAvg(breakdown.au);
        breakdown.row.avg = calcAvg(breakdown.row);
    };

    // 5. Process cached orders instantly (no API calls)
    if (cachedOrders.length > 0) {
        console.log(`[Financials] Processing ${cachedOrders.length} cached orders instantly...`);
        for (const order of cachedOrders) {
            try {
                const rateData = order.cached.rate as any;
                const r = rateData as { rate: any; otherRates: any[] };
                const rates = [r.rate, ...(r.otherRates || [])];
                const cheapest = rates.sort((a: any, b: any) => Number(a.cost) - Number(b.cost))[0];
                const cost = cheapest ? Number(cheapest.cost) : 0;

                totalShippingCost += cost;
                const countryCode = countryMap.get(order.id) || "UNKNOWN";
                updateBreakdown(cost, countryCode);
            } catch (e) {
                console.error(`Error processing cached order ${order.id}`, e);
            }
        }

        processed += cachedOrders.length;
        recalcAvg();

        // Yield progress after processing cached orders
        yield {
            processed,
            total,
            currentCost: totalShippingCost,
            breakdown
        };
    }

    // 6. Process orders needing fresh rates in batches with API calls
    if (needsFreshRates.length > 0) {
        console.log(`[Financials] Fetching live rates for ${needsFreshRates.length} orders...`);

        const BATCH_SIZE = 45;
        const CONCURRENT_API_CALLS = 5;
        const ORDER_TIMEOUT_MS = 15000;

        // Helper: Timeout wrapper for async operations
        const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
            return Promise.race([
                promise,
                new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
            ]);
        };

        for (let i = 0; i < needsFreshRates.length; i += BATCH_SIZE) {
            const batch = needsFreshRates.slice(i, i + BATCH_SIZE);
            console.log(`[Financials] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)...`);

            const ratesToInsert: any[] = [];
            const batchCosts: number[] = [];

            // Process in smaller sub-batches to avoid API throttling
            for (let j = 0; j < batch.length; j += CONCURRENT_API_CALLS) {
                const subBatch = batch.slice(j, j + CONCURRENT_API_CALLS);

                const subCosts = await Promise.all(subBatch.map(async (order) => {
                    return withTimeout(
                        (async () => {
                            try {
                                let cost = 0;
                                let countryCode = countryMap.get(order.id) || "UNKNOWN";

                                // Fetch live rate
                                const shopifyOrder = await fetchShopifyOrder(order.id);
                                if (shopifyOrder) {
                                    countryCode = shopifyOrder.shippingAddress?.countryCodeV2 || countryCode;

                                    const rateResult = await getRateForOrder(shopifyOrder as any);

                                    if (rateResult.data) {
                                        // Collect for bulk insert
                                        ratesToInsert.push({
                                            orderId: order.id,
                                            rate: rateResult.data,
                                            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                        });

                                        const r = rateResult.data;
                                        const rates = [r.rate, ...(r.otherRates || [])];
                                        const cheapest = rates.sort((a: any, b: any) => Number(a.cost) - Number(b.cost))[0];
                                        cost = cheapest ? Number(cheapest.cost) : 0;
                                    }
                                }

                                // Update breakdown
                                updateBreakdown(cost, countryCode);
                                return cost;
                            } catch (e) {
                                console.error(`Error processing shipping for order ${order.id}`, e);
                                return 0;
                            }
                        })(),
                        ORDER_TIMEOUT_MS,
                        0 // Return 0 on timeout
                    );
                }));

                batchCosts.push(...subCosts);
            }

            // Bulk insert new rates
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
                    console.error("Bulk cache insert failed", err);
                }
            }

            const batchTotal = batchCosts.reduce((a, b) => a + b, 0);
            totalShippingCost += batchTotal;
            processed += batch.length;
            recalcAvg();

            yield {
                processed: Math.min(processed, total),
                total,
                currentCost: totalShippingCost,
                breakdown
            };
        }
    }
}
