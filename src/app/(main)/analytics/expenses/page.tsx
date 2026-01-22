import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/clients/db";
import { warehouseExpenses } from "@drizzle/schema";
import { desc } from "drizzle-orm";
import { ExpenseForm } from "../components/expense-form";
import { Separator } from "@/components/ui/separator";
import { DeleteExpenseButton } from "./expense-actions";

export default async function ExpensesPage() {
    const expenses = await db.select()
        .from(warehouseExpenses)
        .orderBy(desc(warehouseExpenses.date))
        .limit(100);

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <div>
                <Card>
                    <CardHeader>
                        <CardTitle>Add New Expense</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ExpenseForm />
                    </CardContent>
                </Card>
            </div>

            <div>
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {expenses.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No expenses found.</p>
                            ) : (
                                expenses.map(expense => (
                                    <div key={expense.id} className="flex flex-col gap-1 pb-4 border-b last:border-0 last:pb-0">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col">
                                                <span className="font-medium capitalize">{expense.category.replace('_', ' ')}</span>
                                                <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                                                    <span>
                                                        {expense.periodStart && expense.periodEnd ? (
                                                            <>{new Date(expense.periodStart).toLocaleDateString()} - {new Date(expense.periodEnd).toLocaleDateString()}</>
                                                        ) : (
                                                            new Date(expense.date).toLocaleDateString()
                                                        )}
                                                    </span>
                                                    {expense.batchId && <span>• Batch #{expense.batchId}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-bold">${expense.amount.toFixed(2)}</span>
                                                <DeleteExpenseButton id={expense.id} />
                                            </div>
                                        </div>
                                        {expense.notes && <p className="text-sm text-muted-foreground">{expense.notes}</p>}
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
