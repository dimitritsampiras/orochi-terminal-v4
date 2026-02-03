import { db } from "@/lib/clients/db";
import { weeklyReports } from "@drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateWeeklyProfitability } from "@/lib/core/analytics/calculate-weekly-profitability";

const updateSchema = z.object({
    payrollCost: z.number().optional(),
    marketingCostMeta: z.number().optional(),
    marketingCostGoogle: z.number().optional(),
    marketingCostOther: z.number().optional(),
    notes: z.string().optional(),
    finalize: z.boolean().optional(),
    recalculate: z.boolean().optional().default(true), // Recalculate with new inputs
});

/**
 * PATCH /api/analytics/weekly-profitability/[id]
 * Update a saved weekly profitability report
 *
 * Body:
 * {
 *   payrollCost?: number,
 *   marketingCostMeta?: number,
 *   marketingCostGoogle?: number,
 *   marketingCostOther?: number,
 *   notes?: string,
 *   finalize?: boolean,
 *   recalculate?: boolean (default true)
 * }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const json = await request.json();
        const body = updateSchema.parse(json);

        const { recalculate, finalize, notes, ...calculationInputs } = body;

        // Fetch existing report
        const [existingReport] = await db
            .select()
            .from(weeklyReports)
            .where(eq(weeklyReports.id, id))
            .limit(1);

        if (!existingReport) {
            return NextResponse.json(
                { error: "Report not found" },
                { status: 404 }
            );
        }

        // Check if report is finalized
        if (existingReport.isFinalized && !finalize) {
            return NextResponse.json(
                { error: "Cannot update finalized report" },
                { status: 403 }
            );
        }

        // If recalculate is true, recalculate the entire report with new inputs
        if (recalculate) {
            const startDate = new Date(existingReport.weekStart);
            const endDate = new Date(existingReport.weekEnd);

            const report = await calculateWeeklyProfitability(startDate, endDate, {
                payrollCost: calculationInputs.payrollCost,
                useHistoricalPayroll:
                    calculationInputs.payrollCost === undefined, // Use historical if not provided
                marketingCostMeta: calculationInputs.marketingCostMeta,
                marketingCostGoogle: calculationInputs.marketingCostGoogle,
                marketingCostOther: calculationInputs.marketingCostOther,
            });

            // Update with recalculated values
            const [updated] = await db
                .update(weeklyReports)
                .set({
                    // Revenue (recalculated)
                    grossSales: report.revenue.grossSales.toString(),
                    shopifyFees: report.revenue.shopifyFees.toString(),
                    refunds: report.revenue.refunds.toString(),
                    returns: report.revenue.returns.toString(),
                    netRevenue: report.revenue.netRevenue.toString(),

                    // Fulfillment (recalculated)
                    blanksCost: report.fulfillment.blanksCost.toString(),
                    inkCost: report.fulfillment.inkCost.toString(),
                    shippingCost: report.fulfillment.shippingCost.toString(),
                    perItemCosts: report.fulfillment.perItemCosts.toString(),
                    perOrderCosts: report.fulfillment.perOrderCosts.toString(),
                    totalFulfillmentCost: report.fulfillment.total.toString(),

                    // Operating (updated with user inputs)
                    payrollCost: report.operating.payrollCost?.toString() || null,
                    payrollSource: report.operating.payrollSource,
                    marketingCostMeta: report.operating.marketingCostMeta.toString(),
                    marketingCostGoogle:
                        report.operating.marketingCostGoogle.toString(),
                    marketingCostOther: report.operating.marketingCostOther.toString(),
                    totalMarketingCost: report.operating.totalMarketing.toString(),
                    recurringExpenses: report.operating.recurringExpenses.toString(),

                    // Profitability (recalculated)
                    totalCosts: report.profitability.totalCosts.toString(),
                    grossProfit: report.profitability.grossProfit.toString(),
                    profitMargin: report.profitability.profitMargin.toString(),

                    // Metadata (recalculated)
                    itemsFulfilled: report.fulfillment.itemCount,
                    ordersFulfilled: report.fulfillment.orderCount,
                    costPerItem: report.profitability.costPerItem.toString(),
                    costPerOrder: report.profitability.costPerOrder.toString(),

                    // Analysis
                    notes: notes !== undefined ? notes : existingReport.notes,
                    analysisJson: report as any,

                    // Finalize if requested
                    isFinalized:
                        finalize !== undefined ? finalize : existingReport.isFinalized,
                    finalizedAt:
                        finalize === true
                            ? sql`now()`
                            : finalize === false
                                ? null
                                : existingReport.finalizedAt,

                    lastModifiedAt: sql`now()`,
                })
                .where(eq(weeklyReports.id, id))
                .returning();

            return NextResponse.json({
                success: true,
                report: updated,
                message: "Report recalculated and updated successfully",
            });
        }

        // Simple update without recalculation (just update provided fields)
        const updateData: any = {
            lastModifiedAt: sql`now()`,
        };

        if (calculationInputs.payrollCost !== undefined) {
            updateData.payrollCost = calculationInputs.payrollCost.toString();
            updateData.payrollSource = "manual";
        }
        if (calculationInputs.marketingCostMeta !== undefined) {
            updateData.marketingCostMeta =
                calculationInputs.marketingCostMeta.toString();
        }
        if (calculationInputs.marketingCostGoogle !== undefined) {
            updateData.marketingCostGoogle =
                calculationInputs.marketingCostGoogle.toString();
        }
        if (calculationInputs.marketingCostOther !== undefined) {
            updateData.marketingCostOther =
                calculationInputs.marketingCostOther.toString();
        }
        if (notes !== undefined) {
            updateData.notes = notes;
        }
        if (finalize !== undefined) {
            updateData.isFinalized = finalize;
            updateData.finalizedAt = finalize ? sql`now()` : null;
        }

        const [updated] = await db
            .update(weeklyReports)
            .set(updateData)
            .where(eq(weeklyReports.id, id))
            .returning();

        return NextResponse.json({
            success: true,
            report: updated,
            message: "Report updated successfully",
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.issues },
                { status: 400 }
            );
        }
        console.error("Failed to update weekly profitability report:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/analytics/weekly-profitability/[id]
 * Delete a saved weekly profitability report
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const searchParams = request.nextUrl.searchParams;
        const forceDelete = searchParams.get("force") === "true";

        // Check if report exists
        const [existingReport] = await db
            .select()
            .from(weeklyReports)
            .where(eq(weeklyReports.id, id))
            .limit(1);

        if (!existingReport) {
            return NextResponse.json(
                { error: "Report not found" },
                { status: 404 }
            );
        }

        // Check if report is finalized (unless force delete)
        if (existingReport.isFinalized && !forceDelete) {
            return NextResponse.json(
                { error: "Cannot delete finalized report. Use force=true to override." },
                { status: 403 }
            );
        }

        // Delete report
        await db.delete(weeklyReports).where(eq(weeklyReports.id, id));

        return NextResponse.json({
            success: true,
            message: "Report deleted successfully",
        });
    } catch (error) {
        console.error("Failed to delete weekly profitability report:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
