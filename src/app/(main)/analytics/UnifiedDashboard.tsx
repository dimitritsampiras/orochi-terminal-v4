"use client";

import { useState, useEffect, useTransition } from "react";
import { fetchUnifiedAnalytics, UnifiedAnalyticsSummary, AnalyticsMode, GarmentBreakdown } from "@/app/(main)/analytics/actions/financial-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { subDays, subMonths, format } from "date-fns";
import { startOfMonthEastern, endOfMonthEastern, nowInEastern } from "@/lib/utils";
import { Loader2, CalendarClock, TrendingUp, DollarSign, Package, Truck, CreditCard, ShoppingBag, Settings2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function UnifiedDashboard() {
    const [mode, setMode] = useState<AnalyticsMode>("outstanding");
    const [range, setRange] = useState("30d");
    const [data, setData] = useState<UnifiedAnalyticsSummary | null>(null);
    const [isPending, startTransition] = useTransition();

    // Moved these to top level to avoid "Rendered more hooks than during the previous render" error
    const [liveShippingProgress, setLiveShippingProgress] = useState<{ processed: number; total: number; currentCost: number } | null>(null);
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

    // Expense filter state - which expenses to include in "Coming Up Expenses"
    const [includedExpenses, setIncludedExpenses] = useState({
        blanks: true,
        ink: true,
        supplies: true,
        shipping: true,
        labor: true,
        rent: true,
    });

    useEffect(() => {
        fetchData();
    }, [mode, range]);

    function fetchData() {
        startTransition(async () => {
            const now = nowInEastern();
            let from: Date | undefined;
            let to: Date | undefined;

            if (mode === "time-based") {
                to = now;
                if (range === "30d") from = subDays(now, 30);
                else if (range === "90d") from = subDays(now, 90);
                else if (range === "month") {
                    from = startOfMonthEastern(now);
                    to = endOfMonthEastern(now);
                } else if (range === "last_month") {
                    const lastMonth = subMonths(now, 1);
                    from = startOfMonthEastern(lastMonth);
                    to = endOfMonthEastern(lastMonth);
                }
            }

            try {
                const result = await fetchUnifiedAnalytics(mode, from, to);
                setData(result);
            } catch (err) {
                console.error("Failed to fetch unified analytics", err);
            }
        });
    }

    function calculateLiveRates() {
        setIsCalculatingShipping(true);
        setLiveShippingProgress({ processed: 0, total: 0, currentCost: 0 });

        const eventSource = new EventSource("/api/analytics/queued");

        eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === "SHIPPING_PROGRESS") {
                    setLiveShippingProgress(payload.data);
                } else if (payload.type === "COMPLETE") {
                    eventSource.close();
                    setIsCalculatingShipping(false);
                }
            } catch (error) {
                console.error("Error parsing analytics stream", error);
            }
        };

        eventSource.onerror = (err) => {
            console.error("EventSource failed:", err);
            eventSource.close();
            setIsCalculatingShipping(false);
        };
    }

    if (!data && isPending) {
        return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    }

    if (!data) return <div>No data available.</div>;

    const { metrics, expenses, projections } = data;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Analytics Overview</h2>
                    <p className="text-2xl font-bold tracking-tight">
                        {mode === "outstanding"
                            ? "Projected Financials"
                            : "Historical Performance"}
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg">
                    <Tabs value={mode} onValueChange={(v) => {
                        setMode(v as AnalyticsMode);
                        setLiveShippingProgress(null); // Reset on mode switch
                    }} className="w-full">
                        <TabsList>
                            <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
                            <TabsTrigger value="time-based">Time-Based</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {mode === "time-based" && (
                        <Select value={range} onValueChange={setRange}>
                            <SelectTrigger className="w-[140px] bg-background">
                                <SelectValue placeholder="Range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30d">Last 30 Days</SelectItem>
                                <SelectItem value="90d">Last 90 Days</SelectItem>
                                <SelectItem value="month">This Month</SelectItem>
                                <SelectItem value="last_month">Last Month</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {/* Top Cards */}
            <div className={`grid gap-4 ${mode === "outstanding" ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-4"}`}>
                {/* Revenue - Only show in time-based mode */}
                {mode === "time-based" && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">${metrics.revenue.toFixed(2)}</div>
                            <p className="text-xs text-muted-foreground">
                                {metrics.orderCount} Orders / {metrics.itemCount} Items
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Net Profit - Only show in time-based mode */}
                {mode === "time-based" && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                            <TrendingUp className={`h-4 w-4 ${metrics.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${metrics.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                ${metrics.netProfit.toFixed(2)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {metrics.profitMargin.toFixed(1)}% Margin
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Expenses Card - Different calculation for outstanding vs time-based */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {mode === "outstanding" ? "Coming Up Expenses" : "Total Expenses"}
                        </CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold text-red-600">
                                ${mode === "outstanding"
                                    ? (
                                        // Coming Up Expenses: blanks + ink + supplies + shipping + labor + rent
                                        (includedExpenses.blanks ? expenses.cogs.blanks : 0) +
                                        (includedExpenses.ink ? expenses.cogs.ink : 0) +
                                        (includedExpenses.supplies ? expenses.cogs.supplies : 0) +
                                        (includedExpenses.shipping ? (liveShippingProgress ? liveShippingProgress.currentCost : expenses.operational.shipping) : 0) +
                                        (includedExpenses.labor ? expenses.operational.labor : 0) +
                                        (includedExpenses.rent ? expenses.fixed.rent : 0)
                                    ).toFixed(2)
                                    : metrics.totalExpenses.toFixed(2)
                                }
                            </div>
                            {mode === "outstanding" && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Settings2 className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72" align="end">
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-medium text-sm mb-3">Include in Total</h4>
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id="blanks"
                                                            checked={includedExpenses.blanks}
                                                            onCheckedChange={(checked) =>
                                                                setIncludedExpenses({ ...includedExpenses, blanks: checked === true })
                                                            }
                                                        />
                                                        <label htmlFor="blanks" className="text-sm font-medium cursor-pointer flex items-center justify-between flex-1 gap-3">
                                                            <span>Blanks</span>
                                                            <span className="text-muted-foreground tabular-nums">${expenses.cogs.blanks.toFixed(2)}</span>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id="ink"
                                                            checked={includedExpenses.ink}
                                                            onCheckedChange={(checked) =>
                                                                setIncludedExpenses({ ...includedExpenses, ink: checked === true })
                                                            }
                                                        />
                                                        <label htmlFor="ink" className="text-sm font-medium cursor-pointer flex items-center justify-between flex-1 gap-3">
                                                            <span>Print Materials</span>
                                                            <span className="text-muted-foreground tabular-nums">${expenses.cogs.ink.toFixed(2)}</span>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id="supplies"
                                                            checked={includedExpenses.supplies}
                                                            onCheckedChange={(checked) =>
                                                                setIncludedExpenses({ ...includedExpenses, supplies: checked === true })
                                                            }
                                                        />
                                                        <label htmlFor="supplies" className="text-sm font-medium cursor-pointer flex items-center justify-between flex-1 gap-3">
                                                            <span>Order Supplies</span>
                                                            <span className="text-muted-foreground tabular-nums">${expenses.cogs.supplies.toFixed(2)}</span>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id="shipping"
                                                            checked={includedExpenses.shipping}
                                                            onCheckedChange={(checked) =>
                                                                setIncludedExpenses({ ...includedExpenses, shipping: checked === true })
                                                            }
                                                        />
                                                        <label htmlFor="shipping" className="text-sm font-medium cursor-pointer flex items-center justify-between flex-1 gap-3">
                                                            <span>Shipping</span>
                                                            <span className="text-muted-foreground tabular-nums">${(liveShippingProgress ? liveShippingProgress.currentCost : expenses.operational.shipping).toFixed(2)}</span>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id="labor"
                                                            checked={includedExpenses.labor}
                                                            onCheckedChange={(checked) =>
                                                                setIncludedExpenses({ ...includedExpenses, labor: checked === true })
                                                            }
                                                        />
                                                        <label htmlFor="labor" className="text-sm font-medium cursor-pointer flex items-center justify-between flex-1 gap-3">
                                                            <span>Labor</span>
                                                            <span className="text-muted-foreground tabular-nums">${expenses.operational.labor.toFixed(2)}</span>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            id="rent"
                                                            checked={includedExpenses.rent}
                                                            onCheckedChange={(checked) =>
                                                                setIncludedExpenses({ ...includedExpenses, rent: checked === true })
                                                            }
                                                        />
                                                        <label htmlFor="rent" className="text-sm font-medium cursor-pointer flex items-center justify-between flex-1 gap-3">
                                                            <span>Rent</span>
                                                            <span className="text-muted-foreground tabular-nums">${expenses.fixed.rent.toFixed(2)}</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                        {mode === "outstanding" && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {metrics.orderCount} Orders / {metrics.itemCount} Items
                            </p>
                        )}
                    </CardContent>
                </Card>

                {mode === "outstanding" && projections ? (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Expected Completion</CardTitle>
                            <CalendarClock className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {format(new Date(projections.expectedCompletionDate), "MMM dd")}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                ~{Math.ceil(projections.workDaysRemaining)} work days remaining
                            </p>
                        </CardContent>
                    </Card>
                ) : mode === "time-based" && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.itemCount}</div>
                            <p className="text-xs text-muted-foreground">
                                Items processed
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Breakdown */}
            {mode === "outstanding" ? (
                /* Full-width layout for Outstanding mode */
                <div className="space-y-6">
                    {/* Expense Distribution - Full Width Pie Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Expense Distribution</CardTitle>
                            <CardDescription>Visual breakdown of all expenses for the current queue.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Blanks', value: expenses.cogs.blanks },
                                                { name: 'Ink', value: expenses.cogs.ink },
                                                { name: 'Supplies', value: expenses.cogs.supplies },
                                                { name: 'Shipping', value: liveShippingProgress ? liveShippingProgress.currentCost : expenses.operational.shipping },
                                                { name: 'Labor', value: expenses.operational.labor },
                                                { name: 'Rent', value: expenses.fixed.rent },
                                            ].filter(item => item.value > 0)}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={140}
                                            paddingAngle={2}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                            labelLine={false}
                                        >
                                            {[
                                                '#3b82f6', // blue - blanks
                                                '#8b5cf6', // purple - ink
                                                '#ec4899', // pink - supplies
                                                '#f97316', // orange - shipping
                                                '#22c55e', // green - labor
                                                '#eab308', // yellow - rent
                                                '#06b6d4', // cyan - utilities
                                            ].map((color, index) => (
                                                <Cell key={`cell-${index}`} fill={color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => typeof value === 'number' ? `$${value.toFixed(2)}` : value}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Expense Structure - Detailed Breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Expense Structure</CardTitle>
                            <CardDescription>Breakdown of all costs for the current queue.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                    {/* COGS */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                                            <span className="flex items-center gap-2 font-bold text-base"><Package className="h-5 w-5 text-blue-600" /> COGS</span>
                                            <span className="font-bold text-lg">${expenses.cogs.total.toFixed(2)}</span>
                                        </div>
                                        <div className="pl-4 space-y-3">
                                            <div className="flex justify-between items-center text-sm font-medium">
                                                <span>Blanks Materials</span>
                                                <span>${expenses.cogs.blanks.toFixed(2)}</span>
                                            </div>

                                            {/* Per-Item Costs */}
                                            <div className="space-y-2 border-l-2 border-muted pl-4 ml-1">
                                                <div className="flex justify-between font-semibold text-sm">
                                                    <span>Print Materials <span className="text-muted-foreground font-normal text-xs">({metrics.itemCount} items × $2.53)</span></span>
                                                    <span>${expenses.cogs.ink.toFixed(2)}</span>
                                                </div>
                                                {data.perItemCosts && (
                                                    <div className="space-y-1 text-xs text-muted-foreground">
                                                        <div className="flex justify-between"><span>Ink ($1.20/item)</span> <span>${data.perItemCosts.ink.toFixed(2)}</span></div>
                                                        <div className="flex justify-between"><span>Printer Repairs ($0.45/item)</span> <span>${data.perItemCosts.printerRepairs.toFixed(2)}</span></div>
                                                        <div className="flex justify-between"><span>Pretreat ($0.27/item)</span> <span>${data.perItemCosts.pretreat.toFixed(2)}</span></div>
                                                        <div className="flex justify-between"><span>Electricity ($0.24/item)</span> <span>${data.perItemCosts.electricity.toFixed(2)}</span></div>
                                                        <div className="flex justify-between"><span>Neck Labels ($0.08/item)</span> <span>${data.perItemCosts.neckLabel.toFixed(2)}</span></div>
                                                        <div className="flex justify-between"><span>Parchment Paper ($0.06/item)</span> <span>${data.perItemCosts.parchmentPaper.toFixed(2)}</span></div>
                                                        <div className="flex justify-between text-xs italic bg-muted/30 p-1 rounded mt-1">
                                                            <span>Subtotal (${data.perItemCosts.subtotal.toFixed(2)}) + 10% Buffer</span>
                                                            <span>+${data.perItemCosts.buffer.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Per-Order Costs */}
                                            <div className="space-y-2 border-l-2 border-muted pl-4 ml-1">
                                                <div className="flex justify-between font-semibold text-sm">
                                                    <span>Order Supplies <span className="text-muted-foreground font-normal text-xs">({metrics.orderCount} orders × $0.43)</span></span>
                                                    <span>${expenses.cogs.supplies.toFixed(2)}</span>
                                                </div>
                                                {data.perOrderCosts && (
                                                    <div className="space-y-1 text-xs text-muted-foreground">
                                                        <div className="flex justify-between"><span>Thank You Cards ($0.14/order)</span> <span>${data.perOrderCosts.thankYouCards.toFixed(2)}</span></div>
                                                        <div className="flex justify-between"><span>Polymailer ($0.09/order)</span> <span>${data.perOrderCosts.polymailer.toFixed(2)}</span></div>
                                                        <div className="flex justify-between"><span>Cleaning Solution ($0.08/order)</span> <span>${data.perOrderCosts.cleaningSolution.toFixed(2)}</span></div>
                                                        <div className="flex justify-between"><span>Integrated Paper ($0.06/order)</span> <span>${data.perOrderCosts.integratedPaper.toFixed(2)}</span></div>
                                                        <div className="flex justify-between"><span>Blank Paper ($0.02/order)</span> <span>${data.perOrderCosts.blankPaper.toFixed(2)}</span></div>
                                                        <div className="flex justify-between text-xs italic bg-muted/30 p-1 rounded mt-1">
                                                            <span>Subtotal (${data.perOrderCosts.subtotal.toFixed(2)}) + 10% Buffer</span>
                                                            <span>+${data.perOrderCosts.buffer.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-dashed" />

                                    {/* Operational - without fees */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                                            <span className="flex items-center gap-2 font-bold text-base"><Truck className="h-5 w-5 text-green-600" /> Operational</span>
                                            <span className="font-bold text-lg">
                                                ${(
                                                    (liveShippingProgress ? liveShippingProgress.currentCost : expenses.operational.shipping) +
                                                    expenses.operational.labor
                                                ).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="pl-4 space-y-3 text-sm">
                                            <div className="flex justify-between items-center group">
                                                <div className="flex items-center gap-2 font-medium">
                                                    <span>Shipping {!liveShippingProgress && <span className="text-muted-foreground font-normal text-xs">(Estimated)</span>}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        className="h-5 px-1.5 text-[10px] bg-muted hover:bg-muted-foreground/10"
                                                        onClick={calculateLiveRates}
                                                        disabled={isCalculatingShipping}
                                                    >
                                                        {isCalculatingShipping ? <Loader2 className="h-3 w-3 animate-spin" /> : "Calc Live"}
                                                    </Button>
                                                </div>
                                                <span className={liveShippingProgress ? "font-bold text-blue-600" : ""}>
                                                    ${liveShippingProgress ? liveShippingProgress.currentCost.toFixed(2) : expenses.operational.shipping.toFixed(2)}
                                                </span>
                                            </div>

                                            {liveShippingProgress && (
                                                <div className={`my-1 space-y-1 p-2 rounded border ${
                                                    !isCalculatingShipping && liveShippingProgress.processed === liveShippingProgress.total
                                                        ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-800/30'
                                                        : 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30'
                                                }`}>
                                                    <div className={`flex justify-between text-[10px] ${
                                                        !isCalculatingShipping && liveShippingProgress.processed === liveShippingProgress.total
                                                            ? 'text-green-700 dark:text-green-300'
                                                            : 'text-blue-700 dark:text-blue-300'
                                                    }`}>
                                                        <span>
                                                            {!isCalculatingShipping && liveShippingProgress.processed === liveShippingProgress.total
                                                                ? '✓ Completed'
                                                                : 'Calculating live rates...'}
                                                        </span>
                                                        <span>{liveShippingProgress.total > 0 ? Math.round((liveShippingProgress.processed / liveShippingProgress.total) * 100) : 0}%</span>
                                                    </div>
                                                    <div className={`h-1.5 w-full rounded-full overflow-hidden ${
                                                        !isCalculatingShipping && liveShippingProgress.processed === liveShippingProgress.total
                                                            ? 'bg-green-100 dark:bg-green-950'
                                                            : 'bg-blue-100 dark:bg-blue-950'
                                                    }`}>
                                                        <div
                                                            className={`h-full transition-all duration-300 ${
                                                                !isCalculatingShipping && liveShippingProgress.processed === liveShippingProgress.total
                                                                    ? 'bg-green-500'
                                                                    : 'bg-blue-500'
                                                            }`}
                                                            style={{ width: `${liveShippingProgress.total > 0 ? (liveShippingProgress.processed / liveShippingProgress.total) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                    {!isCalculatingShipping && liveShippingProgress.processed === liveShippingProgress.total && liveShippingProgress.total > 0 && (
                                                        <div className="text-[10px] text-green-700 dark:text-green-300 mt-1">
                                                            Avg: ${(liveShippingProgress.currentCost / liveShippingProgress.total).toFixed(2)} per order
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex justify-between items-baseline font-medium">
                                                <span>Labor</span>
                                                <div className="text-right">
                                                    <span>${expenses.operational.labor.toFixed(2)}</span>
                                                    <div className="text-[10px] text-muted-foreground font-normal">
                                                        ${expenses.operational.laborCostPerItem.toFixed(2)} / item
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-dashed" />

                                    {/* Fixed - only rent */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                                            <span className="flex items-center gap-2 font-bold text-base"><ShoppingBag className="h-5 w-5 text-orange-600" /> Fixed Overhead</span>
                                            <span>${expenses.fixed.rent.toFixed(2)}</span>
                                        </div>
                                        <div className="pl-4 space-y-3 text-sm text-muted-foreground">
                                            <div className="flex justify-between"><span>Rent</span> <span>${expenses.fixed.rent.toFixed(2)}</span></div>
                                        </div>
                                    </div>
                                </div>
                        </CardContent>
                    </Card>

                    {/* Garment Breakdown */}
                    {data.garmentBreakdown && data.garmentBreakdown.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Blanks Breakdown</CardTitle>
                                <CardDescription>Quantity and average fulfillment cost by garment type.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Garment Type</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-right">Total Cost</TableHead>
                                            <TableHead className="text-right">Avg Cost</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.garmentBreakdown.map((item) => (
                                            <TableRow key={item.garmentType}>
                                                <TableCell className="font-medium">{item.garmentType}</TableCell>
                                                <TableCell className="text-right">{item.count}</TableCell>
                                                <TableCell className="text-right">${item.totalCost.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">${item.avgCost.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            ) : (
                /* Two-column layout for Time-based mode */
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Expense Structure</CardTitle>
                            <CardDescription>Breakdown of all costs impacting profit.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* COGS */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between font-semibold">
                                    <span className="flex items-center gap-2"><Package className="h-4 w-4" /> COGS</span>
                                    <span>${expenses.cogs.total.toFixed(2)}</span>
                                </div>
                                <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                                    <div className="flex justify-between"><span>Blanks</span> <span>${expenses.cogs.blanks.toFixed(2)}</span></div>

                                    {/* Per-Item Costs */}
                                    <div className="flex justify-between font-medium text-foreground mt-2">
                                        <span>Print Materials ({metrics.itemCount} items × $2.53)</span>
                                        <span>${expenses.cogs.ink.toFixed(2)}</span>
                                    </div>
                                    {data.perItemCosts && (
                                        <div className="pl-4 space-y-0.5 text-xs">
                                            <div className="flex justify-between"><span>Ink ($1.20/item)</span> <span>${data.perItemCosts.ink.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Printer Repairs ($0.45/item)</span> <span>${data.perItemCosts.printerRepairs.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Pretreat ($0.27/item)</span> <span>${data.perItemCosts.pretreat.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Electricity ($0.24/item)</span> <span>${data.perItemCosts.electricity.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Neck Labels ($0.08/item)</span> <span>${data.perItemCosts.neckLabel.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Parchment Paper ($0.06/item)</span> <span>${data.perItemCosts.parchmentPaper.toFixed(2)}</span></div>
                                            <div className="flex justify-between text-muted-foreground/60 italic border-t pt-1 mt-1">
                                                <span>Subtotal: ${data.perItemCosts.subtotal.toFixed(2)} + 10% Buffer</span>
                                                <span>+${data.perItemCosts.buffer.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Per-Order Costs */}
                                    <div className="flex justify-between font-medium text-foreground mt-2">
                                        <span>Order Supplies ({metrics.orderCount} orders × $0.43)</span>
                                        <span>${expenses.cogs.supplies.toFixed(2)}</span>
                                    </div>
                                    {data.perOrderCosts && (
                                        <div className="pl-4 space-y-0.5 text-xs">
                                            <div className="flex justify-between"><span>Thank You Cards ($0.14/order)</span> <span>${data.perOrderCosts.thankYouCards.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Polymailer ($0.09/order)</span> <span>${data.perOrderCosts.polymailer.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Cleaning Solution ($0.08/order)</span> <span>${data.perOrderCosts.cleaningSolution.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Integrated Paper ($0.06/order)</span> <span>${data.perOrderCosts.integratedPaper.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Blank Paper ($0.02/order)</span> <span>${data.perOrderCosts.blankPaper.toFixed(2)}</span></div>
                                            <div className="flex justify-between text-muted-foreground/60 italic border-t pt-1 mt-1">
                                                <span>Subtotal: ${data.perOrderCosts.subtotal.toFixed(2)} + 10% Buffer</span>
                                                <span>+${data.perOrderCosts.buffer.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t my-2" />

                            {/* Operational */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between font-semibold">
                                    <span className="flex items-center gap-2"><Truck className="h-4 w-4" /> Operational</span>
                                    <span>${expenses.operational.total.toFixed(2)}</span>
                                </div>
                                <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                                    <div className="flex justify-between"><span>Shipping</span> <span>${expenses.operational.shipping.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Shopify Fees</span> <span>${expenses.operational.transactionFees.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Labor</span> <span>${expenses.operational.labor.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-xs italic opacity-70 pl-2">
                                        <span>Avg per Item</span>
                                        <span>${expenses.operational.laborCostPerItem.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t my-2" />

                            {/* Fixed */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between font-semibold">
                                    <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Fixed Overhead</span>
                                    <span>${expenses.fixed.total.toFixed(2)}</span>
                                </div>
                                <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                                    <div className="flex justify-between"><span>Rent</span> <span>${expenses.fixed.rent.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Utilities</span> <span>${expenses.fixed.utilities.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Subscriptions</span> <span>${expenses.fixed.subscriptions.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Marketing / Other</span> <span>${expenses.fixed.other.toFixed(2)}</span></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Insights - Only in time-based mode */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Insights</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="rounded-md bg-muted p-4">
                                    <h4 className="font-semibold mb-1">Profitability Health</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {metrics.profitMargin > 15
                                            ? "Healthy margin above 15%."
                                            : metrics.profitMargin > 0
                                                ? "Positive but tight margin. Review Cogs."
                                                : "Operating at a loss."}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
