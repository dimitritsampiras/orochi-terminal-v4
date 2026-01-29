"use server";

import { getFinancialMetrics, getDailyFinancialMetrics, FinancialMetrics } from "@/lib/core/analytics/financial-metrics";
import { eachDayOfInterval, format } from "date-fns";


import { getUnifiedAnalytics, UnifiedAnalyticsSummary, AnalyticsMode, GarmentBreakdown, PerOrderCostBreakdown, PerItemCostBreakdown } from "@/lib/core/analytics/unified-analytics";

export type { UnifiedAnalyticsSummary, AnalyticsMode, GarmentBreakdown, PerOrderCostBreakdown, PerItemCostBreakdown };

export type FinancialChartData = {
    date: string;
    revenue: number;
    profit: number;
};

export type DashboardFinancials = {
    summary: FinancialMetrics;
    chartData: FinancialChartData[];
};

export async function fetchFinancialMetrics(
    start: Date | string,
    end: Date | string
): Promise<FinancialMetrics> {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;

    return await getFinancialMetrics(startDate, endDate);
}

export async function fetchDashboardFinancials(
    start: Date | string,
    end: Date | string
): Promise<DashboardFinancials> {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;

    // 1. Get Overall Summary (Wait for result)
    const summaryPromise = getFinancialMetrics(startDate, endDate);

    // 2. Get Daily Metrics (Batched)
    const dailyMetricsPromise = getDailyFinancialMetrics(startDate, endDate);

    const [summary, dailyMetrics] = await Promise.all([summaryPromise, dailyMetricsPromise]);

    // 3. Map to Chart Data
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const chartData = dailyMetrics.map((metrics, i) => {
        const day = days[i] || new Date();
        return {
            date: format(day, "MMM dd"),
            revenue: metrics.revenue,
            profit: metrics.netProfit,
        };
    });

    return {
        summary,
        chartData
    };
}

export async function fetchUnifiedAnalytics(
    mode: AnalyticsMode,
    start?: Date | string,
    end?: Date | string
): Promise<UnifiedAnalyticsSummary> {
    const startDate = start ? (typeof start === 'string' ? new Date(start) : start) : undefined;
    const endDate = end ? (typeof end === 'string' ? new Date(end) : end) : undefined;

    return await getUnifiedAnalytics(mode, startDate && endDate ? { from: startDate, to: endDate } : undefined);
}
