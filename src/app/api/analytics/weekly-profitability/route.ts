import { db } from "@/lib/clients/db";
import { weeklyReports } from "@drizzle/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    calculateWeeklyProfitability,
    getCurrentWeek,
} from "@/lib/core/analytics/calculate-weekly-profitability";

const calculateSchema = z.object({
    startDate: z.string().transform((str) => new Date(str)),
    endDate: z.string().transform((str) => new Date(str)),
    payrollCost: z.number().optional(),
    useHistoricalPayroll: z.boolean().optional(),
    marketingCostMeta: z.number().optional(),
    marketingCostGoogle: z.number().optional(),
    marketingCostOther: z.number().optional(),
    includeCsvExpenses: z.boolean().optional(),
});

const saveSchema = z.object({
    startDate: z.string().transform((str) => new Date(str)),
    endDate: z.string().transform((str) => new Date(str)),
    payrollCost: z.number().nullable().optional(),
    useHistoricalPayroll: z.boolean().optional(),
    marketingCostMeta: z.number().optional(),
    marketingCostGoogle: z.number().optional(),
    marketingCostOther: z.number().optional(),
    notes: z.string().optional(),
    finalize: z.boolean().optional().default(false),
    // Optional: pass the full report data to save directly (preserves fetched shipping rates)
    fullReportData: z.any().optional(),
});

/**
 * GET /api/analytics/weekly-profitability
 * Calculate weekly profitability report
 *
 * Query params:
 * - startDate (optional): Week start date (defaults to current week Monday)
 * - endDate (optional): Week end date (defaults to current week Sunday)
 * - checkSaved: Whether to check for existing saved report
 *
 * Also accepts optional query params for calculations:
 * - payrollCost
 * - useHistoricalPayroll
 * - marketingCostMeta
 * - marketingCostGoogle
 * - marketingCostOther
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    try {
        // Get date range (default to current week)
        const currentWeek = getCurrentWeek();
        const startDate = searchParams.get("startDate")
            ? new Date(searchParams.get("startDate")!)
            : currentWeek.start;
        const endDate = searchParams.get("endDate")
            ? new Date(searchParams.get("endDate")!)
            : currentWeek.end;

        const checkSaved = searchParams.get("checkSaved") === "true";

        // Check if a saved report exists for this week
        if (checkSaved) {
            const savedReport = await db
                .select()
                .from(weeklyReports)
                .where(
                    and(
                        eq(weeklyReports.weekStart, startDate),
                        eq(weeklyReports.weekEnd, endDate)
                    )
                )
                .limit(1);

            if (savedReport.length > 0) {
                return NextResponse.json({
                    ...savedReport[0],
                    isSaved: true,
                    reportId: savedReport[0].id,
                });
            }
        }

        // Parse optional calculation parameters
        const options = {
            payrollCost: searchParams.get("payrollCost")
                ? parseFloat(searchParams.get("payrollCost")!)
                : undefined,
            useHistoricalPayroll:
                searchParams.get("useHistoricalPayroll") === "true",
            marketingCostMeta: searchParams.get("marketingCostMeta")
                ? parseFloat(searchParams.get("marketingCostMeta")!)
                : undefined,
            marketingCostGoogle: searchParams.get("marketingCostGoogle")
                ? parseFloat(searchParams.get("marketingCostGoogle")!)
                : undefined,
            marketingCostOther: searchParams.get("marketingCostOther")
                ? parseFloat(searchParams.get("marketingCostOther")!)
                : undefined,
            includeCsvExpenses:
                searchParams.get("includeCsvExpenses") === "true",
            fetchUnpurchasedShippingRates:
                searchParams.get("fetchUnpurchasedShippingRates") === "true",
        };

        // Calculate profitability
        const report = await calculateWeeklyProfitability(
            startDate,
            endDate,
            options
        );

        return NextResponse.json({
            ...report,
            isSaved: false,
            reportId: null,
        });
    } catch (error) {
        console.error("Failed to calculate weekly profitability:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal Server Error",
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/analytics/weekly-profitability
 * Save weekly profitability report to database
 *
 * Body:
 * {
 *   startDate: string,
 *   endDate: string,
 *   payrollCost?: number,
 *   useHistoricalPayroll?: boolean,
 *   marketingCostMeta?: number,
 *   marketingCostGoogle?: number,
 *   marketingCostOther?: number,
 *   notes?: string,
 *   finalize?: boolean
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const json = await request.json();
        const body = saveSchema.parse(json);

        const {
            startDate,
            endDate,
            payrollCost,
            useHistoricalPayroll,
            marketingCostMeta,
            marketingCostGoogle,
            marketingCostOther,
            notes,
            finalize,
            fullReportData,
        } = body;

        // Use fullReportData if provided (preserves fetched shipping rates),
        // otherwise calculate fresh
        const report = fullReportData ?? await calculateWeeklyProfitability(startDate, endDate, {
            payrollCost: payrollCost ?? undefined,
            useHistoricalPayroll,
            marketingCostMeta,
            marketingCostGoogle,
            marketingCostOther,
        });

        // Check if report already exists for this week
        const existingReport = await db
            .select()
            .from(weeklyReports)
            .where(
                and(
                    eq(weeklyReports.weekStart, startDate),
                    eq(weeklyReports.weekEnd, endDate)
                )
            )
            .limit(1);

        if (existingReport.length > 0) {
            // Update existing report
            const [updated] = await db
                .update(weeklyReports)
                .set({
                    // Revenue
                    grossSales: report.revenue.grossSales.toString(),
                    shopifyFees: report.revenue.shopifyFees.toString(),
                    refunds: report.revenue.refunds.toString(),
                    returns: report.revenue.returns.toString(),
                    netRevenue: report.revenue.netRevenue.toString(),

                    // Fulfillment
                    blanksCost: report.fulfillment.blanksCost.toString(),
                    inkCost: report.fulfillment.inkCost.toString(),
                    shippingCost: report.fulfillment.shippingCost.toString(),
                    perItemCosts: report.fulfillment.perItemCosts.toString(),
                    perOrderCosts: report.fulfillment.perOrderCosts.toString(),
                    totalFulfillmentCost: report.fulfillment.total.toString(),

                    // Operating
                    payrollCost: report.operating.payrollCost?.toString() || null,
                    payrollSource: report.operating.payrollSource,
                    marketingCostMeta: report.operating.marketingCostMeta.toString(),
                    marketingCostGoogle:
                        report.operating.marketingCostGoogle.toString(),
                    marketingCostOther: report.operating.marketingCostOther.toString(),
                    totalMarketingCost: report.operating.totalMarketing.toString(),
                    recurringExpenses: report.operating.recurringExpenses.toString(),

                    // Profitability
                    totalCosts: report.profitability.totalCosts.toString(),
                    grossProfit: report.profitability.grossProfit.toString(),
                    profitMargin: report.profitability.profitMargin.toString(),

                    // Metadata
                    itemsFulfilled: report.fulfillment.itemCount,
                    ordersFulfilled: report.fulfillment.orderCount,
                    costPerItem: report.profitability.costPerItem.toString(),
                    costPerOrder: report.profitability.costPerOrder.toString(),

                    // Analysis
                    notes,
                    analysisJson: report as any,

                    // Finalize if requested
                    isFinalized: finalize,
                    finalizedAt: finalize ? sql`now()` : existingReport[0].finalizedAt,
                    lastModifiedAt: sql`now()`,
                })
                .where(eq(weeklyReports.id, existingReport[0].id))
                .returning();

            return NextResponse.json({
                success: true,
                report: updated,
                message: "Weekly report updated successfully",
            });
        }

        // Create new report
        const [newReport] = await db
            .insert(weeklyReports)
            .values({
                // Week identification
                weekStart: startDate,
                weekEnd: endDate,
                weekNumber: report.week.weekNumber,
                year: report.week.year,

                // Revenue
                grossSales: report.revenue.grossSales.toString(),
                shopifyFees: report.revenue.shopifyFees.toString(),
                refunds: report.revenue.refunds.toString(),
                returns: report.revenue.returns.toString(),
                netRevenue: report.revenue.netRevenue.toString(),

                // Fulfillment
                blanksCost: report.fulfillment.blanksCost.toString(),
                inkCost: report.fulfillment.inkCost.toString(),
                shippingCost: report.fulfillment.shippingCost.toString(),
                perItemCosts: report.fulfillment.perItemCosts.toString(),
                perOrderCosts: report.fulfillment.perOrderCosts.toString(),
                totalFulfillmentCost: report.fulfillment.total.toString(),

                // Operating
                payrollCost: report.operating.payrollCost?.toString() || null,
                payrollSource: report.operating.payrollSource,
                marketingCostMeta: report.operating.marketingCostMeta.toString(),
                marketingCostGoogle: report.operating.marketingCostGoogle.toString(),
                marketingCostOther: report.operating.marketingCostOther.toString(),
                totalMarketingCost: report.operating.totalMarketing.toString(),
                recurringExpenses: report.operating.recurringExpenses.toString(),

                // Profitability
                totalCosts: report.profitability.totalCosts.toString(),
                grossProfit: report.profitability.grossProfit.toString(),
                profitMargin: report.profitability.profitMargin.toString(),

                // Metadata
                itemsFulfilled: report.fulfillment.itemCount,
                ordersFulfilled: report.fulfillment.orderCount,
                costPerItem: report.profitability.costPerItem.toString(),
                costPerOrder: report.profitability.costPerOrder.toString(),

                // Analysis
                notes,
                analysisJson: report as any,

                // Finalize if requested
                isFinalized: finalize,
                finalizedAt: finalize ? sql`now()` : null,
                // createdBy would be set here if we had auth context
            })
            .returning();

        return NextResponse.json({
            success: true,
            report: newReport,
            message: "Weekly report saved successfully",
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.issues },
                { status: 400 }
            );
        }
        console.error("Failed to save weekly profitability report:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
