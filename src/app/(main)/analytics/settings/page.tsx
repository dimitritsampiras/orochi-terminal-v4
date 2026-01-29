import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/clients/db";
import { SettingsForm } from "../components/settings-form";

import { getRecurringExpenses } from "../components/actions";
import { RecurringExpensesForm } from "../components/recurring-expenses-form";

export default async function SettingsPage() {
    const settings = await db.query.globalSettings.findFirst();
    const recurringExpensesData = await getRecurringExpenses();

    const defaults = {
        // Per-item production costs
        inkCostPerItem: settings?.inkCostPerItem ?? 1.20,
        printerRepairCostPerItem: settings?.printerRepairCostPerItem ?? 0.45,
        pretreatCostPerItem: settings?.pretreatCostPerItem ?? 0.27,
        electricityCostPerItem: settings?.electricityCostPerItem ?? 0.24,
        neckLabelCostPerItem: settings?.neckLabelCostPerItem ?? 0.08,
        parchmentPaperCostPerItem: settings?.parchmentPaperCostPerItem ?? 0.06,

        // Per-order fulfillment costs
        thankYouCardCostPerOrder: settings?.thankYouCardCostPerOrder ?? 0.14,
        polymailerCostPerOrder: settings?.polymailerCostPerOrder ?? 0.09,
        cleaningSolutionCostPerOrder: settings?.cleaningSolutionCostPerOrder ?? 0.08,
        integratedPaperCostPerOrder: settings?.integratedPaperCostPerOrder ?? 0.06,
        blankPaperCostPerOrder: settings?.blankPaperCostPerOrder ?? 0.02,

        // Other settings
        supplementaryItemCost: settings?.supplementaryItemCost ?? 0,
        misprintCostMultiplier: settings?.misprintCostMultiplier ?? 1.0,
        costBufferPercentage: settings?.costBufferPercentage ?? 10.0,
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
