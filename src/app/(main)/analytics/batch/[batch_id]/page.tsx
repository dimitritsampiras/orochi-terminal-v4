import { calculateBatchProfitability } from "@/lib/core/analytics/calculate-batch-profitability";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CostBreakdownChart } from "../../components/profitability-charts";
import { Separator } from "@/components/ui/separator";

export default async function BatchProfitabilityPage({
    params,
}: {
    params: Promise<{ batch_id: string }>;
}) {
    const { batch_id } = await params;
    const batchId = parseInt(batch_id, 10);

    if (isNaN(batchId)) notFound();

    const data = await calculateBatchProfitability(batchId);

    if (!data) notFound();

    const { revenue, costs, profit, metrics, expenses } = data;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Batch #{batchId} Profitability</h2>
                <div className="text-sm text-muted-foreground">
                    {metrics.totalOrders} Orders • {metrics.totalItems} Items
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-background to-secondary/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            ${revenue.netSales.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Sales: ${revenue.totalSales.toFixed(2)} - Refunds: ${revenue.totalRefunds.toFixed(2)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500 bg-gradient-to-br from-background to-secondary/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Costs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                            ${costs.total.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Across all categories
                        </p>
                    </CardContent>
                </Card>

                <Card className={`border-l-4 ${profit.net >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'} bg-gradient-to-br from-background to-secondary/10`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${profit.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            ${profit.net.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Margin: {profit.margin.toFixed(1)}%
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-background to-secondary/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Fulfillment Pace</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {metrics.daysToFulfill.toFixed(1)} Days
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Avg time to fulfill
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <CostBreakdownChart costs={{
                        shipping: costs.shipping,
                        blanks: costs.blanks,
                        inkAndSupplies: costs.inkAndSupplies,
                        expenses: expenses.total
                    }} />
                </div>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Detailed Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold mb-2">Costs</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Shipping</span>
                                            <span>${costs.shipping.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Blanks</span>
                                            <span>${costs.blanks.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Ink & Supplies</span>
                                            <span>${costs.inkAndSupplies.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between font-medium pt-2 border-t">
                                            <span>Allocated Expenses</span>
                                            <span>${expenses.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Metrics</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Total Items</span>
                                            <span>{metrics.totalItems}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Man Hours (Est)</span>
                                            <span>{metrics.manHours.toFixed(1)}h</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <h4 className="font-semibold mb-2">Expenses Breakdown</h4>
                                {expenses.breakdown.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No manual expenses added for this batch.</p>
                                ) : (
                                    <div className="space-y-2 text-sm">
                                        {expenses.breakdown.map((e, i) => (
                                            <div key={i} className="flex justify-between">
                                                <span className="capitalize">{e.category.replace('_', ' ')}</span>
                                                <span>${e.amount.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
