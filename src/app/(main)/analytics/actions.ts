"use server";

import { calculatePeriodProfitability, PeriodProfitability } from "@/lib/core/analytics/calculate-period-profitability";
import { subDays, eachDayOfInterval, format } from "date-fns";
import { startOfDayEastern, endOfDayEastern, startOfMonthEastern, endOfMonthEastern, startOfWeekEastern, endOfWeekEastern } from "@/lib/utils";

export type DashboardData = {
    summary: PeriodProfitability;
    chartData: {
        date: string;
        revenue: number;
        profit: number;
        expenses: number;
    }[];
};

export async function getDashboardData(
    range: { from: Date; to: Date },
    groupBy: "day" | "week" | "month" = "day"
): Promise<DashboardData> {
    // 1. Get Summary for the whole range
    const summary = await calculatePeriodProfitability(range.from, range.to);

    // 2. Generate Series Data
    // Note: This naive approach runs the full calculation for every interval. 
    // In production, we should optimize by fetching all data once and aggregating in memory.
    // For now, to ensure correctness, we will loop. We'll start with daily.

    // Limit chart data to prevent timeouts (max 31 slices for now)
    const intervals = eachDayOfInterval({ start: range.from, end: range.to });

    // Parallelize calculations for separate days
    // Warning: This creates heavy DB/API load.
    const seriesPromises = intervals.map(async (date) => {
        const dayStart = startOfDayEastern(date);
        const dayEnd = endOfDayEastern(date);
        const data = await calculatePeriodProfitability(dayStart, dayEnd);
        return {
            date: format(date, "MMM dd"),
            revenue: data.revenue,
            profit: data.profit.net,
            expenses: data.costs.total
        };
    });

    const chartData = await Promise.all(seriesPromises);

    return {
        summary,
        chartData
    };
}
