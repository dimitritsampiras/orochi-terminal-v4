"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { WeeklyProfitabilityReport } from "@/lib/core/analytics/calculate-weekly-profitability";

interface SalesBreakdownProps {
    report: WeeklyProfitabilityReport | null;
    isLoading?: boolean;
    previousWeekReport?: WeeklyProfitabilityReport | null;
}

export function SalesBreakdown({ report, isLoading, previousWeekReport }: SalesBreakdownProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const calculatePercentageChange = (current: number, previous: number) => {
        if (previous === 0) return null;
        return ((current - previous) / Math.abs(previous)) * 100;
    };

    const formatPercentage = (percentage: number | null) => {
        if (percentage === null) return "—";
        const sign = percentage >= 0 ? "+" : "";
        return `${sign}${percentage.toFixed(0)}%`;
    };

    if (isLoading || !report) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">
                        <div className="h-5 w-40 bg-muted animate-pulse rounded" />
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    const breakdownItems = [
        {
            label: "Gross sales",
            amount: report.revenue.grossSales,
            prevAmount: previousWeekReport?.revenue.grossSales,
            isSubtraction: false,
            isBold: false,
        },
        {
            label: "Discounts",
            amount: -report.revenue.discounts,
            prevAmount: previousWeekReport ? -previousWeekReport.revenue.discounts : undefined,
            isSubtraction: true,
            isBold: false,
        },
        {
            label: "Returns",
            amount: -report.revenue.returns,
            prevAmount: previousWeekReport ? -previousWeekReport.revenue.returns : undefined,
            isSubtraction: true,
            isBold: false,
        },
        {
            label: "Net sales",
            amount: report.revenue.netSales,
            prevAmount: previousWeekReport?.revenue.netSales,
            isSubtraction: false,
            isBold: true,
        },
        {
            label: "Shipping charges",
            amount: report.revenue.shippingCharges,
            prevAmount: previousWeekReport?.revenue.shippingCharges,
            isSubtraction: false,
            isBold: false,
        },
        {
            label: "Return fees",
            amount: report.revenue.returnFees,
            prevAmount: previousWeekReport?.revenue.returnFees,
            isSubtraction: false,
            isBold: false,
        },
        {
            label: "Taxes",
            amount: report.revenue.taxes,
            prevAmount: previousWeekReport?.revenue.taxes,
            isSubtraction: false,
            isBold: false,
        },
        {
            label: "Total sales",
            amount: report.revenue.totalSales,
            prevAmount: previousWeekReport?.revenue.totalSales,
            isSubtraction: false,
            isBold: true,
        },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-semibold">Total sales breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {breakdownItems.map((item, index) => {
                    const percentageChange = item.prevAmount !== undefined
                        ? calculatePercentageChange(item.amount, item.prevAmount)
                        : null;
                    const isPositiveChange = percentageChange !== null && percentageChange >= 0;

                    return (
                        <div
                            key={item.label}
                            className={`flex items-center justify-between py-1.5 ${
                                item.isBold ? "border-t border-border pt-2 mt-1" : ""
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className={`text-sm ${
                                        item.isBold ? "font-semibold" : "text-muted-foreground"
                                    }`}
                                >
                                    {item.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span
                                    className={`text-sm font-mono ${
                                        item.isBold ? "font-semibold" : ""
                                    } ${
                                        item.isSubtraction ? "text-red-600 dark:text-red-400" : ""
                                    }`}
                                >
                                    {formatCurrency(item.amount)}
                                </span>
                                {percentageChange !== null && (
                                    <div
                                        className={`flex items-center gap-1 min-w-[60px] justify-end ${
                                            isPositiveChange
                                                ? "text-green-600 dark:text-green-400"
                                                : "text-red-600 dark:text-red-400"
                                        }`}
                                    >
                                        {isPositiveChange ? (
                                            <TrendingUp className="h-3 w-3" />
                                        ) : (
                                            <TrendingDown className="h-3 w-3" />
                                        )}
                                        <span className="text-xs font-medium">
                                            {formatPercentage(percentageChange)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
