"use server";

import { db } from "@/lib/clients/db";
import { recurringExpenses } from "@drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type RecurringExpense = {
    id: string;
    name: string;
    amount: number;
    frequency: "weekly" | "monthly" | "yearly";
    category: "rent" | "salary" | "marketing_meta" | "marketing_google" | "sponsorship" | "other";
    active: boolean;
    startDate: Date;
    endDate: Date | null;
};

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
    const expenses = await db
        .select()
        .from(recurringExpenses)
        .where(eq(recurringExpenses.active, true))
        .orderBy(desc(recurringExpenses.createdAt));

    return expenses as RecurringExpense[];
}

export async function addRecurringExpense(data: {
    name: string;
    amount: number;
    frequency: "weekly" | "monthly" | "yearly";
    category: "rent" | "salary" | "marketing_meta" | "marketing_google" | "sponsorship" | "other";
    startDate: Date;
}): Promise<RecurringExpense> {
    const [newExpense] = await db
        .insert(recurringExpenses)
        .values({
            name: data.name,
            amount: data.amount,
            frequency: data.frequency,
            category: data.category,
            startDate: data.startDate,
            active: true,
        })
        .returning();

    revalidatePath("/analytics/settings");
    revalidatePath("/analytics");
    return newExpense as RecurringExpense;
}

export async function deleteRecurringExpense(id: string): Promise<void> {
    // Soft delete or hard delete? Let's hard delete for simplicity for now, 
    // or set active=false and endDate=now if we want to preserve history properly.
    // For specific requirement "input data for my salaries... ensure I can input... extrapolate",
    // simple deletion is risky if it affects past reports (history rewriting).
    // Better to set active=false and endDate=now.

    await db
        .update(recurringExpenses)
        .set({
            active: false,
            endDate: new Date(),
        })
        .where(eq(recurringExpenses.id, id));

    revalidatePath("/analytics/settings");
    revalidatePath("/analytics");
}
