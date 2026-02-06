"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CSVDropzone } from "./csv-dropzone";
import { TransactionTable } from "./transaction-table";
import { VendorSummary } from "./vendor-summary";
import { parseCSVFile, type CSVParseResult } from "@/lib/core/csv-adapters";
import type { NormalizedTransaction } from "@/lib/types/csv-types";
import { DollarSign, TrendingUp, TrendingDown, FileSpreadsheet } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
    rho_bank: 'Rho Bank',
    rho_credit_card: 'Rho Credit Card',
    wise: 'Wise',
    paypal: 'PayPal',
    mercury: 'Mercury',
    unknown: 'Unknown',
};

export default function CSVUploadToolPage() {
    const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
    const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = useCallback(async (file: File) => {
        setIsProcessing(true);
        setError(null);

        try {
            const result = await parseCSVFile(file);
            setParseResult(result);
            setTransactions(result.transactions);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse CSV');
            setParseResult(null);
            setTransactions([]);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const handleUpdateTransaction = useCallback((id: string, updates: Partial<NormalizedTransaction>) => {
        setTransactions(prev =>
            prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx)
        );
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(Math.abs(amount));
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(date);
    };

    // Calculate current totals based on user modifications
    const currentTotals = transactions.reduce(
        (acc, tx) => {
            if (tx.isExcluded) return acc;
            if (tx.type === 'income') {
                acc.income += tx.amount;
            } else {
                acc.expenses += Math.abs(tx.amount);
            }
            return acc;
        },
        { income: 0, expenses: 0 }
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">CSV Expense Analyzer</h2>
                <p className="text-muted-foreground">
                    Upload bank exports to analyze expenses by vendor and category
                </p>
            </div>

            <CSVDropzone onFileSelect={handleFileSelect} isProcessing={isProcessing} />

            {error && (
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <p className="text-destructive">{error}</p>
                    </CardContent>
                </Card>
            )}

            {parseResult && (
                <>
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Source</CardTitle>
                                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {SOURCE_LABELS[parseResult.source]}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {formatDate(parseResult.dateRange.start)} - {formatDate(parseResult.dateRange.end)}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(currentTotals.income)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {transactions.filter(t => t.type === 'income' && !t.isExcluded).length} transactions
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                                <TrendingDown className="h-4 w-4 text-red-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    {formatCurrency(currentTotals.expenses)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {transactions.filter(t => t.type === 'expense' && !t.isExcluded).length} transactions
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${currentTotals.income - currentTotals.expenses >= 0
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }`}>
                                    {formatCurrency(currentTotals.income - currentTotals.expenses)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {transactions.filter(t => t.isExcluded).length} excluded
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabs for different views */}
                    <Tabs defaultValue="summary" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="summary">Summary</TabsTrigger>
                            <TabsTrigger value="transactions">
                                All Transactions
                                <Badge variant="secondary" className="ml-2">
                                    {transactions.length}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="summary" className="space-y-4">
                            <VendorSummary transactions={transactions} />
                        </TabsContent>

                        <TabsContent value="transactions">
                            <TransactionTable
                                transactions={transactions}
                                onUpdateTransaction={handleUpdateTransaction}
                            />
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}
