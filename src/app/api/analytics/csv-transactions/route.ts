import { db } from "@/lib/clients/db";
import { csvTransactions, monthlyPeriods } from "@drizzle/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { NormalizedTransaction } from "@/lib/types/csv-types";

const uploadSchema = z.object({
    periodMonth: z.number().min(1).max(12),
    periodYear: z.number().min(2020).max(2100),
    source: z.enum(["rho_bank", "rho_credit_card", "mercury", "paypal", "wise", "rbc_bank", "rbc_card"]),
    transactions: z.array(z.object({
        id: z.string(),
        date: z.date().or(z.string().transform((str) => new Date(str))),
        description: z.string(),
        amount: z.number(),
        currency: z.string().default('USD'),
        vendor: z.string(),
        type: z.enum(["income", "expense", "transfer"]),
        category: z.string().nullable().optional(),
        isExcluded: z.boolean().optional(),
        isRecurring: z.boolean().optional(),
        rawData: z.record(z.string(), z.any()).optional(),
    })),
    replace: z.boolean().optional().default(false),
});

/**
 * GET /api/analytics/csv-transactions
 * Fetch CSV transactions for a given period and/or source
 * Query params: month, year, source
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const source = searchParams.get("source");

    try {
        const conditions = [isNull(csvTransactions.deletedAt)];

        if (month) {
            conditions.push(eq(csvTransactions.periodMonth, parseInt(month)));
        }
        if (year) {
            conditions.push(eq(csvTransactions.periodYear, parseInt(year)));
        }
        if (source) {
            conditions.push(eq(csvTransactions.source, source as any));
        }

        const data = await db
            .select()
            .from(csvTransactions)
            .where(and(...conditions))
            .orderBy(csvTransactions.transactionDate);

        return NextResponse.json(data);
    } catch (e) {
        console.error("Failed to fetch CSV transactions:", e);
        return NextResponse.json(
            { error: "Failed to fetch CSV transactions" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/analytics/csv-transactions
 * Upload CSV transactions for a given period and source
 *
 * Body:
 * {
 *   periodMonth: number,
 *   periodYear: number,
 *   source: 'rho_bank' | 'rho_credit_card' | 'mercury' | 'paypal',
 *   transactions: NormalizedTransaction[],
 *   replace: boolean (optional, default false)
 * }
 *
 * NON-DESTRUCTIVE: If replace=true, soft-deletes existing transactions for this period/source
 * by setting deleted_at timestamp. All data is preserved for audit trail.
 */
export async function POST(request: NextRequest) {
    try {
        const json = await request.json();
        const body = uploadSchema.parse(json);

        const { periodMonth, periodYear, source, transactions: rawTransactions, replace } = body;

        // Deduplicate transactions by ID to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const uniqueTransactionsMap = new Map();
        for (const tx of rawTransactions) {
            uniqueTransactionsMap.set(tx.id, tx);
        }
        const transactions = Array.from(uniqueTransactionsMap.values());

        // Check for existing transactions for this period/source
        const existingTransactions = await db
            .select()
            .from(csvTransactions)
            .where(
                and(
                    eq(csvTransactions.periodMonth, periodMonth),
                    eq(csvTransactions.periodYear, periodYear),
                    eq(csvTransactions.source, source),
                    isNull(csvTransactions.deletedAt)
                )
            );

        // We allow merging (upsert) by default now, so strictly blocking is removed.
        // If replace=true, we soft-delete old ones first. If replace=false, we just upsert/merge.

        if (existingTransactions.length > 0 && !replace) {
            return NextResponse.json(
                {
                    error: "Transactions already exist for this period and source",
                    existingCount: existingTransactions.length,
                    message: "Set replace=true to archive existing data and upload new transactions",
                },
                { status: 409 }
            );
        }

        // Soft-delete existing transactions if replace=true
        if (existingTransactions.length > 0 && replace) {
            await db
                .update(csvTransactions)
                .set({
                    deletedAt: sql`now()`,
                    // Note: deletedBy would be set here if we had auth context
                    lastModifiedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(csvTransactions.periodMonth, periodMonth),
                        eq(csvTransactions.periodYear, periodYear),
                        eq(csvTransactions.source, source),
                        isNull(csvTransactions.deletedAt)
                    )
                );
        }

        // Insert new transactions
        if (transactions.length === 0) {
            return NextResponse.json({
                success: true,
                inserted: 0,
                archived: existingTransactions.length,
                message: "No new transactions to insert"
            });
        }

        const insertedTransactions = await db
            .insert(csvTransactions)
            .values(
                transactions.map((tx) => ({
                    periodMonth,
                    periodYear,
                    source,
                    sourceTransactionId: tx.id,
                    transactionDate: tx.date instanceof Date ? tx.date : new Date(tx.date),
                    description: tx.description,
                    vendor: tx.vendor,
                    amount: tx.amount.toString(),
                    currency: tx.currency || 'USD',
                    transactionType: tx.type as any, // Cast to match enum
                    category: (tx.category || null) as any, // Cast to match enum
                    isExcluded: tx.isExcluded ?? false,
                    isRecurring: tx.isRecurring ?? false,
                    rawCsvRow: tx.rawData || {},
                    // Note: uploadedBy would be set here if we had auth context
                }))
            )
            .onConflictDoUpdate({
                target: [csvTransactions.source, csvTransactions.sourceTransactionId, csvTransactions.periodYear, csvTransactions.periodMonth],
                set: {
                    transactionDate: sql`excluded.transaction_date`,
                    description: sql`excluded.description`,
                    vendor: sql`excluded.vendor`,
                    amount: sql`excluded.amount`,
                    currency: sql`excluded.currency`,
                    transactionType: sql`excluded.transaction_type`,
                    category: sql`excluded.category`,
                    isExcluded: sql`excluded.is_excluded`,
                    isRecurring: sql`excluded.is_recurring`,
                    rawCsvRow: sql`excluded.raw_csv_row`,
                    deletedAt: null, // "Undelete" if it was soft-deleted
                    lastModifiedAt: sql`now()`,
                }
            })
            .returning();

        // Update monthly_periods table (upsert pattern)
        const sourceFieldMap = {
            rho_bank: "rhoBankUploaded",
            rho_credit_card: "rhoCardUploaded",
            mercury: "mercuryUploaded",
            paypal: "paypalUploaded",
            wise: "wiseUploaded",
            rbc_bank: "rbcBankUploaded",
            rbc_card: "rbcCardUploaded",
        } as const;

        const sourceField = sourceFieldMap[source];

        // Check if period exists
        const existingPeriod = await db
            .select()
            .from(monthlyPeriods)
            .where(
                and(
                    eq(monthlyPeriods.periodMonth, periodMonth),
                    eq(monthlyPeriods.periodYear, periodYear)
                )
            );

        if (existingPeriod.length > 0) {
            // Update existing period
            await db
                .update(monthlyPeriods)
                .set({
                    [sourceField]: true,
                    lastModifiedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(monthlyPeriods.periodMonth, periodMonth),
                        eq(monthlyPeriods.periodYear, periodYear)
                    )
                );
        } else {
            // Insert new period
            await db.insert(monthlyPeriods).values({
                periodMonth,
                periodYear,
                [sourceField]: true,
            });
        }

        return NextResponse.json({
            success: true,
            inserted: insertedTransactions.length,
            archived: existingTransactions.length,
            message:
                existingTransactions.length > 0
                    ? `Archived ${existingTransactions.length} existing transactions and inserted ${insertedTransactions.length} new transactions`
                    : `Inserted ${insertedTransactions.length} transactions`,
        });
    } catch (e) {
        if (e instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: e.issues },
                { status: 400 }
            );
        }
        console.error("Failed to upload CSV transactions:", e);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/analytics/csv-transactions
 * Clear all transactions for a specific month and year
 */
export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    if (!month || !year) {
        return NextResponse.json(
            { error: "Month and year are required" },
            { status: 400 }
        );
    }

    try {
        const periodMonth = parseInt(month);
        const periodYear = parseInt(year);

        // Soft-delete transactions
        await db
            .update(csvTransactions)
            .set({
                deletedAt: sql`now()`,
                lastModifiedAt: sql`now()`,
            })
            .where(
                and(
                    eq(csvTransactions.periodMonth, periodMonth),
                    eq(csvTransactions.periodYear, periodYear),
                    isNull(csvTransactions.deletedAt)
                )
            );

        // Reset upload flags in monthlyPeriods
        await db
            .update(monthlyPeriods)
            .set({
                rhoBankUploaded: false,
                rhoCardUploaded: false,
                mercuryUploaded: false,
                paypalUploaded: false,
                wiseUploaded: false,
                rbcBankUploaded: false,
                rbcCardUploaded: false,
                lastModifiedAt: sql`now()`,
            })
            .where(
                and(
                    eq(monthlyPeriods.periodMonth, periodMonth),
                    eq(monthlyPeriods.periodYear, periodYear)
                )
            );

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Failed to clear transactions:", e);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
/**
 * PATCH /api/analytics/csv-transactions
 * Bulk update transactions
 *
 * Body:
 * {
 *   transactionIds: string[],
 *   updates: {
 *     category?: string | null,
 *     isExcluded?: boolean,
 *     isRecurring?: boolean
 *   }
 * }
 */
export async function PATCH(request: NextRequest) {
    try {
        const json = await request.json();
        const schema = z.object({
            transactionIds: z.array(z.string()),
            updates: z.object({
                category: z.string().nullable().optional(),
                isExcluded: z.boolean().optional(),
                isRecurring: z.boolean().optional(),
            }),
        });

        const { transactionIds, updates } = schema.parse(json);

        if (transactionIds.length === 0) {
            return NextResponse.json({ updated: 0 });
        }

        const updateData: any = {
            lastModifiedAt: sql`now()`,
        };

        if (updates.category !== undefined) {
            updateData.category = updates.category;
        }
        if (updates.isExcluded !== undefined) {
            updateData.isExcluded = updates.isExcluded;
        }
        if (updates.isRecurring !== undefined) {
            updateData.isRecurring = updates.isRecurring;
        }

        const updated = await db
            .update(csvTransactions)
            .set(updateData)
            .where(sql`${csvTransactions.id} IN ${transactionIds}`)
            .returning();

        return NextResponse.json({
            success: true,
            updatedCount: updated.length,
            updatedIds: updated.map(t => t.id)
        });
    } catch (e) {
        if (e instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: e.issues },
                { status: 400 }
            );
        }
        console.error("Failed to bulk update transactions:", e);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
