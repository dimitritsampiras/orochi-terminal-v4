
import { db } from "@/lib/clients/db";
import { warehouseExpenses } from "@drizzle/schema";
import { desc, eq } from "drizzle-orm";

async function verifyRent() {
    console.log("Verifying Rent Calculation...");

    const rentExpenses = await db
        .select({
            amount: warehouseExpenses.amount,
            date: warehouseExpenses.date
        })
        .from(warehouseExpenses)
        .where(eq(warehouseExpenses.category, "rent"))
        .orderBy(desc(warehouseExpenses.date))
        .limit(1);

    console.log("Rent Expenses Found:", rentExpenses);

    const monthlyRent = rentExpenses.length > 0 ? Number(rentExpenses[0].amount) : 2215;
    console.log("Monthly Rent Used:", monthlyRent);

    const weeklyRent = (monthlyRent * 12) / 52;
    console.log("Weekly Rent Calculated:", weeklyRent.toFixed(2));
}

verifyRent().catch(console.error).finally(() => process.exit());
