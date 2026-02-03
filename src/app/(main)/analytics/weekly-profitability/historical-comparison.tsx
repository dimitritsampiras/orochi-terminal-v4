"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, RefreshCw, History, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
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

interface HistoricalReport {
    id: string;
    week: {
        start: Date;
        end: Date;
        weekNumber: number;
        year: number;
    };
    revenue: {
        gross: number;
        net: number;
    };
    costs: {
        fulfillment: number;
        operating: number;
        total: number;
    };
    profitability: {
        grossProfit: number;
        profitMargin: number;
    };
    metadata: {
        itemsFulfilled: number;
        ordersFulfilled: number;
        isFinalized: boolean;
        finalizedAt: Date | null;
    };
    createdAt: Date;
}

interface HistoricalComparisonProps {
    currentWeekStart: Date;
    limit?: number;
    onLoadReport?: (reportId: string, weekStart: Date, weekEnd: Date) => void;
}

export function HistoricalComparison({
    currentWeekStart,
    limit = 10,
    onLoadReport,
}: HistoricalComparisonProps) {
    const [reports, setReports] = useState<HistoricalReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [reportToDelete, setReportToDelete] = useState<{ id: string; weekRange: string } | null>(null);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/analytics/weekly-profitability/history?limit=${limit}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch history");
            }

            const data = await response.json();
            setReports(data.reports);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load history");
        } finally {
            setIsLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory, currentWeekStart]); // Refresh when week changes

    const openDeleteDialog = (reportId: string, weekRange: string) => {
        setReportToDelete({ id: reportId, weekRange });
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!reportToDelete) return;

        setDeletingId(reportToDelete.id);
        setDeleteDialogOpen(false);

        try {
            const response = await fetch(
                `/api/analytics/weekly-profitability/${reportToDelete.id}?force=true`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to delete report");
            }

            toast.success("Report deleted successfully");
            // Remove from local state
            setReports(prev => prev.filter(r => r.id !== reportToDelete.id));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete report");
        } finally {
            setDeletingId(null);
            setReportToDelete(null);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatWeekRange = (start: Date, end: Date) => {
        // Use Eastern timezone to ensure consistent date display
        // This prevents the end date from shifting to the next day due to UTC conversion
        const startStr = new Date(start).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "America/New_York",
        });
        const endStr = new Date(end).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "America/New_York",
        });
        return `${startStr} - ${endStr}`;
    };

    const getTrendIcon = (current: number, previous: number) => {
        if (current > previous) {
            return <TrendingUp className="h-4 w-4 text-green-600" />;
        } else if (current < previous) {
            return <TrendingDown className="h-4 w-4 text-red-600" />;
        }
        return null;
    };

    const getTrendPercent = (current: number, previous: number) => {
        if (previous === 0) return null;
        const change = ((current - previous) / previous) * 100;
        return change;
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Historical Comparison
                    </CardTitle>
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
                    <CardTitle>Error Loading History</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">{error}</p>
                    <Button onClick={fetchHistory} className="mt-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (reports.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Historical Comparison
                    </CardTitle>
                    <CardDescription>No saved reports yet</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Save your first weekly report to see historical trends</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Historical Comparison
                        </CardTitle>
                        <CardDescription>
                            Past {reports.length} weeks of profitability data
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchHistory}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Week</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Costs</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                            <TableHead className="text-center">Items</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.map((report, index) => {
                            const previousReport = reports[index + 1];
                            const revenueTrend = previousReport
                                ? getTrendPercent(report.revenue.net, previousReport.revenue.net)
                                : null;
                            const profitTrend = previousReport
                                ? getTrendPercent(
                                    report.profitability.grossProfit,
                                    previousReport.profitability.grossProfit
                                )
                                : null;

                            return (
                                <TableRow key={report.id}>
                                    <TableCell className="font-medium">
                                        {formatWeekRange(
                                            report.week.start,
                                            report.week.end
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        <div className="flex items-center justify-end gap-1">
                                            {formatCurrency(report.revenue.net)}
                                            {previousReport &&
                                                getTrendIcon(
                                                    report.revenue.net,
                                                    previousReport.revenue.net
                                                )}
                                        </div>
                                        {revenueTrend !== null && (
                                            <div
                                                className={`text-xs ${revenueTrend > 0
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                    }`}
                                            >
                                                {revenueTrend > 0 ? "+" : ""}
                                                {revenueTrend.toFixed(1)}%
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {formatCurrency(report.costs.total)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        <div className="flex items-center justify-end gap-1">
                                            <span
                                                className={
                                                    report.profitability.grossProfit >= 0
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                }
                                            >
                                                {formatCurrency(
                                                    report.profitability.grossProfit
                                                )}
                                            </span>
                                            {previousReport &&
                                                getTrendIcon(
                                                    report.profitability.grossProfit,
                                                    previousReport.profitability.grossProfit
                                                )}
                                        </div>
                                        {profitTrend !== null && (
                                            <div
                                                className={`text-xs ${profitTrend > 0
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                    }`}
                                            >
                                                {profitTrend > 0 ? "+" : ""}
                                                {profitTrend.toFixed(1)}%
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge
                                            variant={
                                                report.profitability.profitMargin >= 25
                                                    ? "default"
                                                    : report.profitability.profitMargin >= 15
                                                        ? "secondary"
                                                        : "destructive"
                                            }
                                        >
                                            {report.profitability.profitMargin.toFixed(1)}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {report.metadata.itemsFulfilled}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {report.metadata.isFinalized ? (
                                            <Badge variant="outline" className="bg-green-50">
                                                Finalized
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline">Draft</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {onLoadReport && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                                    onClick={() => onLoadReport(
                                                        report.id,
                                                        new Date(report.week.start),
                                                        new Date(report.week.end)
                                                    )}
                                                    title="Load this report"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                onClick={() => openDeleteDialog(
                                                    report.id,
                                                    formatWeekRange(report.week.start, report.week.end)
                                                )}
                                                disabled={deletingId === report.id}
                                            >
                                                {deletingId === report.id ? (
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Report</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the report for{" "}
                            <span className="font-semibold">{reportToDelete?.weekRange}</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
