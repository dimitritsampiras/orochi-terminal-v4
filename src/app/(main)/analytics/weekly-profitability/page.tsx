"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WeekSelector } from "./week-selector";
import { SummaryCards } from "./summary-cards";
import { SalesBreakdown } from "./sales-breakdown";
import { OperatingExpensesForm } from "./operating-expenses-form";
import { HistoricalComparison } from "./historical-comparison";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Save, Lock, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import type { WeeklyProfitabilityReport } from "@/lib/core/analytics/calculate-weekly-profitability";
import { getCurrentWeekEastern, formatInEastern } from "@/lib/utils";

export default function WeeklyProfitabilityPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Get current week in Eastern Time (automatically handles EST/EDT)
    const currentWeek = getCurrentWeekEastern();

    // Initialize from URL params or default to current week
    const getInitialDates = () => {
        const startParam = searchParams.get("start");
        const endParam = searchParams.get("end");

        if (startParam && endParam) {
            const start = new Date(startParam);
            const end = new Date(endParam);
            // Validate dates are valid
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                return { start, end };
            }
        }
        return currentWeek;
    };

    const initialDates = getInitialDates();

    // State
    const [weekStart, setWeekStart] = useState<Date>(initialDates.start);
    const [weekEnd, setWeekEnd] = useState<Date>(initialDates.end);
    const [report, setReport] = useState<WeeklyProfitabilityReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isFetchingRates, setIsFetchingRates] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [fetchSuccessMessage, setFetchSuccessMessage] = useState<string | null>(null);
    const [hasRatesFetched, setHasRatesFetched] = useState(false);

    // Operating expense inputs
    const [payrollCost, setPayrollCost] = useState<number | null>(null);
    const [useHistoricalPayroll, setUseHistoricalPayroll] = useState(true);
    const [marketingCostMeta, setMarketingCostMeta] = useState(0);
    const [marketingCostGoogle, setMarketingCostGoogle] = useState(0);
    const [marketingCostOther, setMarketingCostOther] = useState(0);

    // Saved report state
    const [savedReportId, setSavedReportId] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Fetch/calculate report
    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const params = new URLSearchParams({
                startDate: weekStart.toISOString(),
                endDate: weekEnd.toISOString(),
                checkSaved: "true",
            });

            // Add calculation parameters if set
            if (payrollCost !== null) {
                params.append("payrollCost", payrollCost.toString());
            }
            if (useHistoricalPayroll) {
                params.append("useHistoricalPayroll", "true");
            }
            if (marketingCostMeta > 0) {
                params.append("marketingCostMeta", marketingCostMeta.toString());
            }
            if (marketingCostGoogle > 0) {
                params.append("marketingCostGoogle", marketingCostGoogle.toString());
            }
            if (marketingCostOther > 0) {
                params.append("marketingCostOther", marketingCostOther.toString());
            }
            if (hasRatesFetched) {
                params.append("fetchUnpurchasedShippingRates", "true");
            }

            const response = await fetch(
                `/api/analytics/weekly-profitability?${params}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch report");
            }

            const data = await response.json();

            // Handle saved report
            if (data.isSaved && data.reportId) {
                setSavedReportId(data.reportId);
                setIsSaved(true);

                // Update form inputs from saved data
                if (data.payrollCost !== null && data.payrollCost !== undefined) {
                    setPayrollCost(parseFloat(data.payrollCost));
                    setUseHistoricalPayroll(data.payrollSource === "historical_average");
                }
                if (data.marketingCostMeta !== null) {
                    setMarketingCostMeta(parseFloat(data.marketingCostMeta));
                }
                if (data.marketingCostGoogle !== null) {
                    setMarketingCostGoogle(parseFloat(data.marketingCostGoogle));
                }
                if (data.marketingCostOther !== null) {
                    setMarketingCostOther(parseFloat(data.marketingCostOther));
                }

                // Use analysisJson if available (contains full report structure)
                // Otherwise reconstruct from flat database fields
                if (data.analysisJson) {
                    setReport(data.analysisJson as WeeklyProfitabilityReport);
                } else {
                    // Fallback: reconstruct from database fields
                    setReport({
                        week: {
                            start: new Date(data.weekStart),
                            end: new Date(data.weekEnd),
                            weekNumber: data.weekNumber,
                            year: data.year,
                        },
                        revenue: {
                            grossSales: parseFloat(data.grossSales),
                            discounts: parseFloat(data.discounts || "0"),
                            returns: parseFloat(data.returns || "0"),
                            netSales: parseFloat(data.netSales || "0"),
                            shippingCharges: parseFloat(data.shippingCharges || "0"),
                            returnFees: parseFloat(data.returnFees || "0"),
                            taxes: parseFloat(data.taxes || "0"),
                            totalSales: parseFloat(data.totalSales || "0"),
                            shopifyFees: parseFloat(data.shopifyFees),
                            refunds: parseFloat(data.refunds || "0"),
                            netRevenue: parseFloat(data.netRevenue),
                            orderCount: data.ordersFulfilled,
                        },
                        fulfillment: {
                            blanksCost: parseFloat(data.blanksCost),
                            inkCost: parseFloat(data.inkCost),
                            shippingCost: parseFloat(data.shippingCost),
                            perItemCosts: parseFloat(data.perItemCosts),
                            perOrderCosts: parseFloat(data.perOrderCosts),
                            total: parseFloat(data.totalFulfillmentCost),
                            itemCount: data.itemsFulfilled,
                            orderCount: data.ordersFulfilled,
                            breakdown: {
                                printerRepairs: 0,
                                pretreat: 0,
                                electricity: 0,
                                neckLabels: 0,
                                parchmentPaper: 0,
                                thankYouCards: 0,
                                polymailers: 0,
                                cleaningSolution: 0,
                                integratedPaper: 0,
                                blankPaper: 0,
                            },
                            shippingMetadata: {
                                ordersWithPurchasedShipping: 0,
                                ordersWithEstimatedShipping: 0,
                                ordersFailedToFetchRates: 0,
                                ordersWithoutShipping: 0,
                                actualShippingCost: 0,
                                estimatedShippingCost: 0,
                            },
                        },
                        operating: {
                            payrollCost: data.payrollCost ? parseFloat(data.payrollCost) : null,
                            payrollSource: data.payrollSource as "manual" | "historical_average" | null,
                            historicalAveragePayroll: 0,
                            historicalLaborCostPerItem: 0,
                            historicalLaborData: {
                                costPerItem: 0,
                                totalPayroll: 0,
                                totalLineItems: 0,
                            },
                            marketingCostMeta: parseFloat(data.marketingCostMeta || "0"),
                            marketingCostGoogle: parseFloat(data.marketingCostGoogle || "0"),
                            marketingCostOther: parseFloat(data.marketingCostOther || "0"),
                            totalMarketing: parseFloat(data.totalMarketingCost || "0"),
                            recurringExpenses: parseFloat(data.recurringExpenses || "0"),
                            rentCost: 0,
                            csvExpenses: parseFloat(data.csvExpenses || "0"),
                            total: 0,
                        },
                        profitability: {
                            totalRevenue: parseFloat(data.netRevenue),
                            totalCosts: parseFloat(data.totalCosts),
                            grossProfit: parseFloat(data.grossProfit),
                            profitMargin: parseFloat(data.profitMargin || "0"),
                            costPerItem: parseFloat(data.costPerItem || "0"),
                            costPerOrder: parseFloat(data.costPerOrder || "0"),
                            averageOrderValue: parseFloat(data.averageOrderValue || "0"),
                            breakevenROAS: parseFloat(data.breakevenROAS || "0"),
                            breakevenCPA: parseFloat(data.breakevenCPA || "0"),
                        },
                    });
                }
            } else {
                // New calculation
                setSavedReportId(null);
                setIsSaved(false);
                setReport(data);

                // Sync form with database-sourced marketing values (only if form values are 0)
                // This allows database defaults to populate the form on initial load
                if (data.operating) {
                    if (marketingCostMeta === 0 && data.operating.marketingCostMeta > 0) {
                        setMarketingCostMeta(data.operating.marketingCostMeta);
                    }
                    if (marketingCostGoogle === 0 && data.operating.marketingCostGoogle > 0) {
                        setMarketingCostGoogle(data.operating.marketingCostGoogle);
                    }
                    if (marketingCostOther === 0 && data.operating.marketingCostOther > 0) {
                        setMarketingCostOther(data.operating.marketingCostOther);
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load report");
        } finally {
            setIsLoading(false);
        }
    }, [
        weekStart,
        weekEnd,
        payrollCost,
        useHistoricalPayroll,
        marketingCostMeta,
        marketingCostGoogle,
        marketingCostOther,
        hasRatesFetched,
    ]);

    // Auto-fetch on mount and when week changes
    useEffect(() => {
        fetchReport();
    }, [weekStart, weekEnd]);

    // Recalculate profitability locally when operating expenses change
    useEffect(() => {
        if (!report) return;

        // Calculate updated operating costs
        // Use historical average if toggle is on, otherwise use manual value
        const effectivePayroll = useHistoricalPayroll
            ? (report.operating.historicalAveragePayroll ?? 0)
            : (payrollCost ?? report.operating.payrollCost ?? 0);
        const totalMarketing = marketingCostMeta + marketingCostGoogle + marketingCostOther;
        const recurringExpenses = report.operating.recurringExpenses ?? 0;
        const rentCost = report.operating.rentCost ?? 0;

        // Calculate total costs
        const fulfillmentCosts = report.fulfillment.total;
        const operatingCosts = effectivePayroll + totalMarketing + recurringExpenses + rentCost;
        const totalCosts = fulfillmentCosts + operatingCosts;

        // Calculate profitability metrics using net revenue (after Shopify fees)
        const revenueAfterFees = report.revenue.netRevenue; // totalSales - shopifyFees
        const orderCount = report.fulfillment.orderCount;
        const grossProfit = revenueAfterFees - totalCosts;
        const profitMargin = revenueAfterFees > 0 ? (grossProfit / revenueAfterFees) * 100 : 0;
        const costPerItem = report.fulfillment.itemCount > 0 ? totalCosts / report.fulfillment.itemCount : 0;
        const costPerOrder = orderCount > 0 ? totalCosts / orderCount : 0;

        // Non-marketing costs = fulfillment + payroll + recurring + rent + fees (everything except marketing)
        // Shopify fees are treated as an expense, not a revenue reduction
        const shopifyFees = report.revenue.shopifyFees ?? 0;
        const preFeeRevenue = report.revenue.totalSales;
        const nonMarketingCosts = fulfillmentCosts + effectivePayroll + recurringExpenses + rentCost + shopifyFees;

        // Breakeven ROAS = 1 / contribution margin
        // Contribution margin = (pre-fee revenue - non-marketing costs) / pre-fee revenue
        // This uses ALL non-marketing costs so ROAS reflects "profit margin before marketing"
        const contributionMargin = preFeeRevenue > 0
            ? (preFeeRevenue - nonMarketingCosts) / preFeeRevenue
            : 0;
        const breakevenROAS = contributionMargin > 0 ? 1 / contributionMargin : 0;

        // Breakeven CPA = (pre-fee revenue - non-marketing costs) / order count
        // This tells you the maximum you can spend per order to break even
        const breakevenCPA = orderCount > 0
            ? (preFeeRevenue - nonMarketingCosts) / orderCount
            : 0;

        // Update report with recalculated values
        setReport(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                operating: {
                    ...prev.operating,
                    payrollCost: effectivePayroll,
                    totalMarketing,
                    total: operatingCosts,
                },
                profitability: {
                    ...prev.profitability,
                    totalCosts,
                    grossProfit,
                    profitMargin,
                    costPerItem,
                    costPerOrder,
                    breakevenROAS,
                    breakevenCPA,
                },
            };
        });
    }, [payrollCost, useHistoricalPayroll, marketingCostMeta, marketingCostGoogle, marketingCostOther]);

    // Fetch unpurchased shipping rates (backend handles all batching)
    const handleFetchUnpurchasedRates = useCallback(async () => {
        if (!report) return;

        setIsFetchingRates(true);
        setError(null);
        setFetchSuccessMessage(null);

        try {
            // Get orders without shipping from the report
            const ordersWithoutShipping = report.fulfillment.shippingMetadata?.ordersWithoutShipping || 0;

            if (ordersWithoutShipping === 0) {
                setError("No orders without shipping rates");
                setIsFetchingRates(false);
                return;
            }

            // Single API call - backend handles all the batching and caching
            const response = await fetch("/api/analytics/weekly-profitability/fetch-rates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    weekStart: weekStart.toISOString(),
                    weekEnd: weekEnd.toISOString(),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to fetch shipping rates");
            }

            const { successCount, totalEstimatedCost, failedCount } = await response.json();

            // Mark rates as fetched
            setHasRatesFetched(true);

            // Update the local report with the fetched shipping data
            // This is needed because drift orders (in Shopify but not in DB) can't be cached
            if (report.fulfillment.shippingMetadata) {
                const actualShippingCost = report.fulfillment.shippingMetadata.actualShippingCost;
                const newShippingCost = actualShippingCost + totalEstimatedCost;
                const shippingCostDelta = newShippingCost - report.fulfillment.shippingCost;

                // Recalculate fulfillment total with new shipping costs
                const newFulfillmentTotal = report.fulfillment.total + shippingCostDelta;

                // Recalculate operating costs
                const effectivePayroll = useHistoricalPayroll
                    ? (report.operating.historicalAveragePayroll ?? 0)
                    : (payrollCost ?? report.operating.payrollCost ?? 0);
                const totalMarketing = marketingCostMeta + marketingCostGoogle + marketingCostOther;
                const recurringExpenses = report.operating.recurringExpenses ?? 0;
                const rentCost = report.operating.rentCost ?? 0;
                const operatingCosts = effectivePayroll + totalMarketing + recurringExpenses + rentCost;

                // Calculate total costs with new fulfillment costs
                const totalCosts = newFulfillmentTotal + operatingCosts;

                // Calculate profitability metrics
                const revenueAfterFees = report.revenue.netRevenue;
                const orderCount = report.fulfillment.orderCount;
                const grossProfit = revenueAfterFees - totalCosts;
                const profitMargin = revenueAfterFees > 0 ? (grossProfit / revenueAfterFees) * 100 : 0;
                const costPerItem = report.fulfillment.itemCount > 0 ? totalCosts / report.fulfillment.itemCount : 0;
                const costPerOrder = orderCount > 0 ? totalCosts / orderCount : 0;

                // Breakeven calculations
                const shopifyFees = report.revenue.shopifyFees ?? 0;
                const preFeeRevenue = report.revenue.totalSales;
                const nonMarketingCosts = newFulfillmentTotal + effectivePayroll + recurringExpenses + rentCost + shopifyFees;
                const contributionMargin = preFeeRevenue > 0 ? (preFeeRevenue - nonMarketingCosts) / preFeeRevenue : 0;
                const breakevenROAS = contributionMargin > 0 ? 1 / contributionMargin : 0;
                const breakevenCPA = orderCount > 0 ? (preFeeRevenue - nonMarketingCosts) / orderCount : 0;

                const updatedReport = {
                    ...report,
                    fulfillment: {
                        ...report.fulfillment,
                        shippingCost: newShippingCost,
                        total: newFulfillmentTotal,
                        shippingMetadata: {
                            ...report.fulfillment.shippingMetadata,
                            estimatedShippingCost: totalEstimatedCost,
                            ordersWithEstimatedShipping: successCount,
                            ordersFailedToFetchRates: failedCount || 0,
                            ordersWithoutShipping: 0, // All orders were attempted
                        },
                    },
                    profitability: {
                        ...report.profitability,
                        totalCosts,
                        grossProfit,
                        profitMargin,
                        costPerItem,
                        costPerOrder,
                        breakevenROAS,
                        breakevenCPA,
                    },
                };

                setReport(updatedReport as WeeklyProfitabilityReport);
            }

            setFetchSuccessMessage(`Fetched rates for ${successCount} orders ($${totalEstimatedCost.toFixed(2)})`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to fetch shipping rates";
            setError(errorMsg);
        } finally {
            setIsFetchingRates(false);
        }
    }, [
        report,
        weekStart,
        weekEnd,
        useHistoricalPayroll,
        payrollCost,
        marketingCostMeta,
        marketingCostGoogle,
        marketingCostOther,
    ]);

    const handleWeekChange = (start: Date, end: Date) => {
        setWeekStart(start);
        setWeekEnd(end);

        // Update URL to persist the selected week
        const params = new URLSearchParams();
        params.set("start", start.toISOString());
        params.set("end", end.toISOString());
        router.replace(`?${params.toString()}`, { scroll: false });

        // Reset inputs when changing weeks
        setPayrollCost(null);
        setUseHistoricalPayroll(true);
        setMarketingCostMeta(0);
        setMarketingCostGoogle(0);
        setMarketingCostOther(0);
        setSavedReportId(null);
        setIsSaved(false);
        setHasRatesFetched(false);
        setFetchSuccessMessage(null);
    };

    const handlePayrollChange = (cost: number | null, useHistorical: boolean) => {
        setPayrollCost(cost);
        setUseHistoricalPayroll(useHistorical);
    };

    const handleMarketingChange = (meta: number, google: number, other: number) => {
        setMarketingCostMeta(meta);
        setMarketingCostGoogle(google);
        setMarketingCostOther(other);
    };

    const handleSaveReport = async (finalize: boolean = false) => {
        if (!report) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch("/api/analytics/weekly-profitability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: weekStart.toISOString(),
                    endDate: weekEnd.toISOString(),
                    payrollCost,
                    useHistoricalPayroll,
                    marketingCostMeta,
                    marketingCostGoogle,
                    marketingCostOther,
                    finalize,
                    // Pass the full report to preserve fetched shipping rates
                    fullReportData: report,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to save report");
            }

            const data = await response.json();
            setSavedReportId(data.report.id);
            setIsSaved(true);
            setSuccessMessage(
                finalize
                    ? "Report finalized successfully!"
                    : "Report saved successfully!"
            );

            // Refresh to get saved data
            await fetchReport();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save report");
        } finally {
            setIsSaving(false);
        }
    };

    // Load saved report data (including fetched shipping rates)
    // Can be called with specific dates (from HistoricalComparison) or use current week dates
    const handleLoadSaved = async (reportId?: string, weekStartDate?: Date, weekEndDate?: Date) => {
        const startDate = weekStartDate || weekStart;
        const endDate = weekEndDate || weekEnd;

        // If loading a report from a different week, update the week selector
        if (weekStartDate && weekEndDate) {
            setWeekStart(weekStartDate);
            setWeekEnd(weekEndDate);
            // Update URL to persist the selected week
            const params = new URLSearchParams();
            params.set("start", weekStartDate.toISOString());
            params.set("end", weekEndDate.toISOString());
            router.replace(`?${params.toString()}`, { scroll: false });
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const params = new URLSearchParams({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                checkSaved: "true",
            });

            const response = await fetch(`/api/analytics/weekly-profitability?${params}`);

            if (!response.ok) {
                throw new Error("Failed to load saved report");
            }

            const data = await response.json();

            if (!data.isSaved) {
                setError("No saved report found for this week");
                return;
            }

            // If analysisJson contains the full saved report, use it
            if (data.analysisJson) {
                setReport(data.analysisJson as WeeklyProfitabilityReport);
                // Restore input states from saved data
                if (data.analysisJson.operating) {
                    setPayrollCost(data.analysisJson.operating.payrollCost);
                    setMarketingCostMeta(data.analysisJson.operating.marketingCostMeta || 0);
                    setMarketingCostGoogle(data.analysisJson.operating.marketingCostGoogle || 0);
                    setMarketingCostOther(data.analysisJson.operating.marketingCostOther || 0);
                }
            } else {
                // Fallback to reconstructing from saved fields
                setReport(data as WeeklyProfitabilityReport);
            }

            setSavedReportId(data.reportId || data.id);
            setIsSaved(true);
            setSuccessMessage("Loaded saved report data");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load saved report");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteReport = async () => {
        if (!savedReportId) return;

        setDeleteDialogOpen(false);
        setIsDeleting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch(
                `/api/analytics/weekly-profitability/${savedReportId}?force=true`,
                {
                    method: "DELETE",
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to delete report");
            }

            setSuccessMessage("Report deleted successfully!");
            setSavedReportId(null);
            setIsSaved(false);

            // Refresh to get fresh calculation
            await fetchReport();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete report");
        } finally {
            setIsDeleting(false);
        }
    };

    const formatWeekRange = (start: Date, end: Date) => {
        // Format dates in Eastern timezone and extract just the date portion
        // This avoids timezone edge cases where end-of-day timestamps shift to the next day
        const getEasternDateString = (date: Date) => {
            return date.toLocaleString('en-US', {
                timeZone: 'America/New_York',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        };

        // Get the date strings in Eastern time (MM/DD/YYYY format)
        const startEastern = getEasternDateString(start);
        const endEastern = getEasternDateString(end);

        // Parse back to create clean date objects without time components
        const [startMonth, startDay, startYear] = startEastern.split('/');
        const [endMonth, endDay, endYear] = endEastern.split('/');

        const cleanStart = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay), 12, 0, 0);
        const cleanEnd = new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay), 12, 0, 0);

        const startStr = formatInEastern(cleanStart, "MMMM d");
        const endStr = formatInEastern(cleanEnd, "MMMM d, yyyy");
        return `${startStr} - ${endStr}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">
                    Weekly Profitability Analysis
                </h2>
                <p className="text-muted-foreground">
                    Analyze revenue, costs, and profitability for{" "}
                    {formatWeekRange(weekStart, weekEnd)}
                </p>
            </div>

            {/* Week Selector */}
            <WeekSelector
                weekStart={weekStart}
                weekEnd={weekEnd}
                onWeekChange={handleWeekChange}
            />

            {/* Success/Error Messages */}
            {successMessage && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Summary Cards */}
            <SummaryCards
                report={report}
                isLoading={isLoading}
                onFetchUnpurchasedRates={handleFetchUnpurchasedRates}
                isFetchingRates={isFetchingRates}
                fetchSuccessMessage={fetchSuccessMessage}
            />

            {/* Sales Breakdown - Shopify Style */}
            <SalesBreakdown
                report={report}
                isLoading={isLoading}
            />

            {/* Operating Expenses Form */}
            <OperatingExpensesForm
                report={report}
                payrollCost={payrollCost}
                useHistoricalPayroll={useHistoricalPayroll}
                marketingCostMeta={marketingCostMeta}
                marketingCostGoogle={marketingCostGoogle}
                marketingCostOther={marketingCostOther}
                onPayrollChange={handlePayrollChange}
                onMarketingChange={handleMarketingChange}
            />

            {/* Save Actions */}
            {!isLoading && report && (
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                    <div className="flex items-center gap-2">
                        {isSaved ? (
                            <>
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <span className="text-sm font-medium">Report Saved</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="h-5 w-5 text-yellow-600" />
                                <span className="text-sm font-medium">Unsaved Changes</span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {isSaved && savedReportId && (
                            <Button
                                variant="destructive"
                                onClick={() => setDeleteDialogOpen(true)}
                                disabled={isDeleting || isSaving}
                            >
                                {isDeleting ? (
                                    <>
                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </>
                                )}
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            onClick={() => handleSaveReport(false)}
                            disabled={isSaving || isDeleting}
                        >
                            {isSaving ? (
                                <>
                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Report
                                </>
                            )}
                        </Button>

                        <Button
                            onClick={() => handleSaveReport(true)}
                            disabled={isSaving || isDeleting}
                        >
                            <Lock className="mr-2 h-4 w-4" />
                            Save & Finalize
                        </Button>
                    </div>
                </div>
            )}

            {/* Historical Comparison */}
            <HistoricalComparison
                currentWeekStart={weekStart}
                limit={10}
                onLoadReport={handleLoadSaved}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Report</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this saved report? This action cannot be undone.
                            The report will be removed and a fresh calculation will be performed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteReport}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
