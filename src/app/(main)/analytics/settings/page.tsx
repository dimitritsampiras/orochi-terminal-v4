import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/clients/db";
import { SettingsForm } from "../components/settings-form";

import { getRecurringExpenses } from "../components/actions";
import { RecurringExpensesForm } from "../components/recurring-expenses-form";

export default async function SettingsPage() {
    const settings = await db.query.globalSettings.findFirst();
    const recurringExpensesData = await getRecurringExpenses();

    const defaults = {
        inkCostPerPrint: settings?.inkCostPerPrint ?? 0,
        bagCostPerOrder: settings?.bagCostPerOrder ?? 0,
        labelCostPerOrder: settings?.labelCostPerOrder ?? 0,
        misprintCostMultiplier: settings?.misprintCostMultiplier ?? 1.0,
        supplementaryItemCost: settings?.supplementaryItemCost ?? 0,
        inkCostPerDesign: settings?.inkCostPerDesign ?? 2.5,
    };

    return (
        <div className="max-w-4xl space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Global Cost Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <SettingsForm defaultValues={defaults} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Recurring Expenses (Salaries, Rent)</CardTitle>
                </CardHeader>
                <CardContent>
                    <RecurringExpensesForm existingExpenses={recurringExpensesData} />
                </CardContent>
            </Card>
        </div>
    )
}
