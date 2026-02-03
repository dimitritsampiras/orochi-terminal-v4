import { db } from "@/lib/clients/db";
import { warehouseExpenses } from "@drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const expenseSchema = z.object({
    category: z.enum(["rent", "salary", "marketing_meta", "marketing_google", "sponsorship", "other"]),
    amount: z.number().positive(),
    date: z.string().transform((str) => new Date(str)),
    notes: z.string().optional(),
    batchId: z.number().optional(),
    periodStart: z.string().optional().transform((str) => str ? new Date(str) : null),
    periodEnd: z.string().optional().transform((str) => str ? new Date(str) : null),
});

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get("batch_id");

    try {
        if (batchId) {
            const data = await db.select()
                .from(warehouseExpenses)
                .where(eq(warehouseExpenses.batchId, parseInt(batchId)))
                .orderBy(desc(warehouseExpenses.date));
            return NextResponse.json(data);
        }

        const data = await db.select()
            .from(warehouseExpenses)
            .orderBy(desc(warehouseExpenses.date));
        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const json = await request.json();
        const body = expenseSchema.parse(json);

        const [newExpense] = await db.insert(warehouseExpenses).values({
            category: body.category,
            amount: body.amount,
            date: body.date,
            notes: body.notes,
            batchId: body.batchId,
            periodStart: body.periodStart,
            periodEnd: body.periodEnd,
        }).returning();

        return NextResponse.json(newExpense);
    } catch (e) {
        if (e instanceof z.ZodError) {
            return NextResponse.json({ error: e.issues }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
