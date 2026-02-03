/**
 * Weekly Profitability Calculator
 *
 * Calculates comprehensive weekly profitability metrics including:
 * - Shopify revenue (net of fees, refunds, returns)
 * - Fulfillment costs for items from orders CREATED during the week (matches revenue timing)
 * - Prorated recurring expenses
 * - Payroll calculated as: (last 21 days payroll / line items from sessions in that period) × current week line items
 * - Marketing costs
 * - Optional CSV expense uploads
 */

import { db } from "@/lib/clients/db";
import {
    orders,
    lineItems,
    productVariants,
    blankVariants,
    blanks,
    recurringExpenses,
    warehouseExpenses,
    shipments,
    globalSettings,
    batches,
    ordersBatches,
    shippingRateCache,
} from "@drizzle/schema";
import { and, between, eq, gte, lte, sql, inArray, desc } from "drizzle-orm";
import shopify from "@/lib/clients/shopify";
import { batchOrdersForShippingQuery } from "@/lib/graphql/analytics.graphql";
import { getRateForOrder } from "@/lib/core/shipping/get-rate-for-order";
import { logger } from "@/lib/core/logger";
import { startOfDayEastern, endOfDayEastern } from "@/lib/utils";

// Shopify fee constants
const SHOPIFY_FEE_PERCENTAGE = 0.029; // 2.9%
const SHOPIFY_FEE_FIXED = 0.30; // $0.30 per transaction

export interface WeeklyProfitabilityReport {
    week: {
        start: Date;
        end: Date;
        weekNumber: number;
        year: number;
    };
    revenue: {
        grossSales: number;
        discounts: number;
        returns: number;
        netSales: number;
        shippingCharges: number;
        returnFees: number;
        taxes: number;
        totalSales: number;
        shopifyFees: number;
        refunds: number;
        netRevenue: number;
        orderCount: number;
    };
    fulfillment: {
        blanksCost: number;
        inkCost: number;
        shippingCost: number;
        perItemCosts: number;
        perOrderCosts: number;
        total: number;
        itemCount: number;
        orderCount: number;
        breakdown: {
            // Per-item costs
            printerRepairs: number;
            pretreat: number;
            electricity: number;
            neckLabels: number;
            parchmentPaper: number;
            // Per-order costs
            thankYouCards: number;
            polymailers: number;
            cleaningSolution: number;
            integratedPaper: number;
            blankPaper: number;
        };
        shippingMetadata: {
            ordersWithPurchasedShipping: number;
            ordersWithEstimatedShipping: number;
            ordersFailedToFetchRates: number;
            ordersWithoutShipping: number;
            actualShippingCost: number;
            estimatedShippingCost: number;
            failedOrders?: Array<{
                orderId: string;
                error: string;
            }>;
        };
    };
    operating: {
        payrollCost: number | null;
        payrollSource: "manual" | "historical_average" | null;
        historicalAveragePayroll: number;
        historicalLaborCostPerItem: number;
        historicalLaborData: {
            costPerItem: number;
            totalPayroll: number;
            totalLineItems: number;
        };
        marketingCostMeta: number;
        marketingCostGoogle: number;
        marketingCostOther: number;
        totalMarketing: number;
        // Marketing expense metadata - shows coverage info when expenses don't perfectly align with week
        marketingMetadata?: {
            meta?: {
                periodStart: Date;
                periodEnd: Date;
                isPartialCoverage: boolean;
                originalAmount: number;
                proratedAmount: number;
            };
            google?: {
                periodStart: Date;
                periodEnd: Date;
                isPartialCoverage: boolean;
                originalAmount: number;
                proratedAmount: number;
            };
            other?: {
                periodStart: Date;
                periodEnd: Date;
                isPartialCoverage: boolean;
                originalAmount: number;
                proratedAmount: number;
            };
        };
        recurringExpenses: number;
        rentCost: number;
        csvExpenses: number;
        total: number;
    };
    profitability: {
        totalRevenue: number;
        totalCosts: number;
        grossProfit: number;
        profitMargin: number; // percentage
        costPerItem: number;
        costPerOrder: number;
        averageOrderValue: number; // AOV
        breakevenROAS: number; // Revenue needed per $ of marketing spend to break even
        breakevenCPA: number; // Maximum cost per acquisition to break even
    };
}

interface CalculateWeeklyProfitabilityOptions {
    payrollCost?: number; // Manual input
    useHistoricalPayroll?: boolean; // Use average if manual not provided
    marketingCostMeta?: number;
    marketingCostGoogle?: number;
    marketingCostOther?: number;
    includeCsvExpenses?: boolean; // Whether to include CSV transaction expenses
    fetchUnpurchasedShippingRates?: boolean; // Whether to fetch rates for unpurchased orders (slow!)
}

/**
 * Calculate weekly profitability report
 */
export async function calculateWeeklyProfitability(
    weekStart: Date,
    weekEnd: Date,
    options: CalculateWeeklyProfitabilityOptions = {}
): Promise<WeeklyProfitabilityReport> {
    // Get ISO week number
    const weekNumber = getWeekNumber(weekStart);
    const year = weekStart.getFullYear();

    // Parallel data fetching for performance
    const [revenueData, fulfillmentData, operatingData] = await Promise.all([
        calculateRevenueMetrics(weekStart, weekEnd),
        calculateFulfillmentCosts(weekStart, weekEnd, {
            fetchUnpurchasedShippingRates: options.fetchUnpurchasedShippingRates,
        }),
        calculateOperatingExpenses(weekStart, weekEnd, options),
    ]);

    // Calculate profitability
    const totalCosts =
        fulfillmentData.total + operatingData.total;
    const grossProfit = revenueData.netRevenue - totalCosts;
    const profitMargin =
        revenueData.netRevenue > 0
            ? (grossProfit / revenueData.netRevenue) * 100
            : 0;

    const costPerItem =
        fulfillmentData.itemCount > 0
            ? totalCosts / fulfillmentData.itemCount
            : 0;
    const costPerOrder =
        fulfillmentData.orderCount > 0
            ? totalCosts / fulfillmentData.orderCount
            : 0;

    // Calculate Average Order Value (AOV) using pre-fees revenue
    // AOV represents what customers pay, not what we receive after fees
    const averageOrderValue =
        revenueData.orderCount > 0
            ? revenueData.totalSales / revenueData.orderCount
            : 0;

    // Calculate Breakeven ROAS (Return on Ad Spend)
    // Breakeven ROAS = 1 / Contribution Margin Ratio
    // Contribution Margin = (Pre-fees Revenue - Non-Marketing Costs) / Pre-fees Revenue
    // Uses totalSales (pre-fees) as revenue, with Shopify fees included in costs
    // Non-marketing costs = ALL costs except marketing (fulfillment + payroll + rent + recurring + fees)
    //
    // Example: If your profit margin before marketing is 50%, breakeven ROAS = 1/0.5 = 2.0x
    // Meaning you need $2.00 in revenue for every $1 spent on ads to break even
    const preFeeRevenue = revenueData.totalSales;
    const nonMarketingCosts = totalCosts - operatingData.totalMarketing + revenueData.shopifyFees;
    const contributionMargin = preFeeRevenue > 0
        ? (preFeeRevenue - nonMarketingCosts) / preFeeRevenue
        : 0;
    const breakevenROAS = contributionMargin > 0
        ? 1 / contributionMargin
        : 0;

    // Calculate Breakeven CPA (Cost Per Acquisition)
    // Breakeven CPA = (Pre-fees Revenue - Non-Marketing Costs) / Order Count
    // Uses totalSales (pre-fees) as revenue, with Shopify fees included in costs
    // This tells you the maximum you can spend per order to break even
    const breakevenCPA =
        revenueData.orderCount > 0
            ? (preFeeRevenue - nonMarketingCosts) / revenueData.orderCount
            : 0;

    return {
        week: {
            start: weekStart,
            end: weekEnd,
            weekNumber,
            year,
        },
        revenue: revenueData,
        fulfillment: fulfillmentData,
        operating: operatingData,
        profitability: {
            totalRevenue: revenueData.netRevenue,
            totalCosts,
            grossProfit,
            profitMargin,
            costPerItem,
            costPerOrder,
            averageOrderValue,
            breakevenROAS,
            breakevenCPA,
        },
    };
}

// Shopify nodes() query has a hard limit of 100 IDs per request
const SHOPIFY_BATCH_SIZE = 100;

/**
 * Calculate revenue metrics from Shopify orders for the week
 * Queries Shopify API directly for actual financial data
 *
 * IMPORTANT: Shopify's nodes() query has a 100 ID limit, so we batch requests
 */
async function calculateRevenueMetrics(
    weekStart: Date,
    weekEnd: Date
): Promise<WeeklyProfitabilityReport["revenue"]> {
    // Query orders directly from Shopify to ensure we get ALL orders in the date range
    // Format dates for Shopify's filters
    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    console.log(`[weekly profitability] Querying Shopify for orders created OR updated between ${startISO} and ${endISO}`);

    // We need two lists:
    // 1. Orders CREATED this week -> for Gross Sales, Discounts, Original Shipping, Original Taxes
    // 2. Orders UPDATED this week -> to check for Refunds processed this week (Returns)

    const ordersQuery = `#graphql
        query GetOrdersByDateRange($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
    `;

    // Helper to fetch order IDs
    const fetchOrderIds = async (query: string, label: string): Promise<Set<string>> => {
        const ids = new Set<string>();
        let hasNextPage = true;
        let cursor: string | null = null;
        let pageCount = 0;

        while (hasNextPage) {
            pageCount++;
            try {
                const after: string = cursor ? `, after: "${cursor}"` : "";
                const paginatedQuery: string = ordersQuery.replace('orders(first: 250, query: $query)', `orders(first: 250, query: $query${after})`);

                const { data, errors } = await shopify.request(paginatedQuery, {
                    variables: { query },
                });

                if (errors) {
                    console.error(`[weekly profitability] Shopify GraphQL errors (${label}) page ${pageCount}:`, errors);
                    break;
                }

                const edges = data?.orders?.edges || [];
                edges.forEach((edge: any) => ids.add(edge.node.id));

                hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;
                cursor = data?.orders?.pageInfo?.endCursor || null;

                if (pageCount > 20) {
                    console.warn(`[weekly profitability] Stopping (${label}) after ${pageCount} pages`);
                    break;
                }
            } catch (error) {
                console.error(`[weekly profitability] Error fetching (${label}) page ${pageCount}:`, error);
                break;
            }
        }
        console.log(`[weekly profitability] Fetched ${ids.size} orders (${label})`);
        return ids;
    };

    // Parallel fetch
    const [createdOrderIds, updatedOrderIds] = await Promise.all([
        fetchOrderIds(`created_at:>='${startISO}' created_at:<='${endISO}'`, "CREATED"),
        fetchOrderIds(`updated_at:>='${startISO}' updated_at:<='${endISO}'`, "UPDATED")
    ]);

    // Merge for fetching full details (updated usually includes created, but we need unique set)
    const allOrderIdsToFetch = new Set([...createdOrderIds, ...updatedOrderIds]);
    const orderIds = Array.from(allOrderIdsToFetch);

    if (orderIds.length === 0) {
        return {
            grossSales: 0,
            discounts: 0,
            returns: 0,
            netSales: 0,
            shippingCharges: 0,
            returnFees: 0,
            taxes: 0,
            totalSales: 0,
            shopifyFees: 0,
            refunds: 0,
            netRevenue: 0,
            orderCount: 0,
        };
    }

    // Import the query
    const { weeklyFinancialsQuery } = await import("@/lib/graphql/analytics.graphql");

    // Reduce batch size effectively to avoid timeouts with the heavier query (refund details)
    const BATCH_SIZE = 50;
    const allNodes: any[] = [];
    const totalBatches = Math.ceil(orderIds.length / BATCH_SIZE);

    console.log(`[weekly profitability] Fetching details for ${orderIds.length} orders in ${totalBatches} batches`);

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batch = orderIds.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        try {
            const { data, errors } = await shopify.request(weeklyFinancialsQuery, {
                variables: { ids: batch },
            });

            if (errors) {
                console.error(`[weekly profitability] Shopify GraphQL errors in batch ${batchNum}:`, JSON.stringify(errors, null, 2));
                continue;
            }

            if (data?.nodes) {
                allNodes.push(...data.nodes);
            }
        } catch (error: any) {
            console.error(`[weekly profitability] Shopify API error in batch ${batchNum}:`, error.message || error);
            if (error.response) {
                // console.error("Response:", await error.response.text());
            }
        }
    }

    let grossSales = 0;
    let totalDiscounts = 0;

    // Initial Taxes/Shipping from orders CREATED this week
    let totalShipping = 0;
    let totalTaxes = 0;

    let totalReturns = 0; // Value of items returned this week
    let returnFees = 0;

    let orderCount = 0; // Only count orders CREATED this week

    for (const node of allNodes) {
        if (!node) continue;
        if (node.__typename !== "Order") continue;

        // Is this order NEW this week?
        const isNewOrder = createdOrderIds.has(node.id);

        if (isNewOrder) {
            orderCount++;

            // Calculate Gross Sales from line items' originalUnitPriceSet × quantity
            // This gives us the true undiscounted price, matching Shopify Analytics
            if (node.lineItems?.nodes) {
                for (const lineItem of node.lineItems.nodes) {
                    const originalUnitPrice = parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || "0");
                    const quantity = lineItem.quantity || 0;
                    grossSales += originalUnitPrice * quantity;
                }
            }

            const discounts = parseFloat(node.totalDiscountsSet?.shopMoney?.amount || "0");
            const shipping = parseFloat(node.totalShippingPriceSet?.shopMoney?.amount || "0");
            const taxes = parseFloat(node.totalTaxSet?.shopMoney?.amount || "0");

            // Accounting View: Discounts, Shipping, and Taxes are recorded when order is created
            totalDiscounts += discounts;
            totalShipping += shipping;
            totalTaxes += taxes;
        }

        // Process Refunds (Returns) that happened THIS WEEK
        // Shopify counts refunds processed during the week, regardless of when the order was created
        if (node.refunds && Array.isArray(node.refunds)) {
            for (const refund of node.refunds) {
                const refundDate = new Date(refund.createdAt);

                // Check if refund happened in the requested week
                if (refundDate >= weekStart && refundDate <= weekEnd) {
                    // Check if refund has any PENDING transactions - exclude those as they haven't been processed yet
                    const hasPendingTransaction = refund.transactions?.nodes?.some((txn: any) => txn.status === "PENDING");

                    if (hasPendingTransaction) {
                        // Skip PENDING refunds as they haven't been processed and won't appear in Shopify Analytics yet
                        continue;
                    }

                    // "Returns" = Sum of Refund Line Items Subtotal
                    // This correctly handles restocking fees or discrepancies
                    if (refund.refundLineItems?.nodes) {
                        const itemsReturnVal = refund.refundLineItems.nodes.reduce((sum: number, item: any) => {
                            return sum + parseFloat(item.subtotalSet?.shopMoney?.amount || "0");
                        }, 0);
                        totalReturns += itemsReturnVal;
                    }

                    // Adjust Net Totals (Accounting View subtracts refunded tax/shipping from the period totals)
                    let refundedTax = 0;
                    if (refund.refundLineItems?.nodes) {
                        refundedTax += refund.refundLineItems.nodes.reduce((sum: number, item: any) => {
                            return sum + parseFloat(item.totalTaxSet?.shopMoney?.amount || "0");
                        }, 0);
                    }
                    if (refund.refundShippingLines?.nodes) {
                        refundedTax += refund.refundShippingLines.nodes.reduce((sum: number, line: any) => {
                            return sum + parseFloat(line.taxAmountSet?.shopMoney?.amount || "0");
                        }, 0);
                    }

                    totalTaxes -= refundedTax;

                    let refundedShipping = 0;
                    if (refund.refundShippingLines?.nodes) {
                        refundedShipping += refund.refundShippingLines.nodes.reduce((sum: number, line: any) => {
                            return sum + parseFloat(line.subtotalAmountSet?.shopMoney?.amount || "0");
                        }, 0);
                    }
                    totalShipping -= refundedShipping;
                }
            }
        }
    }

    // Shopify Formula:
    // Total Sales = Net Sales + Shipping + Taxes
    // Net Sales = Gross Sales - Discounts - Returns
    const netSales = grossSales - totalDiscounts - totalReturns;
    const totalSales = netSales + totalShipping + returnFees + totalTaxes;

    // Calculate Shopify fees (2.9% + $0.30 per order) based on total sales
    const shopifyFees = totalSales * SHOPIFY_FEE_PERCENTAGE + orderCount * SHOPIFY_FEE_FIXED;

    // Net revenue = total sales - Shopify fees
    const netRevenue = totalSales - shopifyFees;

    console.log("[Revenue Summary]:", {
        orderCount,
        grossSales,
        discounts: totalDiscounts,
        returns: totalReturns,
        netSales,
        shippingCharges: totalShipping,
        returnFees,
        taxes: totalTaxes,
        totalSales,
        shopifyFees,
        netRevenue,
    });

    return {
        grossSales,
        discounts: totalDiscounts,
        returns: totalReturns,
        netSales,
        shippingCharges: totalShipping,
        returnFees,
        taxes: totalTaxes,
        totalSales,
        shopifyFees,
        refunds: totalReturns,
        netRevenue,
        orderCount,
    };
}

// Rate fetching batch configuration (matching orochi-portal's proven values)
const RATE_BATCH_SIZE = 12;
const DELAY_BETWEEN_RATE_BATCHES_MS = 150;

/**
 * Calculate shipping costs for orders, using actual costs for shipped orders
 * Optionally fetches rates for unshipped orders using parallel batching for efficiency
 */
async function calculateShippingCostsForOrders(
    orderIds: string[],
    options: { fetchUnpurchasedRates?: boolean } = {}
): Promise<{
    totalShippingCost: number;
    metadata: {
        ordersWithPurchasedShipping: number;
        ordersWithEstimatedShipping: number;
        ordersFailedToFetchRates: number;
        ordersWithoutShipping: number;
        actualShippingCost: number;
        estimatedShippingCost: number;
        failedOrders?: Array<{
            orderId: string;
            error: string;
        }>;
    };
}> {
    if (orderIds.length === 0) {
        return {
            totalShippingCost: 0,
            metadata: {
                ordersWithPurchasedShipping: 0,
                ordersWithEstimatedShipping: 0,
                ordersFailedToFetchRates: 0,
                ordersWithoutShipping: 0,
                actualShippingCost: 0,
                estimatedShippingCost: 0,
                failedOrders: undefined,
            },
        };
    }

    // Get all shipments for these orders
    const orderShipments = await db
        .select({
            orderId: shipments.orderId,
            cost: shipments.cost,
            isPurchased: shipments.isPurchased,
            isRefunded: shipments.isRefunded,
        })
        .from(shipments)
        .where(inArray(shipments.orderId, orderIds));

    // Separate orders into those with/without purchased shipments
    const ordersWithShipments = new Map<string, number>();

    for (const shipment of orderShipments) {
        if (shipment.isPurchased && !shipment.isRefunded && shipment.cost) {
            const existingCost = ordersWithShipments.get(shipment.orderId) || 0;
            ordersWithShipments.set(
                shipment.orderId,
                existingCost + Number(shipment.cost)
            );
        }
    }

    const ordersWithoutShipments = orderIds.filter(
        (id) => !ordersWithShipments.has(id)
    );

    let actualShippingCost = 0;
    for (const cost of ordersWithShipments.values()) {
        actualShippingCost += cost;
    }

    let estimatedShippingCost = 0;
    let successCount = 0;
    const failedOrders: Array<{ orderId: string; error: string }> = [];

    // Always check cache for orders without shipments
    let uncachedOrders = ordersWithoutShipments;
    if (ordersWithoutShipments.length > 0) {
        const now = new Date();
        const cachedRates = await db
            .select()
            .from(shippingRateCache)
            .where(inArray(shippingRateCache.orderId, ordersWithoutShipments));

        for (const cached of cachedRates) {
            const isValid = new Date(cached.expiresAt) > now;
            if (isValid && cached.rate && typeof cached.rate === 'object') {
                const rate = cached.rate as { rate?: { cost?: number } };
                const cost = rate.rate?.cost;
                if (cost !== undefined) {
                    estimatedShippingCost += cost;
                    successCount++;
                }
            }
        }

        // Filter out orders that have valid cached rates
        const cachedOrderIds = new Set(
            cachedRates
                .filter(c => new Date(c.expiresAt) > now)
                .map(c => c.orderId)
        );
        uncachedOrders = ordersWithoutShipments.filter(id => !cachedOrderIds.has(id));

        if (cachedRates.length > 0) {
            console.log(`[shipping costs] Cache hit: ${successCount} orders ($${estimatedShippingCost.toFixed(2)}), ${uncachedOrders.length} uncached`);
        }
    }

    // Fetch rates for uncached orders using optimized two-phase approach (like orochi-portal)
    if (options.fetchUnpurchasedRates && uncachedOrders.length > 0) {
        const totalOrders = uncachedOrders.length;

        // Phase 1: Pre-fetch ALL Shopify order data in batches of 100
        console.log(`[shipping costs] Phase 1: Pre-fetching ${totalOrders} orders from Shopify in batches of ${SHOPIFY_BATCH_SIZE}`);

        const orderMap = new Map<string, any>();
        const totalShopifyBatches = Math.ceil(totalOrders / SHOPIFY_BATCH_SIZE);

        for (let i = 0; i < uncachedOrders.length; i += SHOPIFY_BATCH_SIZE) {
            const batch = uncachedOrders.slice(i, i + SHOPIFY_BATCH_SIZE);
            const batchNum = Math.floor(i / SHOPIFY_BATCH_SIZE) + 1;

            try {
                const { data, errors } = await shopify.request(batchOrdersForShippingQuery, {
                    variables: { ids: batch },
                });

                if (errors) {
                    console.error(`[shipping costs] Shopify GraphQL errors in batch ${batchNum}:`, errors);
                    batch.forEach(id => failedOrders.push({ orderId: id, error: "GraphQL error" }));
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
                    console.log(`[shipping costs] Shopify batch ${batchNum}/${totalShopifyBatches}: fetched ${validCount}/${batch.length} orders`);
                }
            } catch (error) {
                console.error(`[shipping costs] Shopify API error in batch ${batchNum}:`, error);
                batch.forEach(id => failedOrders.push({
                    orderId: id,
                    error: error instanceof Error ? error.message : "Unknown error"
                }));
            }
        }

        console.log(`[shipping costs] Shopify pre-fetch complete: ${orderMap.size} orders loaded`);

        // Phase 2: Process rate fetching in parallel batches of 12
        const ordersToProcess = uncachedOrders.filter(id => orderMap.has(id));
        const totalRateBatches = Math.ceil(ordersToProcess.length / RATE_BATCH_SIZE);

        console.log(`[shipping costs] Phase 2: Fetching rates for ${ordersToProcess.length} orders in batches of ${RATE_BATCH_SIZE}`);

        for (let i = 0; i < ordersToProcess.length; i += RATE_BATCH_SIZE) {
            const batch = ordersToProcess.slice(i, i + RATE_BATCH_SIZE);
            const batchNum = Math.floor(i / RATE_BATCH_SIZE) + 1;

            // Process batch in parallel using Promise.allSettled
            const results = await Promise.allSettled(
                batch.map(async (orderId) => {
                    try {
                        const order = orderMap.get(orderId);
                        if (!order) {
                            return { orderId, error: "Order not in cache" };
                        }

                        const { data, error } = await getRateForOrder(order);

                        if (!data || error) {
                            return { orderId, error: error || "Unknown error" };
                        }

                        return { orderId, cost: data.rate.cost };
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : "Unknown error";
                        return { orderId, error: errorMsg };
                    }
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
                        estimatedShippingCost += value.cost;
                        successCount++;
                        batchSuccess++;
                    } else if (value.error) {
                        failedOrders.push({ orderId: value.orderId, error: value.error });
                        batchFailed++;
                    }
                } else {
                    const orderId = batch[j] || "unknown";
                    failedOrders.push({ orderId, error: "Promise rejected" });
                    batchFailed++;
                }
            }

            console.log(
                `[shipping costs] Batch ${batchNum}/${totalRateBatches}: ` +
                `✓ ${batchSuccess} success, ✗ ${batchFailed} failed | ` +
                `Progress: ${i + batch.length}/${ordersToProcess.length}`
            );

            // Delay between batches (except for last batch)
            if (i + RATE_BATCH_SIZE < ordersToProcess.length) {
                await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_RATE_BATCHES_MS));
            }
        }

        console.log(
            `[shipping costs] Complete! ` +
            `✓ ${successCount} success, ✗ ${failedOrders.length} failed | ` +
            `Estimated cost: $${estimatedShippingCost.toFixed(2)}`
        );
    }

    // Orders without shipping = orders without purchased AND without estimates
    // After cache check: uncachedOrders.length
    // After fresh fetch: 0 (all uncached were attempted, results are in success or failed)
    const ordersWithoutShippingCount = options.fetchUnpurchasedRates
        ? 0  // All uncached orders were attempted
        : uncachedOrders.length;  // Uncached orders haven't been attempted yet

    return {
        totalShippingCost: actualShippingCost + estimatedShippingCost,
        metadata: {
            ordersWithPurchasedShipping: ordersWithShipments.size,
            ordersWithEstimatedShipping: successCount,
            ordersFailedToFetchRates: failedOrders.length,
            ordersWithoutShipping: ordersWithoutShippingCount,
            actualShippingCost,
            estimatedShippingCost,
            failedOrders: failedOrders.length > 0 ? failedOrders : undefined,
        },
    };
}

/**
 * Calculate fulfillment costs for items from orders CREATED during the week
 * This matches revenue recognition timing (when items were bought, not when fulfilled)
 */
async function calculateFulfillmentCosts(
    weekStart: Date,
    weekEnd: Date,
    options: { fetchUnpurchasedShippingRates?: boolean } = {}
): Promise<WeeklyProfitabilityReport["fulfillment"]> {
    // Get global settings for cost values
    const [settings] = await db.select().from(globalSettings).limit(1);

    if (!settings) {
        throw new Error("Global settings not found");
    }

    // Query Shopify directly for orders in date range (same as revenue calculation)
    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    console.log(`[fulfillment costs] Querying Shopify for orders created between ${startISO} and ${endISO}`);

    const ordersQuery = `#graphql
        query GetOrdersByDateRange($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                        name
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
    `;

    const weekOrderIds: string[] = [];
    let hasNextPage = true;
    let pageCount = 0;

    // Fetch all order IDs from Shopify using pagination
    while (hasNextPage) {
        pageCount++;
        const query = `created_at:>='${startISO}' created_at:<='${endISO}'`;

        try {
            const { data, errors } = await shopify.request(ordersQuery, {
                variables: { query },
            });

            if (errors) {
                console.error(`[fulfillment costs] Shopify GraphQL errors on page ${pageCount}:`, errors);
                break;
            }

            const edges = data?.orders?.edges || [];
            const newOrderIds = edges.map((edge: any) => edge.node.id);
            weekOrderIds.push(...newOrderIds);

            hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;

            console.log(`[fulfillment costs] Page ${pageCount}: fetched ${newOrderIds.length} orders (total: ${weekOrderIds.length})`);

            if (pageCount > 10) {
                console.warn(`[fulfillment costs] Stopping after ${pageCount} pages`);
                break;
            }
        } catch (error) {
            console.error(`[fulfillment costs] Error fetching orders page ${pageCount}:`, error);
            break;
        }
    }

    console.log(`[fulfillment costs] Found ${weekOrderIds.length} total orders from Shopify`);

    // If no orders, return zero costs
    if (weekOrderIds.length === 0) {
        return {
            blanksCost: 0,
            inkCost: 0,
            shippingCost: 0,
            perItemCosts: 0,
            perOrderCosts: 0,
            total: 0,
            itemCount: 0,
            orderCount: 0,
            breakdown: {
                printerRepairs: 0,
                pretreat: 0,
                electricity: 0,
                neckLabels: 0,
                parchmentPaper: 0,
                thankYouCards: 0,
                polymailers: 0,
                cleaningSolution: 0,
                integratedPaper: 0,
                blankPaper: 0,
            },
            shippingMetadata: {
                ordersWithPurchasedShipping: 0,
                ordersWithEstimatedShipping: 0,
                ordersFailedToFetchRates: 0,
                ordersWithoutShipping: 0,
                actualShippingCost: 0,
                estimatedShippingCost: 0,
            },
        };
    }

    // Fetch order details with line items from Shopify
    console.log(`[fulfillment costs] Fetching line items for ${weekOrderIds.length} orders from Shopify`);

    const allOrders: any[] = [];
    const BATCH_SIZE = 100; // Shopify's limit for nodes() query

    for (let i = 0; i < weekOrderIds.length; i += BATCH_SIZE) {
        const batch = weekOrderIds.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        try {
            const { data, errors } = await shopify.request(batchOrdersForShippingQuery, {
                variables: { ids: batch },
            });

            if (errors) {
                console.error(`[fulfillment costs] Shopify GraphQL errors in batch ${batchNum}:`, errors);
                continue;
            }

            if (data?.nodes) {
                const orders = data.nodes.filter((node: any) => node.__typename === "Order");
                allOrders.push(...orders);
            }

            console.log(`[fulfillment costs] Batch ${batchNum}: fetched ${data?.nodes?.length || 0} orders with line items`);
        } catch (error) {
            console.error(`[fulfillment costs] Error fetching batch ${batchNum}:`, error);
        }
    }

    // Extract line items from Shopify orders
    const fulfilledLineItems: Array<{
        id: string;
        quantity: number;
        variantId: string | null;
        orderId: string;
        requiresShipping: boolean;
    }> = [];

    for (const order of allOrders) {
        const orderLineItems = order.lineItems?.nodes || [];
        for (const lineItem of orderLineItems) {
            fulfilledLineItems.push({
                id: lineItem.id,
                quantity: lineItem.quantity || 0,
                variantId: lineItem.variant?.id || null,
                orderId: order.id,
                requiresShipping: lineItem.requiresShipping || false,
            });
        }
    }

    console.log(`[fulfillment costs] Extracted ${fulfilledLineItems.length} line items from Shopify orders`);

    // Calculate total items
    const totalItems = fulfilledLineItems.reduce(
        (sum, li) => sum + Number(li.quantity),
        0
    );

    // Get unique orders
    const uniqueOrders = new Set(fulfilledLineItems.map((li) => li.orderId));
    const totalOrders = uniqueOrders.size;

    // Calculate blanks cost
    const variantIds = [
        ...new Set(fulfilledLineItems.map((li) => li.variantId).filter(Boolean)),
    ];

    let blanksCost = 0;

    if (variantIds.length > 0) {
        const variants = await db
            .select({
                id: productVariants.id,
                blankVariantId: productVariants.blankVariantId,
            })
            .from(productVariants)
            .where(inArray(productVariants.id, variantIds as string[]));

        const blankVariantIds = [
            ...new Set(variants.map((v) => v.blankVariantId).filter(Boolean)),
        ];

        if (blankVariantIds.length > 0) {
            const blankVars = await db
                .select({
                    id: blankVariants.id,
                    blankId: blankVariants.blankId,
                })
                .from(blankVariants)
                .where(inArray(blankVariants.id, blankVariantIds as string[]));

            const blankIds = [...new Set(blankVars.map((bv) => bv.blankId))];

            const blanksData = await db
                .select({
                    id: blanks.id,
                    customsPrice: blanks.customsPrice,
                })
                .from(blanks)
                .where(inArray(blanks.id, blankIds));

            // Create lookup maps
            const blankPriceMap = new Map(
                blanksData.map((b) => [b.id, b.customsPrice])
            );
            const blankVariantMap = new Map(
                blankVars.map((bv) => [bv.id, bv.blankId])
            );
            const productVariantMap = new Map(
                variants.map((v) => [v.id, v.blankVariantId])
            );

            // Calculate total blanks cost
            blanksCost = fulfilledLineItems.reduce((sum, li) => {
                if (!li.variantId || !li.requiresShipping) return sum;

                const blankVariantId = productVariantMap.get(li.variantId);
                if (!blankVariantId) return sum;

                const blankId = blankVariantMap.get(blankVariantId);
                if (!blankId) return sum;

                const blankPrice = blankPriceMap.get(blankId) || 0;
                return sum + blankPrice * Number(li.quantity);
            }, 0);
        }
    }

    // Calculate ink cost
    const inkCost = totalItems * Number(settings.inkCostPerItem);

    // Calculate per-item costs
    const printerRepairs = totalItems * Number(settings.printerRepairCostPerItem);
    const pretreat = totalItems * Number(settings.pretreatCostPerItem);
    const electricity = totalItems * Number(settings.electricityCostPerItem);
    const neckLabels = totalItems * Number(settings.neckLabelCostPerItem);
    const parchmentPaper = totalItems * Number(settings.parchmentPaperCostPerItem);

    const perItemCosts =
        printerRepairs + pretreat + electricity + neckLabels + parchmentPaper;

    // Calculate per-order costs
    const thankYouCards = totalOrders * Number(settings.thankYouCardCostPerOrder);
    const polymailers = totalOrders * Number(settings.polymailerCostPerOrder);
    const cleaningSolution = totalOrders * Number(settings.cleaningSolutionCostPerOrder);
    const integratedPaper = totalOrders * Number(settings.integratedPaperCostPerOrder);
    const blankPaper = totalOrders * Number(settings.blankPaperCostPerOrder);

    const perOrderCosts =
        thankYouCards + polymailers + cleaningSolution + integratedPaper + blankPaper;

    // Calculate shipping costs for orders created this week
    // Use actual costs for shipped orders, optionally fetch rates for unshipped orders
    const {
        totalShippingCost: shippingCost,
        metadata: shippingMetadata
    } = await calculateShippingCostsForOrders(weekOrderIds, {
        fetchUnpurchasedRates: options.fetchUnpurchasedShippingRates,
    });

    // Apply cost buffer to individual components (not shipping - that's actual cost)
    const bufferMultiplier = 1 + Number(settings.costBufferPercentage) / 100;
    const blanksCostWithBuffer = blanksCost * bufferMultiplier;
    const inkCostWithBuffer = inkCost * bufferMultiplier;
    const perItemCostsWithBuffer = perItemCosts * bufferMultiplier;
    const perOrderCostsWithBuffer = perOrderCosts * bufferMultiplier;

    const totalFulfillmentCost =
        blanksCostWithBuffer + inkCostWithBuffer + perItemCostsWithBuffer + perOrderCostsWithBuffer + shippingCost;

    return {
        blanksCost: blanksCostWithBuffer,
        inkCost: inkCostWithBuffer,
        shippingCost,
        perItemCosts: perItemCostsWithBuffer,
        perOrderCosts: perOrderCostsWithBuffer,
        total: totalFulfillmentCost,
        itemCount: totalItems,
        orderCount: totalOrders,
        breakdown: {
            // Per-item costs (with buffer)
            printerRepairs: printerRepairs * bufferMultiplier,
            pretreat: pretreat * bufferMultiplier,
            electricity: electricity * bufferMultiplier,
            neckLabels: neckLabels * bufferMultiplier,
            parchmentPaper: parchmentPaper * bufferMultiplier,
            // Per-order costs (with buffer)
            thankYouCards: thankYouCards * bufferMultiplier,
            polymailers: polymailers * bufferMultiplier,
            cleaningSolution: cleaningSolution * bufferMultiplier,
            integratedPaper: integratedPaper * bufferMultiplier,
            blankPaper: blankPaper * bufferMultiplier,
        },
        shippingMetadata,
    };
}

/**
 * Calculate historical labor cost per line item from sessions in the last 21 days
 */
async function calculateHistoricalLaborCostPerItem(
    referenceDate: Date
): Promise<{ costPerItem: number; totalPayroll: number; totalLineItems: number }> {
    // 1. Get payroll from last 21 days
    const lookbackDate = new Date(referenceDate.getTime() - 21 * 24 * 60 * 60 * 1000);

    const payrollExpenses = await db
        .select({
            amount: warehouseExpenses.amount,
        })
        .from(warehouseExpenses)
        .where(
            and(
                eq(warehouseExpenses.category, "salary"),
                gte(warehouseExpenses.date, lookbackDate),
                lte(warehouseExpenses.date, referenceDate)
            )
        );

    const totalPayroll = payrollExpenses.reduce(
        (sum, exp) => sum + Number(exp.amount),
        0
    );

    // If no payroll data, return zeros
    if (totalPayroll === 0) {
        return { costPerItem: 0, totalPayroll: 0, totalLineItems: 0 };
    }

    // 2. Find batches (sessions) created during the payroll period
    const sessionsInPeriod = await db
        .select({
            id: batches.id,
        })
        .from(batches)
        .where(
            and(
                gte(batches.createdAt, lookbackDate),
                lte(batches.createdAt, referenceDate)
            )
        );

    const sessionIds = sessionsInPeriod.map((s) => s.id);

    // If no sessions found, return zero cost per item
    if (sessionIds.length === 0) {
        return { costPerItem: 0, totalPayroll, totalLineItems: 0 };
    }

    // 3. Get all orders from those batches
    const ordersInSessions = await db
        .select({
            orderId: ordersBatches.orderId,
        })
        .from(ordersBatches)
        .where(inArray(ordersBatches.batchId, sessionIds));

    const orderIds = [...new Set(ordersInSessions.map((o) => o.orderId))];

    if (orderIds.length === 0) {
        return { costPerItem: 0, totalPayroll, totalLineItems: 0 };
    }

    // 4. Get all line items from those orders
    const lineItemsInSessions = await db
        .select({
            id: lineItems.id,
            quantity: lineItems.quantity,
        })
        .from(lineItems)
        .where(inArray(lineItems.orderId, orderIds));

    // 5. Calculate total line items (sum of quantities)
    const totalLineItems = lineItemsInSessions.reduce(
        (sum, li) => sum + Number(li.quantity),
        0
    );

    // 6. Calculate cost per line item
    const costPerItem = totalLineItems > 0 ? totalPayroll / totalLineItems : 0;

    return { costPerItem, totalPayroll, totalLineItems };
}

/**
 * Calculate operating expenses for the week
 */
async function calculateOperatingExpenses(
    weekStart: Date,
    weekEnd: Date,
    options: CalculateWeeklyProfitabilityOptions
): Promise<WeeklyProfitabilityReport["operating"]> {
    // 1. Calculate prorated recurring expenses
    const activeRecurring = await db
        .select()
        .from(recurringExpenses)
        .where(
            and(
                eq(recurringExpenses.active, true),
                lte(recurringExpenses.startDate, weekEnd)
                // endDate is optional, so we handle it in post-processing
            )
        );

    const recurringTotal = activeRecurring.reduce((sum, exp) => {
        // Check if expense is active during this week
        if (exp.endDate && exp.endDate < weekStart) {
            return sum; // Expired before week started
        }

        // Prorate based on frequency
        let weeklyAmount = 0;
        const amount = Number(exp.amount);

        switch (exp.frequency) {
            case "weekly":
                weeklyAmount = amount;
                break;
            case "monthly":
                weeklyAmount = amount / 4.33; // Average weeks per month
                break;
            case "yearly":
                weeklyAmount = amount / 52;
                break;
        }

        return sum + weeklyAmount;
    }, 0);

    // 2. Calculate historical labor cost per line item from sessions (last 21 days)
    const historicalLaborData = await calculateHistoricalLaborCostPerItem(weekStart);

    // Get line items for the current week to apply the cost per item
    // Query Shopify directly for orders and line items (same approach as fulfillment)
    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    console.log(`[operating expenses] Querying Shopify for orders created between ${startISO} and ${endISO}`);

    const ordersQuery = `#graphql
        query GetOrdersByDateRange($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                        name
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
    `;

    const weekOrderIds: string[] = [];
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage) {
        pageCount++;
        const query = `created_at:>='${startISO}' created_at:<='${endISO}'`;

        try {
            const { data, errors } = await shopify.request(ordersQuery, {
                variables: { query },
            });

            if (errors) {
                console.error(`[operating expenses] Shopify GraphQL errors on page ${pageCount}:`, errors);
                break;
            }

            const edges = data?.orders?.edges || [];
            const newOrderIds = edges.map((edge: any) => edge.node.id);
            weekOrderIds.push(...newOrderIds);

            hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;

            if (pageCount > 10) {
                break;
            }
        } catch (error) {
            console.error(`[operating expenses] Error fetching orders page ${pageCount}:`, error);
            break;
        }
    }

    console.log(`[operating expenses] Found ${weekOrderIds.length} orders from Shopify`);

    // Fetch line items from Shopify
    let weekLineItemCount = 0;
    if (weekOrderIds.length > 0) {
        console.log(`[operating expenses] Fetching line items for ${weekOrderIds.length} orders`);

        for (let i = 0; i < weekOrderIds.length; i += SHOPIFY_BATCH_SIZE) {
            const batch = weekOrderIds.slice(i, i + SHOPIFY_BATCH_SIZE);

            try {
                const { data } = await shopify.request(batchOrdersForShippingQuery, {
                    variables: { ids: batch },
                });

                if (data?.nodes) {
                    const orders = data.nodes.filter((node: any) => node.__typename === "Order");
                    for (const order of orders) {
                        const lineItems = order.lineItems?.nodes || [];
                        for (const lineItem of lineItems) {
                            weekLineItemCount += lineItem.quantity || 0;
                        }
                    }
                }
            } catch (error) {
                console.error(`[operating expenses] Error fetching line items:`, error);
            }
        }

        console.log(`[operating expenses] Total line items: ${weekLineItemCount}`);
    }

    // Calculate payroll based on cost per item
    const historicalAveragePayroll =
        historicalLaborData.costPerItem > 0 && weekLineItemCount > 0
            ? historicalLaborData.costPerItem * weekLineItemCount
            : 0;

    // 3. Determine payroll cost
    // Check for both undefined and null to properly handle historical average
    let payrollCost: number | null = null;
    let payrollSource: "manual" | "historical_average" | null = null;

    if (options.payrollCost !== undefined && options.payrollCost !== null) {
        payrollCost = options.payrollCost;
        payrollSource = "manual";
    } else if (options.useHistoricalPayroll) {
        payrollCost = historicalAveragePayroll;
        payrollSource = "historical_average";
    }

    // 4. Marketing costs - query from warehouseExpenses if not manually provided
    // Query for marketing expenses that fall within or overlap the week
    const marketingExpenses = await db
        .select({
            category: warehouseExpenses.category,
            amount: warehouseExpenses.amount,
            date: warehouseExpenses.date,
            periodStart: warehouseExpenses.periodStart,
            periodEnd: warehouseExpenses.periodEnd,
        })
        .from(warehouseExpenses)
        .where(
            and(
                inArray(warehouseExpenses.category, ["marketing_meta", "marketing_google", "marketing", "advertising"]),
                // Expense date/period overlaps with the week
                sql`(
                    (${warehouseExpenses.periodStart} IS NOT NULL AND ${warehouseExpenses.periodEnd} IS NOT NULL
                        AND ${warehouseExpenses.periodStart} <= ${weekEnd.toISOString()}
                        AND ${warehouseExpenses.periodEnd} >= ${weekStart.toISOString()})
                    OR
                    (${warehouseExpenses.periodStart} IS NULL
                        AND ${warehouseExpenses.date} >= ${weekStart.toISOString()}
                        AND ${warehouseExpenses.date} <= ${weekEnd.toISOString()})
                )`
            )
        );

    // Aggregate marketing expenses by category with metadata tracking
    let dbMarketingMeta = 0;
    let dbMarketingGoogle = 0;
    let dbMarketingOther = 0;

    // Track metadata for each category (use the most recent expense's period info)
    type MarketingMetadataEntry = {
        periodStart: Date;
        periodEnd: Date;
        isPartialCoverage: boolean;
        originalAmount: number;
        proratedAmount: number;
    };
    let metaMetadata: MarketingMetadataEntry | undefined;
    let googleMetadata: MarketingMetadataEntry | undefined;
    let otherMetadata: MarketingMetadataEntry | undefined;

    for (const expense of marketingExpenses) {
        const amount = Number(expense.amount);

        // If expense has a period, prorate it for the week
        let weekAmount = amount;
        let periodStart: Date;
        let periodEnd: Date;
        let isPartialCoverage = false;

        if (expense.periodStart && expense.periodEnd) {
            periodStart = new Date(expense.periodStart);
            periodEnd = new Date(expense.periodEnd);

            // Extract date-only strings in Eastern timezone for accurate comparison
            // This handles the case where weekEnd is "end of day" (23:59:59 EST) but we want to compare the calendar date
            const getEasternDateString = (d: Date): string => {
                return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD format
            };

            const periodStartStr = getEasternDateString(periodStart);
            const periodEndStr = getEasternDateString(periodEnd);
            const weekStartStr = getEasternDateString(weekStart);
            const weekEndStr = getEasternDateString(weekEnd);

            // Convert back to comparable dates (midnight UTC for each date string)
            const toDateFromStr = (str: string) => new Date(str + 'T00:00:00Z');
            const normPeriodStart = toDateFromStr(periodStartStr);
            const normPeriodEnd = toDateFromStr(periodEndStr);
            const normWeekStart = toDateFromStr(weekStartStr);
            const normWeekEnd = toDateFromStr(weekEndStr);

            // Calculate days (inclusive counting: Jan 26 - Feb 1 = 7 days)
            const DAY_MS = 1000 * 60 * 60 * 24;
            const periodDays = Math.max(1, Math.round((normPeriodEnd.getTime() - normPeriodStart.getTime()) / DAY_MS) + 1);

            // Calculate overlap with the week
            const overlapStart = new Date(Math.max(normWeekStart.getTime(), normPeriodStart.getTime()));
            const overlapEnd = new Date(Math.min(normWeekEnd.getTime(), normPeriodEnd.getTime()));
            const overlapDays = Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / DAY_MS) + 1);

            weekAmount = (amount / periodDays) * overlapDays;

            // Check if this is partial coverage (expense period doesn't fully contain the week)
            isPartialCoverage = periodStartStr > weekStartStr || periodEndStr < weekEndStr;
        } else {
            // Single date expense - use the expense date as both start and end
            periodStart = new Date(expense.date);
            periodEnd = new Date(expense.date);
        }

        const metadata: MarketingMetadataEntry = {
            periodStart,
            periodEnd,
            isPartialCoverage,
            originalAmount: amount,
            proratedAmount: weekAmount,
        };

        switch (expense.category) {
            case "marketing_meta":
                dbMarketingMeta += weekAmount;
                // Keep the most recent/largest expense's metadata
                if (!metaMetadata || amount > metaMetadata.originalAmount) {
                    metaMetadata = metadata;
                }
                break;
            case "marketing_google":
                dbMarketingGoogle += weekAmount;
                if (!googleMetadata || amount > googleMetadata.originalAmount) {
                    googleMetadata = metadata;
                }
                break;
            case "marketing":
            case "advertising":
                dbMarketingOther += weekAmount;
                if (!otherMetadata || amount > otherMetadata.originalAmount) {
                    otherMetadata = metadata;
                }
                break;
        }
    }

    // Build marketing metadata object (only include if there are DB-sourced values)
    const marketingMetadata = (metaMetadata || googleMetadata || otherMetadata) ? {
        ...(metaMetadata && { meta: metaMetadata }),
        ...(googleMetadata && { google: googleMetadata }),
        ...(otherMetadata && { other: otherMetadata }),
    } : undefined;

    // Use manual input if provided, otherwise use database values
    const marketingCostMeta = options.marketingCostMeta !== undefined ? options.marketingCostMeta : dbMarketingMeta;
    const marketingCostGoogle = options.marketingCostGoogle !== undefined ? options.marketingCostGoogle : dbMarketingGoogle;
    const marketingCostOther = options.marketingCostOther !== undefined ? options.marketingCostOther : dbMarketingOther;
    const totalMarketing =
        marketingCostMeta + marketingCostGoogle + marketingCostOther;

    // 5. Rent Calculation
    // Query for the most recent rent payment
    const rentExpenses = await db
        .select({
            amount: warehouseExpenses.amount,
        })
        .from(warehouseExpenses)
        .where(eq(warehouseExpenses.category, "rent"))
        .orderBy(desc(warehouseExpenses.date))
        .limit(1);

    // Default fallback to $2215 if no rent found
    const monthlyRent = rentExpenses.length > 0 ? Number(rentExpenses[0].amount) : 2215;

    // Calculate proportional weekly rent: (Monthly * 12) / 52
    const weeklyRent = (monthlyRent * 12) / 52;

    // 6. CSV expenses (optional - would need to be implemented)
    const csvExpenses = 0; // Placeholder

    const totalOperating =
        (payrollCost || 0) + totalMarketing + recurringTotal + weeklyRent + csvExpenses;

    return {
        payrollCost,
        payrollSource,
        historicalAveragePayroll,
        historicalLaborCostPerItem: historicalLaborData.costPerItem,
        historicalLaborData: {
            costPerItem: historicalLaborData.costPerItem,
            totalPayroll: historicalLaborData.totalPayroll,
            totalLineItems: historicalLaborData.totalLineItems,
        },
        marketingCostMeta,
        marketingCostGoogle,
        marketingCostOther,
        totalMarketing,
        marketingMetadata,
        recurringExpenses: recurringTotal,
        rentCost: weeklyRent,
        csvExpenses,
        total: totalOperating,
    };
}

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get start and end dates for a week number
 */
export function getWeekDates(weekNumber: number, year: number): { start: Date; end: Date } {
    const january4th = new Date(year, 0, 4);
    const dayOfWeek = january4th.getDay() || 7;
    const weekStart = new Date(january4th);
    weekStart.setDate(january4th.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return { start: weekStart, end: weekEnd };
}

/**
 * Get current week dates in Eastern Time (EST/EDT)
 * This ensures all weekly profitability calculations use consistent Eastern Time boundaries
 */
export function getCurrentWeek(): { start: Date; end: Date } {
    // Import here to avoid circular dependencies
    const { getCurrentWeekEastern } = require("@/lib/utils");
    return getCurrentWeekEastern();
}
