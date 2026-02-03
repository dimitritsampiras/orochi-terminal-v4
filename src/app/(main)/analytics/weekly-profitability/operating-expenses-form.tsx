"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";
import type { WeeklyProfitabilityReport } from "@/lib/core/analytics/calculate-weekly-profitability";

interface OperatingExpensesFormProps {
    report: WeeklyProfitabilityReport | null;
    payrollCost: number | null;
    useHistoricalPayroll: boolean;
    marketingCostMeta: number;
    marketingCostGoogle: number;
    marketingCostOther: number;
    onPayrollChange: (cost: number | null, useHistorical: boolean) => void;
    onMarketingChange: (meta: number, google: number, other: number) => void;
}

export function OperatingExpensesForm({
    report,
    payrollCost,
    useHistoricalPayroll,
    marketingCostMeta,
    marketingCostGoogle,
    marketingCostOther,
    onPayrollChange,
    onMarketingChange,
}: OperatingExpensesFormProps) {
    const [localPayroll, setLocalPayroll] = useState<string>(
        payrollCost?.toString() || ""
    );
    const [localMeta, setLocalMeta] = useState<string>(
        marketingCostMeta.toString()
    );
    const [localGoogle, setLocalGoogle] = useState<string>(
        marketingCostGoogle.toString()
    );
    const [localOther, setLocalOther] = useState<string>(
        marketingCostOther.toString()
    );

    // Update local state when props change
    useEffect(() => {
        if (payrollCost !== null && !useHistoricalPayroll) {
            setLocalPayroll(payrollCost.toString());
        }
    }, [payrollCost, useHistoricalPayroll]);

    // Sync marketing values when props change (e.g., from database defaults)
    useEffect(() => {
        setLocalMeta(marketingCostMeta.toString());
    }, [marketingCostMeta]);

    useEffect(() => {
        setLocalGoogle(marketingCostGoogle.toString());
    }, [marketingCostGoogle]);

    useEffect(() => {
        setLocalOther(marketingCostOther.toString());
    }, [marketingCostOther]);

    const handlePayrollBlur = () => {
        const value = parseFloat(localPayroll);
        if (!isNaN(value) && value >= 0) {
            onPayrollChange(value, false);
        } else if (localPayroll === "") {
            onPayrollChange(null, useHistoricalPayroll);
        }
    };

    const handleUseHistoricalToggle = (checked: boolean) => {
        if (checked) {
            setLocalPayroll("");
            onPayrollChange(null, true);
        } else {
            onPayrollChange(null, false);
        }
    };

    const handleMarketingBlur = () => {
        const meta = parseFloat(localMeta) || 0;
        const google = parseFloat(localGoogle) || 0;
        const other = parseFloat(localOther) || 0;

        onMarketingChange(meta, google, other);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    const historicalAverage = report?.operating.historicalAveragePayroll || 0;
    const historicalCostPerItem = report?.operating.historicalLaborCostPerItem || 0;
    const totalMarketing = marketingCostMeta + marketingCostGoogle + marketingCostOther;

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Payroll Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Payroll & Labor
                    </CardTitle>
                    <CardDescription>
                        Enter weekly payroll or use historical average
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="use-historical" className="flex flex-col space-y-1">
                            <span>Use Historical Average</span>
                            <span className="font-normal text-sm text-muted-foreground">
                                {historicalCostPerItem > 0
                                    ? `${formatCurrency(historicalCostPerItem)}/item (${historicalAverage > 0 ? formatCurrency(historicalAverage) + " this week" : ""})`
                                    : "No historical data"}
                            </span>
                        </Label>
                        <Switch
                            id="use-historical"
                            checked={useHistoricalPayroll}
                            onCheckedChange={handleUseHistoricalToggle}
                            disabled={historicalCostPerItem === 0}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="payroll-manual">Manual Payroll Entry</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="payroll-manual"
                                type="number"
                                placeholder="Enter amount"
                                className="pl-9"
                                value={localPayroll}
                                onChange={(e) => setLocalPayroll(e.target.value)}
                                onBlur={handlePayrollBlur}
                                disabled={useHistoricalPayroll}
                                step="0.01"
                                min="0"
                            />
                        </div>
                    </div>

                    {report && (
                        <div className="rounded-lg border p-3 bg-muted/50">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Active Payroll:</span>
                                <Badge variant="secondary" className="font-mono">
                                    {report.operating.payrollCost !== null
                                        ? formatCurrency(report.operating.payrollCost)
                                        : "Not set"}
                                </Badge>
                            </div>
                            {report.operating.payrollSource && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Source: {report.operating.payrollSource === "manual"
                                        ? "Manual entry"
                                        : "Historical average"}
                                </div>
                            )}
                        </div>
                    )}

                    {report && report.operating.recurringExpenses > 0 && (
                        <div className="rounded-lg border p-3 bg-blue-50 dark:bg-blue-950/20">
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-blue-600" />
                                <span className="text-muted-foreground">Recurring Expenses:</span>
                                <span className="font-semibold">
                                    {formatCurrency(report.operating.recurringExpenses)}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Prorated weekly from monthly/yearly subscriptions
                            </p>
                        </div>
                    )}

                    {report && report.operating.rentCost > 0 && (
                        <div className="rounded-lg border p-3 bg-amber-50 dark:bg-amber-950/20">
                            <div className="flex items-center gap-2 text-sm">
                                <DollarSign className="h-4 w-4 text-amber-600" />
                                <span className="text-muted-foreground">Weekly Rent:</span>
                                <span className="font-semibold">
                                    {formatCurrency(report.operating.rentCost)}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Prorated from monthly rent payment
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Marketing Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Marketing Expenses
                    </CardTitle>
                    <CardDescription>
                        {report?.operating && (report.operating.marketingCostMeta > 0 || report.operating.marketingCostGoogle > 0 || report.operating.marketingCostOther > 0)
                            ? "Pre-filled from expenses tab (can be edited)"
                            : "Enter ad spend for this week by channel"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="marketing-meta">Meta (Facebook/Instagram)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="marketing-meta"
                                type="number"
                                placeholder="0.00"
                                className="pl-9"
                                value={localMeta}
                                onChange={(e) => setLocalMeta(e.target.value)}
                                onBlur={handleMarketingBlur}
                                step="0.01"
                                min="0"
                            />
                        </div>
                        {report?.operating.marketingMetadata?.meta && (
                            <p className={`text-xs ${report.operating.marketingMetadata.meta.isPartialCoverage ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                {report.operating.marketingMetadata.meta.isPartialCoverage ? '⚠️ ' : ''}
                                Covers {new Date(report.operating.marketingMetadata.meta.periodStart).toLocaleDateString()} - {new Date(report.operating.marketingMetadata.meta.periodEnd).toLocaleDateString()}
                                {report.operating.marketingMetadata.meta.isPartialCoverage &&
                                    ` (prorated from ${formatCurrency(report.operating.marketingMetadata.meta.originalAmount)})`}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="marketing-google">Google Ads</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="marketing-google"
                                type="number"
                                placeholder="0.00"
                                className="pl-9"
                                value={localGoogle}
                                onChange={(e) => setLocalGoogle(e.target.value)}
                                onBlur={handleMarketingBlur}
                                step="0.01"
                                min="0"
                            />
                        </div>
                        {report?.operating.marketingMetadata?.google && (
                            <p className={`text-xs ${report.operating.marketingMetadata.google.isPartialCoverage ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                {report.operating.marketingMetadata.google.isPartialCoverage ? '⚠️ ' : ''}
                                Covers {new Date(report.operating.marketingMetadata.google.periodStart).toLocaleDateString()} - {new Date(report.operating.marketingMetadata.google.periodEnd).toLocaleDateString()}
                                {report.operating.marketingMetadata.google.isPartialCoverage &&
                                    ` (prorated from ${formatCurrency(report.operating.marketingMetadata.google.originalAmount)})`}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="marketing-other">Other Marketing</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="marketing-other"
                                type="number"
                                placeholder="0.00"
                                className="pl-9"
                                value={localOther}
                                onChange={(e) => setLocalOther(e.target.value)}
                                onBlur={handleMarketingBlur}
                                step="0.01"
                                min="0"
                            />
                        </div>
                        {report?.operating.marketingMetadata?.other && (
                            <p className={`text-xs ${report.operating.marketingMetadata.other.isPartialCoverage ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                {report.operating.marketingMetadata.other.isPartialCoverage ? '⚠️ ' : ''}
                                Covers {new Date(report.operating.marketingMetadata.other.periodStart).toLocaleDateString()} - {new Date(report.operating.marketingMetadata.other.periodEnd).toLocaleDateString()}
                                {report.operating.marketingMetadata.other.isPartialCoverage &&
                                    ` (prorated from ${formatCurrency(report.operating.marketingMetadata.other.originalAmount)})`}
                            </p>
                        )}
                    </div>

                    <div className="rounded-lg border p-3 bg-muted/50">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total Marketing:</span>
                            <Badge variant="secondary" className="font-mono">
                                {formatCurrency(totalMarketing)}
                            </Badge>
                        </div>
                        {totalMarketing > 0 && report && report.revenue.netRevenue > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                                {((totalMarketing / report.revenue.netRevenue) * 100).toFixed(1)}% of revenue
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
