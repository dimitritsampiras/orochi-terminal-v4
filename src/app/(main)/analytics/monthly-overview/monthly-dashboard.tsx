"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { DollarSign, TrendingUp, TrendingDown, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/types/csv-types";

const COLORS = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#6b7280", // gray
];

interface MonthlySummaryData {
    period: {
        month: number;
        year: number;
    };
    uploadStatus: {
        rho_bank: boolean;
        rho_card: boolean;
        mercury: boolean;
        paypal: boolean;
        wise: boolean;
        rbc_bank: boolean;
        rbc_card: boolean;
    };
    revenue: Record<string, number>;
    expenses: Record<string, number>;
    netCashFlow: Record<string, number>;
    reconciliationStatus: {
        totalRhoCardExpenses: number;
        reconciledRhoCardExpenses: number;
        reconciliationRate: number;
        isComplete: boolean;
    };
    topExpensesByVendor: Array<{
        vendor: string;
        amounts: Record<string, number>;
        transactionCount: number;
        // percentage removed as it's hard to calc mixed
    }>;
    expensesByCategory: Array<{
        category: string;
        amounts: Record<string, number>;
    }>;
    transactionCounts: {
        total: number;
        income: number;
        expenses: number;
        excluded: number;
    };
}

interface MonthlyDashboardProps {
    periodMonth: number;
    periodYear: number;
}

export function MonthlyDashboard({ periodMonth, periodYear }: MonthlyDashboardProps) {
    const [data, setData] = useState<MonthlySummaryData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/analytics/monthly-summary?month=${periodMonth}&year=${periodYear}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch monthly summary");
            }

            const summaryData = await response.json();
            setData(summaryData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load summary");
        } finally {
            setIsLoading(false);
        }
    }, [periodMonth, periodYear]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    const formatCurrency = (amount: number, currency: string = "USD") => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
        }).format(amount);
    };

    const renderCurrencyBreakdown = (amounts: Record<string, number>, colorClass?: string) => {
        const entries = Object.entries(amounts);
        if (entries.length === 0) return <span className="text-muted-foreground">$0.00</span>;

        return (
            <div className="flex flex-col gap-0.5">
                {entries.map(([currency, amount]) => (
                    <span key={currency} className={colorClass}>
                        {formatCurrency(amount, currency)}
                    </span>
                ))}
            </div>
        );
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Loading Dashboard...</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle>Error Loading Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">{error}</p>
                    <Button onClick={fetchSummary} className="mt-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    const uploadComplete =
        data.uploadStatus.rho_bank &&
        data.uploadStatus.rho_card &&
        data.uploadStatus.mercury &&
        data.uploadStatus.paypal &&
        data.uploadStatus.wise &&
        data.uploadStatus.rbc_bank &&
        data.uploadStatus.rbc_card;

    const pieData = data.expensesByCategory.map((item, index) => {
        // Summing absolute values of all currencies for rough visualization
        const totalValue = Object.values(item.amounts).reduce((sum, val) => sum + val, 0);
        return {
            name: EXPENSE_CATEGORY_LABELS[item.category as ExpenseCategory] || "Other",
            value: totalValue,
            color: COLORS[index % COLORS.length],
        };
    });

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono">
                            {renderCurrencyBreakdown(data.revenue, "text-green-600")}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {data.transactionCounts.income} income transactions
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono">
                            {renderCurrencyBreakdown(data.expenses, "text-red-600")}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {data.transactionCounts.expenses} expense transactions
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold font-mono">
                            {renderCurrencyBreakdown(
                                data.netCashFlow,
                                // Dynamic color tricky with mixed currencies, defaulting to neutral/black unless specific logic added
                                // Or we just let renderCurrencyBreakdown handle values. 
                                // Let's pass undefined and handle positive/negative coloring inline? 
                                // Actually let's just use a neutral color or specific per line if we enhanced the helper.
                                // For now simple:
                                ""
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {data.transactionCounts.excluded} excluded
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Reconciliation</CardTitle>
                        {data.reconciliationStatus.reconciliationRate === 100 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {data.reconciliationStatus.reconciliationRate.toFixed(0)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {data.reconciliationStatus.reconciledRhoCardExpenses} of{" "}
                            {data.reconciliationStatus.totalRhoCardExpenses} matched
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Upload Status Alert */}
            {!uploadComplete && (
                <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Incomplete Data
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm">
                            Missing uploads:{" "}
                            {[
                                !data.uploadStatus.rho_bank && "Rho Bank",
                                !data.uploadStatus.rho_card && "Rho Card",
                                !data.uploadStatus.mercury && "Mercury",
                                !data.uploadStatus.paypal && "PayPal",
                                !data.uploadStatus.wise && "Wise",
                                !data.uploadStatus.rbc_card && "RBC Card",
                                !data.uploadStatus.rbc_bank && "RBC Bank",
                            ]
                                .filter(Boolean)
                                .join(", ")}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Charts and Tables */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Top Vendors Table */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Top Expenses by Vendor</CardTitle>
                        <Button variant="outline" size="sm" onClick={fetchSummary}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {data.topExpensesByVendor.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-right">% of Total</TableHead>
                                        <TableHead className="text-center">Count</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.topExpensesByVendor.map((vendor) => (
                                        <TableRow key={vendor.vendor}>
                                            <TableCell className="font-medium">
                                                {vendor.vendor}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {renderCurrencyBreakdown(vendor.amounts)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {/* Percentage deprecated for mixed currencies */}
                                                <Badge variant="secondary">
                                                    -
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {vendor.transactionCount}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                No expense data available
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Category Pie Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Expenses by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={350}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={120}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent }) =>
                                            `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                                        }
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                No categorized expenses to display
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
