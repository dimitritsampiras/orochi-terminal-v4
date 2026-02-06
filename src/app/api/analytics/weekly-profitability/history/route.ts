import { db } from "@/lib/clients/db";
import { weeklyReports } from "@drizzle/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

/**
 * GET /api/analytics/weekly-profitability/history
 * Fetch historical weekly profitability reports
 *
 * Query params:
 * - limit: Number of reports to return (default: 10)
 * - year: Filter by year (optional)
 * - startDate: Filter reports after this date (optional)
 * - endDate: Filter reports before this date (optional)
 * - includeUnfinalized: Include draft reports (default: true)
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    try {
        const limit = parseInt(searchParams.get("limit") || "10");
        const year = searchParams.get("year");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const includeUnfinalized =
            searchParams.get("includeUnfinalized") !== "false";

        // Build query conditions
        const conditions = [];

        if (year) {
            conditions.push(eq(weeklyReports.year, parseInt(year)));
        }

        if (startDate) {
            conditions.push(gte(weeklyReports.weekStart, new Date(startDate)));
        }

        if (endDate) {
            conditions.push(lte(weeklyReports.weekEnd, new Date(endDate)));
        }

        if (!includeUnfinalized) {
            conditions.push(eq(weeklyReports.isFinalized, true));
        }

        // Fetch reports
        const reports = await db
            .select()
            .from(weeklyReports)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(weeklyReports.weekStart))
            .limit(limit);

        // Calculate summary statistics
        const totalReports = reports.length;
        const finalizedReports = reports.filter((r) => r.isFinalized).length;

        // Calculate averages
        const avgRevenue =
            totalReports > 0
                ? reports.reduce(
                      (sum, r) => sum + parseFloat(r.netRevenue),
                      0
                  ) / totalReports
                : 0;

        const avgProfit =
            totalReports > 0
                ? reports.reduce(
                      (sum, r) => sum + parseFloat(r.grossProfit),
                      0
                  ) / totalReports
                : 0;

        const avgMargin =
            totalReports > 0
                ? reports.reduce(
                      (sum, r) => sum + parseFloat(r.profitMargin || "0"),
                      0
                  ) / totalReports
                : 0;

        // Calculate trends (if we have at least 2 reports)
        let revenueTrend = 0;
        let profitTrend = 0;

        if (totalReports >= 2) {
            const latest = parseFloat(reports[0].netRevenue);
            const previous = parseFloat(reports[1].netRevenue);
            revenueTrend =
                previous > 0 ? ((latest - previous) / previous) * 100 : 0;

            const latestProfit = parseFloat(reports[0].grossProfit);
            const previousProfit = parseFloat(reports[1].grossProfit);
            profitTrend =
                previousProfit > 0
                    ? ((latestProfit - previousProfit) / previousProfit) * 100
                    : 0;
        }

        return NextResponse.json({
            reports: reports.map((report) => ({
                id: report.id,
                week: {
                    start: report.weekStart,
                    end: report.weekEnd,
                    weekNumber: report.weekNumber,
                    year: report.year,
                },
                revenue: {
                    gross: parseFloat(report.grossSales),
                    net: parseFloat(report.netRevenue),
                },
                costs: {
                    fulfillment: parseFloat(report.totalFulfillmentCost),
                    operating:
                        parseFloat(report.totalCosts) -
                        parseFloat(report.totalFulfillmentCost),
                    total: parseFloat(report.totalCosts),
                },
                profitability: {
                    grossProfit: parseFloat(report.grossProfit),
                    profitMargin: parseFloat(report.profitMargin || "0"),
                },
                metadata: {
                    itemsFulfilled: report.itemsFulfilled,
                    ordersFulfilled: report.ordersFulfilled,
                    isFinalized: report.isFinalized,
                    finalizedAt: report.finalizedAt,
                },
                createdAt: report.createdAt,
            })),
            summary: {
                totalReports,
                finalizedReports,
                averages: {
                    revenue: avgRevenue,
                    profit: avgProfit,
                    margin: avgMargin,
                },
                trends: {
                    revenue: revenueTrend,
                    profit: profitTrend,
                },
            },
        });
    } catch (error) {
        console.error("Failed to fetch weekly profitability history:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

/**
 * GET stats endpoint for quick metrics
 */
export async function HEAD(request: NextRequest) {
    try {
        // Get count of reports
        const result = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(weeklyReports);

        const count = result[0]?.count || 0;

        return new NextResponse(null, {
            status: 200,
            headers: {
                "X-Total-Reports": count.toString(),
            },
        });
    } catch (error) {
        return new NextResponse(null, { status: 500 });
    }
}
