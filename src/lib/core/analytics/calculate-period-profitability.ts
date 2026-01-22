import { db } from "@/lib/clients/db";
import { batches, warehouseExpenses } from "@drizzle/schema";
import { and, gte, lte, eq, isNull, or, isNotNull } from "drizzle-orm";
import { calculateBatchProfitability } from "./calculate-batch-profitability";
import { calculateRecurringExpenses } from "./recurring-expenses";

export type PeriodProfitability = {
    revenue: number;
    costs: {
        cogs: number; // Blanks + Ink/Supplies + Shipping
        shipping: number;
        blanks: number;
        inkAndSupplies: number;
        verifiedExpenses: number; // One-off linked to batches
        operationExpenses: number; // One-off unlinked + Recurring
        total: number;
    };
    profit: {
        net: number;
        margin: number;
    };
    metrics: {
        batchesCount: number;
        ordersCount: number;
        itemsCount: number;
    };
};

export async function calculatePeriodProfitability(
    startDate: Date,
    endDate: Date
): Promise<PeriodProfitability> {
    // 1. Fetch Batches settled in range
    const settledBatches = await db
        .select()
        .from(batches)
        .where(
            and(
                gte(batches.settledAt, startDate),
                lte(batches.settledAt, endDate)
            )
        );

    // 2. Aggregate Batch Profitability
    let revenue = 0;
    let shippingCost = 0;
    let blankCost = 0;
    let inkSupplyCost = 0;
    let batchLinkedExpenses = 0;
    let ordersCount = 0;
    let itemsCount = 0;

    // Use Promise.all with concurrency limit if needed, but for now simple parallelism
    const batchCalculations = await Promise.all(
        settledBatches.map(b => calculateBatchProfitability(b.id))
    );

    for (const batch of batchCalculations) {
        if (!batch) continue;
        revenue += batch.revenue.netSales;
        shippingCost += batch.costs.shipping;
        blankCost += batch.costs.blanks;
        inkSupplyCost += batch.costs.inkAndSupplies;
        batchLinkedExpenses += batch.expenses.total;
        ordersCount += batch.metrics.totalOrders;
        itemsCount += batch.metrics.totalItems;
    }

    // 3. Fetch One-off Unlinked Expenses in range
    // Expenses that are NOT linked to a batch (batchId is null) AND (date is in range OR period overlaps)
    const oneOffExpenses = await db
        .select()
        .from(warehouseExpenses)
        .where(
            and(
                isNull(warehouseExpenses.batchId),
                or(
                    // Case A: Single day expense (periodStart is null) -> date must be in range
                    and(
                        isNull(warehouseExpenses.periodStart),
                        gte(warehouseExpenses.date, startDate),
                        lte(warehouseExpenses.date, endDate)
                    ),
                    // Case B: Period expense -> period must overlap with range
                    and(
                        isNotNull(warehouseExpenses.periodStart),
                        lte(warehouseExpenses.periodStart, endDate),
                        gte(warehouseExpenses.periodEnd, startDate)
                    )
                )
            )
        );

    let unlinkedOneOffCost = 0;
    for (const expense of oneOffExpenses) {
        if (!expense.periodStart || !expense.periodEnd) {
            unlinkedOneOffCost += expense.amount;
        } else {
            // Calculate overlap and amortize
            const expenseDuration = (expense.periodEnd.getTime() - expense.periodStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
            const dailyCost = expense.amount / Math.max(1, expenseDuration);

            const overlapStart = expense.periodStart < startDate ? startDate : expense.periodStart;
            const overlapEnd = expense.periodEnd > endDate ? endDate : expense.periodEnd;

            const overlapDuration = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24) + 1);

            unlinkedOneOffCost += dailyCost * overlapDuration;
        }
    }

    // 4. Calculate Recurring Expenses (Allocated)
    // Identify categories present in manual expenses to exclude from recurring
    const manualCategories = Array.from(new Set(oneOffExpenses.map(e => e.category)));

    // Explicitly cast to string[] since expenseCategory enum might cause type issues with string comparison
    const excludedCategories = manualCategories.map(c => String(c));

    const recurring = await calculateRecurringExpenses(startDate, endDate, excludedCategories);
    const recurringCost = recurring.total;

    // 5. Totals
    const operationExpenses = unlinkedOneOffCost + recurringCost;
    const totalCosts = shippingCost + blankCost + inkSupplyCost + batchLinkedExpenses + operationExpenses;
    const netProfit = revenue - totalCosts;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
        revenue,
        costs: {
            cogs: shippingCost + blankCost + inkSupplyCost,
            shipping: shippingCost,
            blanks: blankCost,
            inkAndSupplies: inkSupplyCost,
            verifiedExpenses: batchLinkedExpenses,
            operationExpenses,
            total: totalCosts
        },
        profit: {
            net: netProfit,
            margin
        },
        metrics: {
            batchesCount: settledBatches.length,
            ordersCount,
            itemsCount
        }
    };
}
