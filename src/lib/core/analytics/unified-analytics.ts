import { db } from "@/lib/clients/db";
import {
    orders,
    lineItems,
    productVariants,
    warehouseExpenses,
    shipments,
    blanks,
    blankVariants
} from "@drizzle/schema";
import { eq, and, inArray, desc, gte } from "drizzle-orm";
import { addDays } from "date-fns";
import { getQueuedAnalyticsSummary } from "./calculate-queued-analytics";
import { getFinancialMetrics } from "./financial-metrics";

// --- Types ---

export type AnalyticsMode = "outstanding" | "time-based";

export type GarmentBreakdown = {
    garmentType: string;
    count: number;
    totalCost: number;
    avgCost: number;
};

// Per-Order Cost Breakdown (costs that apply once per order)
export type PerOrderCostBreakdown = {
    thankYouCards: number;
    polymailer: number;
    integratedPaper: number;
    blankPaper: number;
    cleaningSolution: number;
    subtotal: number;
    buffer: number;
    total: number;  // With 10% buffer
};

// Per-Item Cost Breakdown (costs that apply per line item)
export type PerItemCostBreakdown = {
    neckLabel: number;
    parchmentPaper: number;
    pretreat: number;
    ink: number;
    printerRepairs: number;
    electricity: number;
    subtotal: number;
    buffer: number;
    total: number;  // With 10% buffer
};

export type UnifiedAnalyticsSummary = {
    mode: AnalyticsMode;
    dateRange?: { from: Date; to: Date }; // For time-based
    metrics: {
        revenue: number;
        netProfit: number;
        profitMargin: number;
        totalExpenses: number;
        orderCount: number;
        itemCount: number;
    };
    expenses: {
        cogs: {
            total: number;
            blanks: number;
            ink: number; // Per-item ink cost
            supplies: number; // Per-order supplies + labels
        };
        operational: {
            total: number;
            shipping: number;
            transactionFees: number; // Shopify 2.9% + 0.30
            labor: number;
            laborCostPerItem: number; // Average labor cost per fulfilled item
        };
        fixed: {
            total: number;
            rent: number;
            utilities: number;
            subscriptions: number;
            other: number;
        };
    };
    // Detailed cost breakdowns
    perOrderCosts?: PerOrderCostBreakdown;
    perItemCosts?: PerItemCostBreakdown;
    projections?: {
        expectedCompletionDate: Date;
        workDaysRemaining: number;
        dailyThroughput: number;
    };
    garmentBreakdown?: GarmentBreakdown[]; // Only for outstanding mode
};

// --- Constants ---

const SHOPIFY_FEE_PERCENTAGE = 0.029;
const SHOPIFY_FEE_FIXED = 0.30;

// Per-Order Costs (apply once per order)
const PER_ORDER_COSTS = {
    thankYouCards: 0.14,
    polymailer: 0.09,
    integratedPaper: 0.06,
    blankPaper: 0.02,
    cleaningSolution: 0.08,
} as const;
const PER_ORDER_SUBTOTAL = Object.values(PER_ORDER_COSTS).reduce((a, b) => a + b, 0); // $0.39
const PER_ORDER_BUFFER = 0.10; // 10% buffer
const PER_ORDER_TOTAL = PER_ORDER_SUBTOTAL * (1 + PER_ORDER_BUFFER); // $0.43

// Per-Item Costs (apply once per line item)
const PER_ITEM_COSTS = {
    neckLabel: 0.08,
    parchmentPaper: 0.06,
    pretreat: 0.27,
    ink: 1.20,
    printerRepairs: 0.45,
    electricity: 0.24,
} as const;
const PER_ITEM_SUBTOTAL = Object.values(PER_ITEM_COSTS).reduce((a, b) => a + b, 0); // $2.30
const PER_ITEM_BUFFER = 0.10; // 10% buffer
const PER_ITEM_TOTAL = PER_ITEM_SUBTOTAL * (1 + PER_ITEM_BUFFER); // $2.53

// --- Main Function ---

export async function getUnifiedAnalytics(
    mode: AnalyticsMode,
    dateRange?: { from: Date; to: Date }
): Promise<UnifiedAnalyticsSummary> {
    if (mode === "outstanding") {
        return getOutstandingAnalytics();
    } else {
        if (!dateRange) throw new Error("Date range required for time-based analytics");
        return getTimeBasedAnalytics(dateRange.from, dateRange.to);
    }
}

// --- Outstanding Mode Implementation ---

async function getOutstandingAnalytics(): Promise<UnifiedAnalyticsSummary> {
    // 1. Reuse existing heavy-lifting from calculate-queued-analytics
    const baseAnalytics = await getQueuedAnalyticsSummary();

    // 2. Fetch Queued Revenue (Not in base analytics)
    // We need to sum the price of all queued orders
    const queuedOrders = await db
        .select({
            id: orders.id,
            displayFinancialStatus: orders.displayFulfillmentStatus // strictly we want unfulfilled, which baseAnalytics handles via 'queued' flag
        })
        .from(orders)
        .where(and(eq(orders.queued, true), eq(orders.displayIsCancelled, false)));

    const orderIds = queuedOrders.map(o => o.id);

    let revenue = 0;
    if (orderIds.length > 0) {
        // Chunk the query if needed, but for now assuming it fits
        const items = await db
            .select({
                qty: lineItems.quantity,
                price: productVariants.price
            })
            .from(lineItems)
            .innerJoin(productVariants, eq(lineItems.variantId, productVariants.id))
            .where(inArray(lineItems.orderId, orderIds));

        revenue = items.reduce((acc, item) => acc + (item.qty * (Number(item.price) || 0)), 0);
    }

    const orderCount = baseAnalytics.counts.critical.orders + baseAnalytics.counts.urgent.orders + baseAnalytics.counts.normal.orders + baseAnalytics.counts.low.orders + baseAnalytics.counts.priority.orders;

    // Note: baseAnalytics.counts item counts are aggregated differently. 
    // Let's rely on the labor-metrics item count if available, or sum the breakdown.
    const itemCount = baseAnalytics.counts.critical.items + baseAnalytics.counts.urgent.items + baseAnalytics.counts.normal.items + baseAnalytics.counts.low.items + baseAnalytics.counts.priority.items;

    // 3. Calculate Expenses

    // Build detailed per-order cost breakdown
    const perOrderCostsBreakdown: PerOrderCostBreakdown = {
        thankYouCards: PER_ORDER_COSTS.thankYouCards * orderCount,
        polymailer: PER_ORDER_COSTS.polymailer * orderCount,
        integratedPaper: PER_ORDER_COSTS.integratedPaper * orderCount,
        blankPaper: PER_ORDER_COSTS.blankPaper * orderCount,
        cleaningSolution: PER_ORDER_COSTS.cleaningSolution * orderCount,
        subtotal: PER_ORDER_SUBTOTAL * orderCount,
        buffer: (PER_ORDER_SUBTOTAL * orderCount) * PER_ORDER_BUFFER,
        total: PER_ORDER_TOTAL * orderCount,
    };

    // Build detailed per-item cost breakdown
    const perItemCostsBreakdown: PerItemCostBreakdown = {
        neckLabel: PER_ITEM_COSTS.neckLabel * itemCount,
        parchmentPaper: PER_ITEM_COSTS.parchmentPaper * itemCount,
        pretreat: PER_ITEM_COSTS.pretreat * itemCount,
        ink: PER_ITEM_COSTS.ink * itemCount,
        printerRepairs: PER_ITEM_COSTS.printerRepairs * itemCount,
        electricity: PER_ITEM_COSTS.electricity * itemCount,
        subtotal: PER_ITEM_SUBTOTAL * itemCount,
        buffer: (PER_ITEM_SUBTOTAL * itemCount) * PER_ITEM_BUFFER,
        total: PER_ITEM_TOTAL * itemCount,
    };

    // A. COGS
    const blanksCost = baseAnalytics.costs.blanks;
    // Ink cost now from per-item breakdown (includes ink + pretreat + electricity + printer repairs)
    const inkCost = perItemCostsBreakdown.total;
    // Supplies cost = per-order materials (polymailer, papers, thank you cards, cleaning)
    const suppliesCost = perOrderCostsBreakdown.total;
    const cogsTotal = blanksCost + inkCost + suppliesCost;

    // B. Operational
    // Note: baseAnalytics does NOT return shipping cost directly (it's in the generator).
    // WE NEED TO ESTIMATE SHIPPING for "Outstanding".
    // Strategy: Use average shipping cost from last 30 days * queued orders.
    const avgShippingCost = await getAverageShippingCost();
    const estimatedShipping = orderCount * avgShippingCost;

    const transactionFees = (revenue * SHOPIFY_FEE_PERCENTAGE) + (orderCount * SHOPIFY_FEE_FIXED);

    // Labor cost - use calculated value from payroll data, or fallback to estimate
    // The calculate-queued-analytics.ts logic requires warehouseExpenses with periodStart/periodEnd
    // If those aren't set properly, labor will be 0 - use a fallback estimate in that case
    const FALLBACK_LABOR_COST_PER_ITEM = 1.50; // Conservative estimate
    const calculatedLaborCost = baseAnalytics.labor.totalCost;
    const laborCost = calculatedLaborCost > 0 ? calculatedLaborCost : (itemCount * FALLBACK_LABOR_COST_PER_ITEM);

    const operationalTotal = estimatedShipping + transactionFees + laborCost;

    // C. Fixed Overhead (Rent, Utilities, Subscriptions)
    // Extrapolate from most recent warehouseExpenses entries
    const workDaysNeeded = baseAnalytics.labor.workDaysNeeded || 1;
    const calendarDaysNeeded = Math.ceil(workDaysNeeded * (7 / 5.5)); // Convert work days to calendar days

    // Get all recent expenses and filter in JS to avoid DB enum mismatch issues
    // (schema might have newer enum values than actual DB)
    const allRecentExpenses = await db
        .select()
        .from(warehouseExpenses)
        .orderBy(desc(warehouseExpenses.date))
        .limit(100); // Get last 100 expenses, should be plenty

    // For each category, find the most recent entry and calculate daily rate
    const dailyRates: Record<string, number> = { rent: 0, utilities: 0, subscriptions: 0, other: 0 };
    const seenCategories = new Set<string>();

    // Fixed overhead categories we want to track
    const fixedOverheadCategories = ['rent', 'subscriptions'];
    // Marketing/other categories
    const marketingCategories = ['marketing_meta', 'marketing_google', 'sponsorship', 'other'];

    // Calculate daily rates for fixed overhead
    for (const exp of allRecentExpenses) {
        const cat = exp.category;
        if (!fixedOverheadCategories.includes(cat)) continue;
        if (seenCategories.has(cat)) continue; // Only use most recent for each category
        seenCategories.add(cat);

        // Calculate daily rate from the expense period
        if (exp.periodStart && exp.periodEnd) {
            const periodDays = Math.max(1, Math.ceil((exp.periodEnd.getTime() - exp.periodStart.getTime()) / (1000 * 60 * 60 * 24)));
            dailyRates[cat] = exp.amount / periodDays;
        } else {
            // If no period specified, assume it's a monthly expense
            dailyRates[cat] = (exp.amount * 12) / 365;
        }
    }

    // Calculate marketing/other from last 30 days
    const thirtyDaysAgo = addDays(new Date(), -30);
    const marketingTotal = allRecentExpenses
        .filter(e => marketingCategories.includes(e.category) && e.date >= thirtyDaysAgo)
        .reduce((sum, e) => sum + e.amount, 0);
    dailyRates['other'] = marketingTotal / 30;

    // Project over the work period
    const rentCost = dailyRates['rent'] * calendarDaysNeeded;
    // Utilities are now tracked per-item (electricity), so we remove it from fixed
    const utilitiesCost = 0;
    const subscriptionsCost = dailyRates['subscriptions'] * calendarDaysNeeded;
    const otherFixedCost = dailyRates['other'] * calendarDaysNeeded;

    const fixedTotal = rentCost + utilitiesCost + subscriptionsCost + otherFixedCost;

    // 4. Totals
    const totalExpenses = cogsTotal + operationalTotal + fixedTotal;
    const netProfit = revenue - totalExpenses;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // 5. Dates
    const today = new Date();
    // Add work days (skipping weekends? implied in workDaysNeeded usually being "shifts")
    // Simple projection: today + workDaysNeeded (calendar days? No, workDaysNeeded is 5.5/week adjusted?)
    // baseAnalytics.labor.workDaysNeeded is "shifts".
    // Let's assume 1 shift per calendar day for simplicity or 5.5/7.
    // If we want "Expected Completion Date", we should add workDaysNeeded adjusted for weekends.
    // Approximation: workDaysNeeded * (7 / 5.5) = Calendar Days.
    const calendarDays = workDaysNeeded * (7 / 5.5);
    const expectedCompletionDate = addDays(today, Math.ceil(calendarDays));

    // 6. Garment Breakdown - count and average cost per garment type
    // Now with box variant detection for tees, crewnecks, and hoodies
    let garmentBreakdown: GarmentBreakdown[] = [];
    if (orderIds.length > 0) {
        const garmentData = await db
            .select({
                garmentType: blanks.garmentType,
                lineItemName: lineItems.name,
                qty: lineItems.quantity,
                cost: blanks.customsPrice,
            })
            .from(lineItems)
            .innerJoin(productVariants, eq(lineItems.variantId, productVariants.id))
            .innerJoin(blankVariants, eq(productVariants.blankVariantId, blankVariants.id))
            .innerJoin(blanks, eq(blankVariants.blankId, blanks.id))
            .where(and(
                inArray(lineItems.orderId, orderIds),
                eq(lineItems.requiresShipping, true)
            ));

        // Aggregate by garment type, with box variant detection
        const garmentMap = new Map<string, { count: number; totalCost: number }>();

        // Types that have box variants
        const boxVariantTypes = ['tee', 'crewneck', 'hoodie'];

        for (const item of garmentData) {
            const baseType = item.garmentType || 'unknown';
            const lineItemName = (item.lineItemName || '').toLowerCase();

            // Check if this is a box variant by looking for "box" in the line item name
            let type: string = baseType;
            if (boxVariantTypes.includes(baseType)) {
                const isBox = lineItemName.includes('box');
                type = isBox ? `box_${baseType}` : baseType;
            }

            const existing = garmentMap.get(type) || { count: 0, totalCost: 0 };
            existing.count += item.qty;
            existing.totalCost += item.qty * (item.cost || 0);
            garmentMap.set(type, existing);
        }

        // Convert to array with display names
        const displayNames: Record<string, string> = {
            tee: 'Tee',
            box_tee: 'Box Tee',
            longsleeve: 'Long Sleeve',
            crewneck: 'Crewneck',
            box_crewneck: 'Box Crewneck',
            hoodie: 'Hoodie',
            box_hoodie: 'Box Hoodie',
            shorts: 'Shorts',
            sweatpants: 'Pants',
            jacket: 'Jacket',
            coat: 'Coat',
            headwear: 'Headwear',
            accessory: 'Accessory',
        };

        // Custom sort order to group related items
        const sortOrder: Record<string, number> = {
            tee: 1,
            box_tee: 2,
            hoodie: 3,
            box_hoodie: 4,
            crewneck: 5,
            box_crewneck: 6,
            longsleeve: 7,
            sweatpants: 8,
            shorts: 9,
            jacket: 10,
            coat: 11,
            headwear: 12,
            accessory: 13,
        };

        garmentBreakdown = Array.from(garmentMap.entries())
            .map(([type, data]) => ({
                garmentType: displayNames[type] || type,
                count: data.count,
                totalCost: data.totalCost,
                avgCost: data.count > 0 ? data.totalCost / data.count : 0,
            }))
            .sort((a, b) => {
                // Sort by custom order, then by count if same order
                const orderA = sortOrder[Object.keys(displayNames).find(k => displayNames[k] === a.garmentType) || ''] || 99;
                const orderB = sortOrder[Object.keys(displayNames).find(k => displayNames[k] === b.garmentType) || ''] || 99;
                if (orderA !== orderB) return orderA - orderB;
                return b.count - a.count;
            });
    }

    return {
        mode: "outstanding",
        metrics: {
            revenue,
            netProfit,
            profitMargin,
            totalExpenses,
            orderCount,
            itemCount
        },
        expenses: {
            cogs: {
                total: cogsTotal,
                blanks: blanksCost,
                ink: inkCost,
                supplies: suppliesCost
            },
            operational: {
                total: operationalTotal,
                shipping: estimatedShipping,
                transactionFees,
                labor: laborCost,
                laborCostPerItem: itemCount > 0 ? laborCost / itemCount : 0
            },
            fixed: {
                total: fixedTotal,
                rent: rentCost,
                utilities: utilitiesCost,
                subscriptions: subscriptionsCost,
                other: otherFixedCost
            }
        },
        projections: {
            expectedCompletionDate,
            workDaysRemaining: workDaysNeeded,
            dailyThroughput: baseAnalytics.labor.itemsPerDay
        },
        perOrderCosts: perOrderCostsBreakdown,
        perItemCosts: perItemCostsBreakdown,
        garmentBreakdown
    };
}

// --- Time-Based Mode Implementation ---

async function getTimeBasedAnalytics(start: Date, end: Date): Promise<UnifiedAnalyticsSummary> {
    // 1. Reuse financial-metrics
    const base = await getFinancialMetrics(start, end);

    // 2. Adjustments and Breakdowns
    const newItemCount = base.metrics.itemCount;
    const orderCount = base.metrics.orderCount;

    // Build detailed per-order cost breakdown
    const perOrderCostsBreakdown: PerOrderCostBreakdown = {
        thankYouCards: PER_ORDER_COSTS.thankYouCards * orderCount,
        polymailer: PER_ORDER_COSTS.polymailer * orderCount,
        integratedPaper: PER_ORDER_COSTS.integratedPaper * orderCount,
        blankPaper: PER_ORDER_COSTS.blankPaper * orderCount,
        cleaningSolution: PER_ORDER_COSTS.cleaningSolution * orderCount,
        subtotal: PER_ORDER_SUBTOTAL * orderCount,
        buffer: (PER_ORDER_SUBTOTAL * orderCount) * PER_ORDER_BUFFER,
        total: PER_ORDER_TOTAL * orderCount,
    };

    // Build detailed per-item cost breakdown
    const perItemCostsBreakdown: PerItemCostBreakdown = {
        neckLabel: PER_ITEM_COSTS.neckLabel * newItemCount,
        parchmentPaper: PER_ITEM_COSTS.parchmentPaper * newItemCount,
        pretreat: PER_ITEM_COSTS.pretreat * newItemCount,
        ink: PER_ITEM_COSTS.ink * newItemCount,
        printerRepairs: PER_ITEM_COSTS.printerRepairs * newItemCount,
        electricity: PER_ITEM_COSTS.electricity * newItemCount,
        subtotal: PER_ITEM_SUBTOTAL * newItemCount,
        buffer: (PER_ITEM_SUBTOTAL * newItemCount) * PER_ITEM_BUFFER,
        total: PER_ITEM_TOTAL * newItemCount,
    };

    // Transaction Fees
    const transactionFees = (base.revenue * SHOPIFY_FEE_PERCENTAGE) + (base.metrics.orderCount * SHOPIFY_FEE_FIXED);

    // COGS
    // Use calculated costs for ink/materials and supplies
    const newInkCost = perItemCostsBreakdown.total;
    const newSuppliesCost = perOrderCostsBreakdown.total;
    const cogsTotal = base.blanksCost + newInkCost + newSuppliesCost;

    // Operational
    const operationalTotal = base.shippingCost + transactionFees + base.laborCost;

    // Fixed Overhead
    // Base returns 'recurringCosts' with { rent, marketing, other }.
    // We need to split 'other' or check if we can get utilities/subs split.
    // The current `getFinancialMetrics` aggregates them. 
    // For now, we'll map existing categories.
    // Since we didn't migrate DB yet, 'utilities' and 'subscriptions' likely fall under 'other' or aren't tracked separately yet.
    // We will use the existing buckets but alias them if possible, or just put them in 'other' for now.

    // However, if we want to show them as 0 for now (since no data):
    const rent = base.recurringCosts.rent;
    const marketing = base.recurringCosts.marketing;
    const other = base.recurringCosts.other;

    // Total Expenses Re-calc
    const totalExpenses = cogsTotal + operationalTotal + (rent + marketing + other);
    const netProfit = base.revenue - totalExpenses;
    const profitMargin = base.revenue > 0 ? (netProfit / base.revenue) * 100 : 0;

    return {
        mode: "time-based",
        dateRange: { from: start, to: end },
        metrics: {
            revenue: base.revenue,
            netProfit,
            profitMargin,
            totalExpenses,
            orderCount: base.metrics.orderCount,
            itemCount: newItemCount
        },
        expenses: {
            cogs: {
                total: cogsTotal,
                blanks: base.blanksCost,
                ink: newInkCost,
                supplies: newSuppliesCost
            },
            operational: {
                total: operationalTotal,
                shipping: base.shippingCost,
                transactionFees,
                labor: base.laborCost,
                laborCostPerItem: newItemCount > 0 ? base.laborCost / newItemCount : 0
            },
            fixed: {
                total: rent + marketing + other,
                rent,
                utilities: 0, // Not yet broken out in base function
                subscriptions: 0,
                other: marketing + other
            }
        },
        perOrderCosts: perOrderCostsBreakdown,
        perItemCosts: perItemCostsBreakdown,
    };
}


// --- Helpers ---

async function getAverageShippingCost() {
    // Look at last 1000 shipped orders
    const recentShipments = await db
        .select({ cost: shipments.cost })
        .from(shipments)
        .where(eq(shipments.isPurchased, true))
        .orderBy(desc(shipments.createdAt))
        .limit(1000);

    if (recentShipments.length === 0) return 15; // Fallback estimate

    const total = recentShipments.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
    return total / recentShipments.length;
}

