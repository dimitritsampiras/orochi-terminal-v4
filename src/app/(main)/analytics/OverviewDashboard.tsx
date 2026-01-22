"use client";

import { useState, useEffect, useTransition } from "react";
import { fetchDashboardFinancials, DashboardFinancials } from "@/app/(main)/analytics/actions/financial-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Loader2, Info } from "lucide-react";

export function OverviewDashboard() {
    const [range, setRange] = useState("30d");
    const [data, setData] = useState<DashboardFinancials | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        fetchData(range);
    }, [range]);

    function fetchData(selectedRange: string) {
        startTransition(async () => {
            const now = new Date();
            let from = subDays(now, 30);
            let to = now;

            if (selectedRange === "30d") {
                from = subDays(now, 30);
            } else if (selectedRange === "90d") {
                from = subDays(now, 90);
            } else if (selectedRange === "month") {
                from = startOfMonth(now);
                to = endOfMonth(now);
            } else if (selectedRange === "last_month") {
                const lastMonth = subMonths(now, 1);
                from = startOfMonth(lastMonth);
                to = endOfMonth(lastMonth);
            }

            try {
                // Use new Time-Based Financial Action
                const result = await fetchDashboardFinancials(from, to);
                setData(result);
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            }
        });
    }

    if (!data && isPending) {
        return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    }

    if (!data) return <div>No data available.</div>;

    const { summary, chartData } = data;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
                    <p className="text-sm text-muted-foreground">
                        Financials based on {summary.metrics.itemCount} items across {summary.metrics.orderCount} orders.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={range} onValueChange={setRange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="30d">Last 30 Days</SelectItem>
                            <SelectItem value="90d">Last 90 Days</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="last_month">Last Month</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${summary.revenue.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${summary.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ${summary.netProfit.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {summary.revenue > 0 ? ((summary.netProfit / summary.revenue) * 100).toFixed(1) : 0}% Margin
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">${summary.totalExpenses.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Data Source</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-1">
                            <div className="text-xs flex items-center gap-1">
                                Labor: <span className={summary.metrics.isLaborExtrapolated ? "text-amber-500 font-bold" : "text-green-600"}>
                                    {summary.metrics.isLaborExtrapolated ? "Extrapolated" : "Actual"}
                                </span>
                            </div>
                            <div className="text-xs flex items-center gap-1">
                                Ops: <span className={summary.metrics.isRentExtrapolated ? "text-amber-500 font-bold" : "text-green-600"}>
                                    {summary.metrics.isRentExtrapolated ? "Extrapolated" : "Actual"}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-1">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Profitability Over Time</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                    <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" name="Net Profit" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Stats */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Cost Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-muted/30 p-2 rounded-sm">
                                <div>
                                    <h4 className="font-semibold">Shipping</h4>
                                    <p className="text-xs text-muted-foreground">Avg: ${summary.shippingBreakdown.avgCost.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">${summary.shippingCost.toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex justify-between p-1 bg-muted/20"><span>Domestic</span><span>${summary.shippingBreakdown.domestic.avg.toFixed(2)} avg</span></div>
                                <div className="flex justify-between p-1 bg-muted/20"><span>International</span><span>${summary.shippingBreakdown.row.avg.toFixed(2)} avg</span></div>
                            </div>

                            <div className="flex justify-between border-t pt-2">
                                <span>Blanks (Customs Value)</span>
                                <span>${summary.blanksCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Ink (${(summary.inkCost / summary.metrics.itemCount || 0).toFixed(2)}/item*)</span>
                                <span>${summary.inkCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Supplies (Bags/Labels)</span>
                                <span>${summary.suppliesCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span>Labor</span>
                                <span className={summary.metrics.isLaborExtrapolated ? "text-amber-600" : ""}>
                                    ${summary.laborCost.toFixed(2)}
                                    {summary.metrics.isLaborExtrapolated && "*"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Rent & Ops</span>
                                <span className={summary.metrics.isRentExtrapolated ? "text-amber-600" : ""}>
                                    ${summary.recurringCosts.rent.toFixed(2)}
                                    {summary.metrics.isRentExtrapolated && "*"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Marketing</span>
                                <span className={summary.metrics.isMarketingExtrapolated ? "text-amber-600" : ""}>
                                    ${summary.recurringCosts.marketing.toFixed(2)}
                                    {summary.metrics.isMarketingExtrapolated && "*"}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Fulfilment Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Orders</p>
                                <div className="text-2xl font-bold">{summary.metrics.orderCount}</div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Line Items</p>
                                <div className="text-2xl font-bold">{summary.metrics.itemCount}</div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Forecasted Work</p>
                                <div className="text-2xl font-bold">{Math.ceil(summary.forecastedWorkDays)} Days</div>
                                <p className="text-xs text-muted-foreground">to fulfill current volume</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="mb-2 text-sm font-medium">Shipping Density</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>🇺🇸 US</span> <span>{summary.shippingBreakdown.domestic.count}</span></div>
                                <div className="flex justify-between"><span>🇨🇦 CA</span> <span>{summary.shippingBreakdown.ca.count}</span></div>
                                <div className="flex justify-between"><span>🇬🇧 UK</span> <span>{summary.shippingBreakdown.uk.count}</span></div>
                                <div className="flex justify-between"><span>🇩🇪 DE</span> <span>{summary.shippingBreakdown.de.count}</span></div>
                                <div className="flex justify-between"><span>🇦🇺 AU</span> <span>{summary.shippingBreakdown.au.count}</span></div>
                                <div className="flex justify-between"><span>🌍 ROW</span> <span>{summary.shippingBreakdown.row.count}</span></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
