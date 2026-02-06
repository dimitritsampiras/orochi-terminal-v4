import { db } from "@/lib/clients/db";
import { csvTransactions, monthlyPeriods } from "@drizzle/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { analyzeFinancialFlow } from "@/lib/core/analytics/financial-flow";
import type { NormalizedTransaction } from "@/lib/types/csv-types";

/**
 * GET /api/analytics/monthly-summary
 * Get aggregated financial summary for a given period
 *
 * Query params: month, year
 *
 * Returns:
 * - Period info (month/year)
 * - Upload status for all 4 sources
 * - Total revenue (income transactions)
 * - Total expenses (expense transactions, excluding internal transfers)
 * - Net cash flow
 * - Reconciliation status
 * - Top expenses by vendor
 * - Expenses by category
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    if (!month || !year) {
        return NextResponse.json(
            { error: "Missing required parameters: month and year" },
            { status: 400 }
        );
    }

    try {
        const periodMonth = parseInt(month);
        const periodYear = parseInt(year);

        // Fetch monthly period record
        const [period] = await db
            .select()
            .from(monthlyPeriods)
            .where(
                and(
                    eq(monthlyPeriods.periodMonth, periodMonth),
                    eq(monthlyPeriods.periodYear, periodYear)
                )
            );

        // Fetch all transactions for this period
        const transactions = await db
            .select()
            .from(csvTransactions)
            .where(
                and(
                    eq(csvTransactions.periodMonth, periodMonth),
                    eq(csvTransactions.periodYear, periodYear),
                    isNull(csvTransactions.deletedAt)
                )
            );

        // Map to normalized format for analysis
        const normalizedTransactions: NormalizedTransaction[] = transactions.map(tx => ({
            id: tx.sourceTransactionId,
            date: new Date(tx.transactionDate), // Ensure Date object
            description: tx.description,
            amount: parseFloat(tx.amount),
            currency: tx.currency || 'USD',
            vendor: tx.vendor,
            type: tx.transactionType as 'income' | 'expense' | 'transfer',
            category: (tx.category as any) || null,
            isExcluded: tx.isExcluded,
            isRecurring: tx.isRecurring,
            rawData: (tx.rawCsvRow as Record<string, string>) || {},
        }));

        // Use central logic for analysis
        const analysis = analyzeFinancialFlow(normalizedTransactions);

        const {
            totalRevenue: revenue,
            totalExpenses: expenses,
            netCashFlow,
            categoryBreakdown
        } = analysis;

        // Count reconciled transactions
        const totalRhoCardExpenses = transactions.filter(
            (tx) =>
                tx.source === "rho_credit_card" &&
                tx.transactionType === "expense" &&
                !tx.isExcluded
        ).length;

        const reconciledRhoCardExpenses = transactions.filter(
            (tx) =>
                tx.source === "rho_credit_card" &&
                tx.transactionType === "expense" &&
                !tx.isExcluded &&
                tx.isReconciled
        ).length;

        // Top expenses by vendor (re-using map logic or could use analysis if it provided it)
        // For now, keeping existing vendor map logic but ensuring it matches analysis exclusions if possible
        // The analysis logic filters excluded, so we should do same.

        // Top expenses by vendor (aggregating across all currencies for simplified ranking, but could be specific)
        const vendorMap = new Map<
            string,
            { vendor: string; amounts: Record<string, number>; transactionCount: number }
        >();

        for (const tx of normalizedTransactions) {
            if (
                tx.type === "expense" &&
                !tx.isExcluded &&
                tx.category !== "internal_transfer"
            ) {
                const currency = tx.currency || 'USD';
                let existing = vendorMap.get(tx.vendor);
                const amount = Math.abs(tx.amount);

                if (!existing) {
                    existing = {
                        vendor: tx.vendor,
                        amounts: {},
                        transactionCount: 0,
                    };
                    vendorMap.set(tx.vendor, existing);
                }

                existing.amounts[currency] = (existing.amounts[currency] || 0) + amount;
                existing.transactionCount += 1;
            }
        }

        // For ranking, we'll sum up all values assuming 1:1 roughly or just pick USD. 
        // This is imperfect without rates but sufficient for sorting.
        const topExpensesByVendor = Array.from(vendorMap.values())
            .sort((a, b) => {
                const totalA = Object.values(a.amounts).reduce((s, v) => s + v, 0);
                const totalB = Object.values(b.amounts).reduce((s, v) => s + v, 0);
                return totalB - totalA;
            })
            .slice(0, 10)
            .map((v) => ({
                vendor: v.vendor,
                amounts: v.amounts, // Return breakdown
                transactionCount: v.transactionCount,
                // percentage: ... hard to calculate with mixed currencies
            }));

        // Expenses by category from analysis
        // Expenses by category from analysis
        const expensesByCategory = Object.entries(categoryBreakdown)
            .map(([category, amounts]) => ({
                category,
                amounts, // Record<string, number>
                // percentage: ...
            }))
            .sort((a, b) => {
                const totalA = Object.values(a.amounts).reduce((s, v) => s + v, 0);
                const totalB = Object.values(b.amounts).reduce((s, v) => s + v, 0);
                return totalB - totalA;
            });

        return NextResponse.json({
            period: {
                month: periodMonth,
                year: periodYear,
            },
            uploadStatus: {
                rho_bank: period?.rhoBankUploaded ?? false,
                rho_card: period?.rhoCardUploaded ?? false,
                mercury: period?.mercuryUploaded ?? false,
                paypal: period?.paypalUploaded ?? false,
                wise: period?.wiseUploaded ?? false,
                rbc_bank: period?.rbcBankUploaded ?? false,
                rbc_card: period?.rbcCardUploaded ?? false,
            },
            revenue,
            expenses,
            netCashFlow,
            reconciliationStatus: {
                totalRhoCardExpenses,
                reconciledRhoCardExpenses,
                reconciliationRate:
                    totalRhoCardExpenses > 0
                        ? (reconciledRhoCardExpenses / totalRhoCardExpenses) * 100
                        : 0,
                isComplete: period?.reconciliationCompleted ?? false,
            },
            topExpensesByVendor,
            expensesByCategory,
            transactionCounts: {
                total: transactions.length,
                income: transactions.filter((tx) => tx.transactionType === "income")
                    .length,
                expenses: transactions.filter((tx) => tx.transactionType === "expense")
                    .length,
                excluded: transactions.filter((tx) => tx.isExcluded).length,
            },
        });
    } catch (e) {
        console.error("Failed to fetch monthly summary:", e);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
