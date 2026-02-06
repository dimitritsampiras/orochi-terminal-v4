import { db } from "@/lib/clients/db";
import { csvTransactions } from "@drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
    category: z.string().nullable().optional(),
    isExcluded: z.boolean().optional(),
    isRecurring: z.boolean().optional(),
});

/**
 * PATCH /api/analytics/csv-transactions/[id]
 * Update a single CSV transaction (for inline editing)
 *
 * Body:
 * {
 *   category?: string | null,
 *   isExcluded?: boolean,
 *   isRecurring?: boolean
 * }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // It's a Promise now
) {
    try {
        const { id } = await params;
        const json = await request.json();
        const body = updateSchema.parse(json);

        const updateData: any = {
            lastModifiedAt: sql`now()`,
        };

        if (body.category !== undefined) {
            updateData.category = body.category;
        }
        if (body.isExcluded !== undefined) {
            updateData.isExcluded = body.isExcluded;
        }
        if (body.isRecurring !== undefined) {
            updateData.isRecurring = body.isRecurring;
        }

        const [updatedTransaction] = await db
            .update(csvTransactions)
            .set(updateData)
            .where(eq(csvTransactions.id, id))
            .returning();

        if (!updatedTransaction) {
            return NextResponse.json(
                { error: "Transaction not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(updatedTransaction);
    } catch (e) {
        if (e instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: e.issues },
                { status: 400 }
            );
        }
        console.error("Failed to update CSV transaction:", e);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
