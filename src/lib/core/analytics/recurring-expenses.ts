import { db } from "@/lib/clients/db";
import { recurringExpenses } from "@drizzle/schema";
import { and, lte, gte, isNull, or, desc } from "drizzle-orm";
import { addDays, differenceInDays, isAfter, isBefore, max, min, startOfDay, endOfDay } from "date-fns";

export type RecurringExpenseAllocation = {
    expenseId: string;
    name: string;
    allocatedAmount: number;
    dailyCost: number;
    daysAllocated: number;
};

export async function calculateRecurringExpenses(
    startDate: Date,
    endDate: Date,
    excludedCategories: string[] = []
): Promise<{ total: number; breakdown: RecurringExpenseAllocation[] }> {
    // 1. Fetch active recurring expenses that overlap with the period
    // Overlap condition: expense.startDate <= range.endDate AND (expense.endDate >= range.startDate OR expense.endDate IS NULL)
    const expenses = await db
        .select()
        .from(recurringExpenses)
        .where(
            and(
                eq(recurringExpenses.active, true),
                lte(recurringExpenses.startDate, endDate),
                or(
                    gte(recurringExpenses.endDate, startDate),
                    isNull(recurringExpenses.endDate)
                )
            )
        );

    let total = 0;
    const breakdown: RecurringExpenseAllocation[] = [];

    for (const expense of expenses) {
        // Skip if category is excluded (manual override exists)
        if (excludedCategories.includes(expense.category)) continue;

        // Calculate Daily Cost
        let dailyCost = 0;
        switch (expense.frequency) {
            case "weekly":
                dailyCost = expense.amount / 7;
                break;
            case "monthly":
                dailyCost = (expense.amount * 12) / 365;
                break;
            case "yearly":
                dailyCost = expense.amount / 365;
                break;
        }

        // Determine Overlap Period
        // Effective Start: Max(RangeStart, ExpenseStart)
        const effectiveStart = max([startDate, expense.startDate]);

        // Effective End: Min(RangeEnd, ExpenseEnd | Infinity)
        // If expense.endDate is null, use endDate of the range
        const effectiveEnd = expense.endDate ? min([endDate, expense.endDate]) : endDate;

        // If effective start is after effective end, no overlap (should be handled by query, but double check)
        if (isAfter(effectiveStart, effectiveEnd)) continue;

        // Calculate Days (inclusive)
        const days = differenceInDays(effectiveEnd, effectiveStart) + 1;

        // Ensure days is effectively at least 0 (differenceInDays can be 0 if same day, +1 makes it 1)
        // Wait, differenceInDays returns full days. differenceInCalendarDays might be safer? 
        // Let's rely on standard logic: (end - start) in ms / using diffInDays.
        // E.g. Jan 1 to Jan 2 is 1 day diff? But we want inclusive coverage?
        // Usually if I ask for Jan 1 to Jan 1, that's 1 day of rent.
        // differenceInDays(Jan 1, Jan 1) is 0. So +1 is correct for inclusive daily range.

        const allocatedAmount = dailyCost * days;

        total += allocatedAmount;
        breakdown.push({
            expenseId: expense.id,
            name: expense.name,
            allocatedAmount,
            dailyCost,
            daysAllocated: days
        });
    }

    return { total, breakdown };
}

// Helper for Drizzle EQ import (was missing in standard imports above)
import { eq } from "drizzle-orm";
