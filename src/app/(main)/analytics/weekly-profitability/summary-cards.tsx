"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Package,
    ShoppingCart,
    Truck,
    Zap,
    RefreshCw,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Target,
    TrendingDown as TargetIcon,
} from "lucide-react";
import type { WeeklyProfitabilityReport } from "@/lib/core/analytics/calculate-weekly-profitability";

interface SummaryCardsProps {
    report: WeeklyProfitabilityReport | null;
    isLoading?: boolean;
    onFetchUnpurchasedRates?: () => void;
    isFetchingRates?: boolean;
    fetchSuccessMessage?: string | null;
}

export function SummaryCards({ report, isLoading, onFetchUnpurchasedRates, isFetchingRates, fetchSuccessMessage }: SummaryCardsProps) {
    const [showFailedOrders, setShowFailedOrders] = useState(false);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatPercent = (value: number) => {
        return `${value.toFixed(1)}%`;
    };

    if (isLoading || !report) {
        return (
            <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 w-32 bg-muted animate-pulse rounded mb-1" />
                                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i + 4}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 w-32 bg-muted animate-pulse rounded mb-1" />
                                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i + 8}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 w-32 bg-muted animate-pulse rounded mb-1" />
                                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </>
        );
    }

    return (
        <>
            {/* Top Row - Main Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Net Revenue
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(report.revenue.netRevenue)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total Sales: {formatCurrency(report.revenue.totalSales)} |
                            Fees: {formatCurrency(report.revenue.shopifyFees)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Costs
                        </CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(report.profitability.totalCosts)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Fulfillment: {formatCurrency(report.fulfillment.total)} |
                            Operating: {formatCurrency(report.operating.total)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Gross Profit
                        </CardTitle>
                        <DollarSign
                            className={`h-4 w-4 ${report.profitability.grossProfit >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                        />
                    </CardHeader>
                    <CardContent>
                        <div
                            className={`text-2xl font-bold ${report.profitability.grossProfit >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                        >
                            {formatCurrency(report.profitability.grossProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Margin: {formatPercent(report.profitability.profitMargin)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Items Ordered
                        </CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {report.fulfillment.itemCount}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {report.fulfillment.orderCount} orders |
                            ${report.profitability.costPerItem.toFixed(2)}/item
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Second Row - Fulfillment Breakdown */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Blanks Cost
                        </CardTitle>
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(report.fulfillment.blanksCost)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            ${(report.fulfillment.blanksCost / report.fulfillment.itemCount || 0).toFixed(2)}/item
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Ink & Production
                        </CardTitle>
                        <Zap className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(
                                report.fulfillment.inkCost + report.fulfillment.perItemCosts
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Ink + Repairs + Pretreat + Electric
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Shipping Cost
                        </CardTitle>
                        <Truck className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(report.fulfillment.shippingCost)}
                        </div>
                        {report.fulfillment.shippingMetadata ? (
                            <div className="text-xs text-muted-foreground space-y-1 mt-2">
                                <div className="flex items-center gap-1">
                                    <span>Purchased:</span>
                                    <span className="font-medium">
                                        {report.fulfillment.shippingMetadata.ordersWithPurchasedShipping} ({formatCurrency(report.fulfillment.shippingMetadata.actualShippingCost)})
                                    </span>
                                </div>
                                {report.fulfillment.shippingMetadata.ordersWithEstimatedShipping > 0 && (
                                    <div className="flex items-center gap-1">
                                        <span>Quoted:</span>
                                        <span className="font-medium">
                                            {report.fulfillment.shippingMetadata.ordersWithEstimatedShipping} ({formatCurrency(report.fulfillment.shippingMetadata.estimatedShippingCost)})
                                        </span>
                                    </div>
                                )}
                                {report.fulfillment.shippingMetadata.ordersFailedToFetchRates > 0 && (
                                    <>
                                        <div className="flex items-center gap-1">
                                            <span className="text-red-600">Failed:</span>
                                            <span className="font-medium text-red-600">
                                                {report.fulfillment.shippingMetadata.ordersFailedToFetchRates}
                                            </span>
                                        </div>
                                        {report.fulfillment.shippingMetadata.failedOrders && report.fulfillment.shippingMetadata.failedOrders.length > 0 && (
                                            <div className="mt-1">
                                                <button
                                                    onClick={() => setShowFailedOrders(!showFailedOrders)}
                                                    className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                                                >
                                                    {showFailedOrders ? (
                                                        <ChevronDown className="h-3 w-3" />
                                                    ) : (
                                                        <ChevronRight className="h-3 w-3" />
                                                    )}
                                                    <AlertCircle className="h-3 w-3" />
                                                    View failed
                                                </button>
                                                {showFailedOrders && (
                                                    <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                                                        {report.fulfillment.shippingMetadata.failedOrders.map((failedOrder) => (
                                                            <div key={failedOrder.orderId} className="text-xs bg-red-50 dark:bg-red-950/20 p-1.5 rounded border border-red-200 dark:border-red-900">
                                                                <div className="font-mono text-red-700 dark:text-red-400 truncate">
                                                                    {failedOrder.orderId.replace('gid://shopify/Order/', '')}
                                                                </div>
                                                                <div className="text-red-600 dark:text-red-500 text-[10px] truncate">
                                                                    {failedOrder.error}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                                {report.fulfillment.shippingMetadata.ordersWithoutShipping > 0 && (
                                    <div className="mt-1.5 pt-1.5 border-t border-border">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                                {report.fulfillment.shippingMetadata.ordersWithoutShipping} no shipping
                                            </Badge>
                                            {onFetchUnpurchasedRates && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-5 px-2 text-[10px]"
                                                    onClick={onFetchUnpurchasedRates}
                                                    disabled={isFetchingRates}
                                                >
                                                    <RefreshCw className={`h-3 w-3 mr-1 ${isFetchingRates ? 'animate-spin' : ''}`} />
                                                    Fetch
                                                </Button>
                                            )}
                                        </div>
                                        {isFetchingRates && (
                                            <div className="mt-1 text-[10px] text-muted-foreground">
                                                Fetching rates...
                                            </div>
                                        )}
                                        {fetchSuccessMessage && !isFetchingRates && (
                                            <div className="mt-1.5 text-[10px] text-green-600 font-medium">
                                                ✓ {fetchSuccessMessage}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground mt-2">
                                ${(report.fulfillment.shippingCost / report.fulfillment.orderCount || 0).toFixed(2)}/order
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Packaging & Supplies
                        </CardTitle>
                        <Package className="h-4 w-4 text-teal-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(report.fulfillment.perOrderCosts)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Cards + Mailers + Papers
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Third Row - Marketing Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Average Order Value
                        </CardTitle>
                        <ShoppingCart className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(report.profitability.averageOrderValue)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Revenue per order
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Breakeven ROAS
                        </CardTitle>
                        <Target className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {report.profitability.breakevenROAS.toFixed(2)}x
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Revenue per $ marketing to break even
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Breakeven CPA
                        </CardTitle>
                        <TargetIcon className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(report.profitability.breakevenCPA)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Max cost per order to break even
                        </p>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
