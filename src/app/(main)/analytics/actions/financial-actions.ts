"use server";

import { getFinancialMetrics, getDailyFinancialMetrics, FinancialMetrics } from "@/lib/core/analytics/financial-metrics";
import { eachDayOfInterval, format } from "date-fns";

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
    // We assume dailyMetrics array matches individual days in range (getDailyFinancialMetrics ensures this)
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Note: getDailyFinancialMetrics returns array corresponding to days loop
    // But let's map safely by index if lengths match, or by logic if needed. 
    // The implementation iterates eachDayOfInterval so it should match the order.

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
