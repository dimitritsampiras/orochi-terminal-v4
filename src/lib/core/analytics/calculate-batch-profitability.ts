import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { batchFinancialsQuery } from "@/lib/graphql/analytics.graphql";
import {
    batches,
    blanks,
    globalSettings,
    inventoryTransactions,
    orders,
    ordersBatches,
    lineItems,
    shipments,
    warehouseExpenses,
    blankVariants,
} from "@drizzle/schema";
import { eq, inArray, getTableColumns } from "drizzle-orm";

export type BatchProfitability = {
    batchId: number;
    revenue: {
        totalSales: number;
        totalRefunds: number;
        netSales: number;
        currency: string;
    };
    costs: {
        shipping: number;
        blanks: number;
        inkAndSupplies: number;
        total: number;
    };
    expenses: {
        total: number;
        breakdown: {
            category: string;
            amount: number;
        }[];
    };
    profit: {
        net: number;
        margin: number;
    };
    metrics: {
        totalOrders: number;
        totalItems: number;
        manHours: number;
        daysToFulfill: number;
    };
};

export async function calculateBatchProfitability(
    batchId: number,
    shopifyClient = shopify
): Promise<BatchProfitability | null> {
    // 1. Fetch Batch
    // 1. Fetch Batch Details (SQL API)
    const [batchData] = await db
        .select()
        .from(batches)
        .where(eq(batches.id, batchId));

    if (!batchData) return null;

    // Fetch related Orders via ordersBatches table
    const ordersBatchesLink = await db
        .select({ orderId: ordersBatches.orderId })
        .from(ordersBatches)
        .where(eq(ordersBatches.batchId, batchId));

    const batchOrderIds = ordersBatchesLink.map(link => link.orderId);

    // Fetch Orders and LineItems if we have orders
    let batchOrders: any[] = [];
    if (batchOrderIds.length > 0) {
        batchOrders = await db
            .select()
            .from(orders)
            .where(inArray(orders.id, batchOrderIds));

        // Fetch LineItems for these orders
        const batchLineItems = await db
            .select()
            .from(lineItems)
            .where(inArray(lineItems.orderId, batchOrderIds));

        // Manually attach lineItems to orders for calculation logic compatibility
        batchOrders = batchOrders.map(order => ({
            ...order,
            lineItems: batchLineItems.filter(li => li.orderId === order.id)
        }));
    }

    const batch = {
        ...batchData,
        orders: batchOrders
    };

    if (!batch) return null;

    // batchOrderIds is already available from above
    const totalItems = batch.orders.reduce((acc, o) => acc + o.lineItems.length, 0);

    // 2. Fetch Global Settings (SQL API)
    const [settings] = await db.select().from(globalSettings).limit(1);
    const defaults = {
        inkCostPerPrint: settings?.inkCostPerPrint ?? 0,
        bagCostPerOrder: settings?.bagCostPerOrder ?? 0,
        labelCostPerOrder: settings?.labelCostPerOrder ?? 0,
    };

    // 3. Fetch Shipping Costs from Shipments
    // We sum the cost of all purchased shipments for orders in this batch
    // 3. Fetch Shipping Costs from Shipments (SQL API)
    const batchShipments = await db
        .select()
        .from(shipments)
        .where(inArray(shipments.orderId, batchOrderIds));

    const totalShippingCost = batchShipments.reduce((acc, s) => {
        return acc + (s.isPurchased && !s.isRefunded && s.cost ? Number(s.cost) : 0);
    }, 0);

    // 4. Fetch Blank Costs
    // Identify inventory transactions for this batch
    // 4. Fetch Blank Costs (SQL API - Joined)
    // Identify inventory transactions for this batch
    // We need transaction -> blankVariant -> blank
    const transactions = await db
        .select({
            ...getTableColumns(inventoryTransactions),
            blankVariant: blankVariants,
            blank: blanks,
        })
        .from(inventoryTransactions)
        .leftJoin(blankVariants, eq(inventoryTransactions.blankVariantId, blankVariants.id))
        .leftJoin(blanks, eq(blankVariants.blankId, blanks.id))
        .where(eq(inventoryTransactions.batchId, batchId));

    // Calculate cost based on blank customsPrice (assuming that is the cost price)
    let totalBlankCost = 0;
    for (const tx of transactions) {
        if (tx.blankVariant && tx.blank && tx.changeAmount < 0) {
            const quantityUsed = Math.abs(tx.changeAmount);
            const unitCost = tx.blank.customsPrice;
            totalBlankCost += quantityUsed * unitCost;
        }
    }

    // 5. Calculate Ink & Supplies
    // Simple estimation: items * ink_cost + orders * (bag + label)
    const totalInkCost = totalItems * defaults.inkCostPerPrint;
    const totalSuppliesCost = batch.orders.length * (defaults.bagCostPerOrder + defaults.labelCostPerOrder);
    const totalInkAndSupplies = totalInkCost + totalSuppliesCost;

    // 6. Fetch Manual Warehouse Expenses
    // 6. Fetch Manual Warehouse Expenses (SQL API)
    const expenses = await db
        .select()
        .from(warehouseExpenses)
        .where(eq(warehouseExpenses.batchId, batchId));

    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const expenseBreakdown = expenses.map(e => ({ category: e.category, amount: e.amount }));

    // 7. Fetch Revenue from Shopify
    let totalSales = 0;
    let totalRefunds = 0;
    let currency = "USD";

    if (batchOrderIds.length > 0) {
        // Shopify API only accepts IDs in specific format usually, but here we likely store standard GIDs
        // We process in chunks of 50 just in case
        const chunkSize = 50;
        for (let i = 0; i < batchOrderIds.length; i += chunkSize) {
            const chunk = batchOrderIds.slice(i, i + chunkSize);
            try {
                const { data, errors } = await shopify.request(batchFinancialsQuery, {
                    variables: {
                        ids: chunk
                    }
                });

                if (data?.nodes) {
                    for (const node of data.nodes) {
                        if (!node || !('totalPriceSet' in node)) continue;

                        const order = node as any; // Typed via GraphQL query theoretically
                        const price = parseFloat(order.totalPriceSet?.shopMoney?.amount ?? "0");
                        const refunded = parseFloat(order.totalRefundedSet?.shopMoney?.amount ?? "0");

                        totalSales += price;
                        totalRefunds += refunded;
                        currency = order.totalPriceSet?.shopMoney?.currencyCode ?? currency;
                    }
                }
            } catch (e) {
                console.error("Failed to fetch shopify financials", e);
            }
        }
    }

    // 8. Metrics
    // Days to fulfill: settledAt - createdAt
    let daysToFulfill = 0;
    if (batch.settledAt) {
        const diffMs = batch.settledAt.getTime() - batch.createdAt.getTime();
        daysToFulfill = diffMs / (1000 * 60 * 60 * 24);
    }

    // Man Hours: Placeholder or estimation
    // If we assume a standard rate of X mins per item, or try to infer.
    // User asked for "Based on historical data". 
    // For now, we'll return 0 or a placeholder calculation until we have a proper time tracking model.
    // Maybe number of logs?
    const manHours = 0;

    const netSales = totalSales - totalRefunds;
    const totalCosts = totalShippingCost + totalBlankCost + totalInkAndSupplies + totalExpenses;
    const netProfit = netSales - totalCosts;
    const margin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    return {
        batchId,
        revenue: {
            totalSales,
            totalRefunds,
            netSales,
            currency
        },
        costs: {
            shipping: totalShippingCost,
            blanks: totalBlankCost,
            inkAndSupplies: totalInkAndSupplies,
            total: totalCosts
        },
        expenses: {
            total: totalExpenses,
            breakdown: expenseBreakdown
        },
        profit: {
            net: netProfit,
            margin
        },
        metrics: {
            totalOrders: batch.orders.length,
            totalItems,
            manHours,
            daysToFulfill
        }
    };
}
