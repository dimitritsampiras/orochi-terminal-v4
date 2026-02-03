"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, RefreshCw, AlertCircle, ArrowRight } from "lucide-react";

interface NormalizedTransaction {
    id: string;
    date: Date;
    description: string;
    amount: number;
    vendor: string;
    type: string;
}

interface ReconciliationMatch {
    rhoCardTransaction: NormalizedTransaction;
    mercuryTransaction: NormalizedTransaction;
    confidence: "high" | "medium" | "low";
    amountDifference: number;
    dateDifference: number;
    reconciliationGroupId: string;
}

interface ReconciliationSummary {
    totalRhoCardTransactions: number;
    totalMercuryPayments: number;
    matchedCount: number;
    highConfidenceMatches: number;
    mediumConfidenceMatches: number;
    lowConfidenceMatches: number;
}

interface ReconciliationViewProps {
    periodMonth: number;
    periodYear: number;
}

const CONFIDENCE_COLORS = {
    high: "bg-green-100 text-green-700 border-green-300",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
    low: "bg-gray-100 text-gray-700 border-gray-300",
};

export function ReconciliationView({ periodMonth, periodYear }: ReconciliationViewProps) {
    const [matches, setMatches] = useState<ReconciliationMatch[]>([]);
    const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchMatches = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch(
                `/api/analytics/reconciliation?month=${periodMonth}&year=${periodYear}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch reconciliation matches");
            }

            const data = await response.json();
            setMatches(data.matches);
            setSummary(data.summary);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load matches");
        } finally {
            setIsLoading(false);
        }
    }, [periodMonth, periodYear]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const handleApplyMatches = useCallback(async () => {
        if (matches.length === 0) return;

        setIsApplying(true);
        setError(null);

        try {
            const response = await fetch("/api/analytics/reconciliation/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matches }),
            });

            if (!response.ok) {
                throw new Error("Failed to apply reconciliation");
            }

            const data = await response.json();
            setSuccessMessage(data.message);

            // Refresh matches (should be empty now)
            await fetchMatches();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to apply reconciliation");
        } finally {
            setIsApplying(false);
        }
    }, [matches, fetchMatches]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(Math.abs(amount));
    };

    const formatDate = (date: Date | string) => {
        const d = typeof date === "string" ? new Date(date) : date;
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(d);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Loading Reconciliation Matches...</CardTitle>
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
                    <CardTitle>Error Loading Matches</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">{error}</p>
                    <Button onClick={fetchMatches} className="mt-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Reconciliation Summary</CardTitle>
                            <CardDescription>
                                Match Rho Card expenses with Mercury payments
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchMatches}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {summary && (
                        <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Rho Card Expenses</p>
                                <p className="text-2xl font-bold">{summary.totalRhoCardTransactions}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Mercury Payments</p>
                                <p className="text-2xl font-bold">{summary.totalMercuryPayments}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Matches Found</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {summary.matchedCount}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Match Rate</p>
                                <p className="text-2xl font-bold">
                                    {summary.totalRhoCardTransactions > 0
                                        ? Math.round(
                                            (summary.matchedCount /
                                                summary.totalRhoCardTransactions) *
                                            100
                                        )
                                        : 0}
                                    %
                                </p>
                            </div>
                        </div>
                    )}

                    {successMessage && (
                        <Alert className="mt-4 border-green-500 bg-green-50">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription>{successMessage}</AlertDescription>
                        </Alert>
                    )}

                    {matches.length > 0 && (
                        <div className="mt-4 flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                            <div className="flex items-center gap-2">
                                <Badge className={CONFIDENCE_COLORS.high}>
                                    {summary?.highConfidenceMatches} High
                                </Badge>
                                <Badge className={CONFIDENCE_COLORS.medium}>
                                    {summary?.mediumConfidenceMatches} Medium
                                </Badge>
                                <Badge className={CONFIDENCE_COLORS.low}>
                                    {summary?.lowConfidenceMatches} Low
                                </Badge>
                            </div>
                            <Button onClick={handleApplyMatches} disabled={isApplying}>
                                {isApplying ? (
                                    <>
                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Applying...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Apply All Matches
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Matches List */}
            {matches.length === 0 ? (
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center text-muted-foreground">
                            <CheckCircle2 className="mx-auto h-12 w-12 mb-4 text-green-600" />
                            <p className="text-lg font-medium">All reconciled!</p>
                            <p className="text-sm">
                                {summary && summary.totalRhoCardTransactions === 0
                                    ? "No Rho Card transactions found for this period"
                                    : "No unreconciled matches found"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Matches ({matches.length})</CardTitle>
                        <CardDescription>
                            Review matched pairs before applying reconciliation
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[500px]">
                            <div className="space-y-3">
                                {matches.map((match, index) => (
                                    <div
                                        key={index}
                                        className="border rounded-lg p-4 space-y-3"
                                    >
                                        {/* Confidence Badge */}
                                        <div className="flex items-center justify-between">
                                            <Badge className={CONFIDENCE_COLORS[match.confidence]}>
                                                {match.confidence.toUpperCase()} CONFIDENCE
                                            </Badge>
                                            <div className="text-xs text-muted-foreground">
                                                ${match.amountDifference.toFixed(2)} diff •{" "}
                                                {match.dateDifference.toFixed(0)} days apart
                                            </div>
                                        </div>

                                        {/* Side-by-side comparison */}
                                        <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                                            {/* Rho Card Transaction */}
                                            <div className="space-y-1 bg-red-50 dark:bg-red-950/20 p-3 rounded">
                                                <div className="text-xs text-muted-foreground font-medium">
                                                    RHO CARD EXPENSE
                                                </div>
                                                <div className="font-medium">
                                                    {match.rhoCardTransaction.vendor}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {formatDate(match.rhoCardTransaction.date)}
                                                </div>
                                                <div className="text-lg font-bold text-red-600">
                                                    {formatCurrency(match.rhoCardTransaction.amount)}
                                                </div>
                                            </div>

                                            {/* Arrow */}
                                            <ArrowRight className="h-6 w-6 text-muted-foreground" />

                                            {/* Mercury Payment */}
                                            <div className="space-y-1 bg-blue-50 dark:bg-blue-950/20 p-3 rounded">
                                                <div className="text-xs text-muted-foreground font-medium">
                                                    MERCURY PAYMENT
                                                </div>
                                                <div className="font-medium">
                                                    {match.mercuryTransaction.vendor}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {formatDate(match.mercuryTransaction.date)}
                                                </div>
                                                <div className="text-lg font-bold text-blue-600">
                                                    {formatCurrency(match.mercuryTransaction.amount)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
