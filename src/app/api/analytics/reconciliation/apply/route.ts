import { db } from "@/lib/clients/db";
import { csvTransactions } from "@drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prepareReconciliationUpdates } from "@/lib/core/csv-adapters/reconciliation";
import type { ReconciliationMatch } from "@/lib/core/csv-adapters/reconciliation";

const applyReconciliationSchema = z.object({
    matches: z.array(
        z.object({
            rhoCardTransaction: z.object({
                id: z.string(),
            }),
            mercuryTransaction: z.object({
                id: z.string(),
            }),
            confidence: z.enum(["high", "medium", "low"]),
            amountDifference: z.number(),
            dateDifference: z.number(),
            reconciliationGroupId: z.string(),
        })
    ),
});

/**
 * POST /api/analytics/reconciliation/apply
 * Apply reconciliation matches by updating both Rho Card and Mercury transactions
 *
 * Body:
 * {
 *   matches: ReconciliationMatch[]
 * }
 *
 * Updates both transactions in each match with:
 * - Same reconciliation_group_id
 * - is_reconciled = true
 * - reconciled_at = now()
 * - reconciliation_notes with match details
 * - Mercury transfer marked as excluded (internal transfer)
 */
export async function POST(request: NextRequest) {
    try {
        const json = await request.json();
        const body = applyReconciliationSchema.parse(json);

        const { matches } = body;

        if (matches.length === 0) {
            return NextResponse.json(
                { error: "No matches provided" },
                { status: 400 }
            );
        }

        // Prepare updates using the reconciliation helper function
        const { updates } = prepareReconciliationUpdates(
            matches as ReconciliationMatch[]
        );

        // Apply all updates in a transaction
        const results = await db.transaction(async (tx) => {
            const updatedTransactions = [];

            for (const update of updates) {
                const [updated] = await tx
                    .update(csvTransactions)
                    .set({
                        reconciliationGroupId: update.reconciliation_group_id,
                        isReconciled: update.is_reconciled,
                        reconciledAt: sql`now()`,
                        reconciliationNotes: update.reconciliation_notes,
                        lastModifiedAt: sql`now()`,
                        // Mark Mercury transfers as excluded (internal transfer)
                        isExcluded: sql`CASE
                            WHEN source = 'mercury' AND vendor = 'Rho Card Payment' THEN true
                            ELSE is_excluded
                        END`,
                    })
                    .where(eq(csvTransactions.id, update.id))
                    .returning();

                if (updated) {
                    updatedTransactions.push(updated);
                }
            }

            return updatedTransactions;
        });

        return NextResponse.json({
            success: true,
            updatedCount: results.length,
            matchesApplied: matches.length,
            message: `Successfully applied ${matches.length} reconciliation matches (${results.length} transactions updated)`,
        });
    } catch (e) {
        if (e instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: e.issues },
                { status: 400 }
            );
        }
        console.error("Failed to apply reconciliation matches:", e);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
