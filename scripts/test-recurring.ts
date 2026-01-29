import "dotenv/config";
import { calculateRecurringExpenses } from "../src/lib/core/analytics/recurring-expenses";
import { db } from "../src/lib/clients/db";
import { recurringExpenses } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("--- Testing Recurring Expenses Logic ---");

    // 1. Create a dummy monthly rent expense
    const testId = "test-rent-" + Date.now();
    await db.insert(recurringExpenses).values({
        name: "Test Rent",
        amount: 3000, // $3000/month ~= $98.63/day
        frequency: "monthly",
        startDate: new Date("2024-01-01"),
        active: true
    });

    console.log("Created test expense: $3000/month");

    // 2. Calculate for a single day (Jan 15, 2024)
    const start = new Date("2024-01-15");
    const end = new Date("2024-01-15");

    const result = await calculateRecurringExpenses(start, end);

    console.log("Calculation for single day:");
    console.log("Total Allocated:", result.total);
    console.log("Breakdown:", result.breakdown);

    // Expected: ~98.63
    const expected = (3000 * 12) / 365;
    console.log(`Expected daily: ${expected.toFixed(4)}`);

    if (Math.abs(result.total - expected) < 0.01) {
        console.log("SUCCESS: Daily allocation matches expectation.");
    } else {
        console.error("FAILURE: Allocation mismatch.");
    }

    // 3. Clean up
    await db.delete(recurringExpenses).where(eq(recurringExpenses.name, "Test Rent"));
    console.log("Cleaned up.");
}

main().catch(console.error);
