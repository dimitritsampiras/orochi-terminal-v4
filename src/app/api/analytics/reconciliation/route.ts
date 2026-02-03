import { db } from "@/lib/clients/db";
import { csvTransactions } from "@drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { reconcileRhoCardPayments } from "@/lib/core/csv-adapters/reconciliation";
import type { NormalizedTransaction } from "@/lib/types/csv-types";

/**
 * GET /api/analytics/reconciliation
 * Find reconciliation matches between Rho Card expenses and Mercury payments
 *
 * Query params: month, year
 *
 * Returns: Array of ReconciliationMatch objects with confidence scores
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

        // Fetch Rho Card transactions
        const rhoCardData = await db
            .select()
            .from(csvTransactions)
            .where(
                and(
                    eq(csvTransactions.periodMonth, periodMonth),
                    eq(csvTransactions.periodYear, periodYear),
                    eq(csvTransactions.source, "rho_credit_card"),
                    isNull(csvTransactions.deletedAt)
                )
            );

        // Fetch Mercury transactions
        const mercuryData = await db
            .select()
            .from(csvTransactions)
            .where(
                and(
                    eq(csvTransactions.periodMonth, periodMonth),
                    eq(csvTransactions.periodYear, periodYear),
                    eq(csvTransactions.source, "mercury"),
                    isNull(csvTransactions.deletedAt)
                )
            );

        // Convert database records to NormalizedTransaction format
        const rhoCardTransactions: NormalizedTransaction[] = rhoCardData.map((tx) => ({
            id: tx.id,
            date: new Date(tx.transactionDate),
            description: tx.description,
            amount: parseFloat(tx.amount),
            vendor: tx.vendor,
            currency: tx.currency,
            type: tx.transactionType as "income" | "expense" | "transfer",
            category: (tx.category || null) as NormalizedTransaction["category"],
            isExcluded: tx.isExcluded,
            isRecurring: tx.isRecurring,
            rawData: tx.rawCsvRow as Record<string, string>,
        }));

        const mercuryTransactions: NormalizedTransaction[] = mercuryData.map((tx) => ({
            id: tx.id,
            date: new Date(tx.transactionDate),
            description: tx.description,
            amount: parseFloat(tx.amount),
            vendor: tx.vendor,
            currency: tx.currency,
            type: tx.transactionType as "income" | "expense" | "transfer",
            category: (tx.category || null) as NormalizedTransaction["category"],
            isExcluded: tx.isExcluded,
            isRecurring: tx.isRecurring,
            rawData: tx.rawCsvRow as Record<string, string>,
        }));

        // Run reconciliation algorithm
        const matches = reconcileRhoCardPayments(
            rhoCardTransactions,
            mercuryTransactions
        );

        return NextResponse.json({
            matches,
            summary: {
                totalRhoCardTransactions: rhoCardTransactions.length,
                totalMercuryPayments: mercuryTransactions.filter(
                    (tx) =>
                        tx.vendor === "Rho Card Payment" ||
                        tx.category === "internal_transfer"
                ).length,
                matchedCount: matches.length,
                highConfidenceMatches: matches.filter((m) => m.confidence === "high")
                    .length,
                mediumConfidenceMatches: matches.filter(
                    (m) => m.confidence === "medium"
                ).length,
                lowConfidenceMatches: matches.filter((m) => m.confidence === "low")
                    .length,
            },
        });
    } catch (e) {
        console.error("Failed to find reconciliation matches:", e);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
