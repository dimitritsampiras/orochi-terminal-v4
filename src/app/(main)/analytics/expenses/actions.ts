"use server";

import { db } from "@/lib/clients/db";
import { warehouseExpenses } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteExpense(id: string) {
    await db.delete(warehouseExpenses).where(eq(warehouseExpenses.id, id));
    revalidatePath("/analytics/expenses");
    revalidatePath("/analytics");
}
