"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Filter, AlertCircle } from "lucide-react";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/types/csv-types";

interface Transaction {
    id: string;
    transactionDate: string;
    vendor: string;
    description: string;
    amount: string;
    currency: string;
    transactionType: string;
    category: string | null;
    isExcluded: boolean;
    isRecurring: boolean;
    source: string;
}

interface TransactionReviewProps {
    periodMonth: number;
    periodYear: number;
}

const SOURCE_LABELS: Record<string, string> = {
    rho_bank: "Rho Bank",
    rho_credit_card: "Rho Card",
    mercury: "Mercury",
    paypal: "PayPal",
    wise: "Wise", // Added Wise as it appeared in directory list
};

export function TransactionReview({ periodMonth, periodYear }: TransactionReviewProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "income" | "expense" | "internal">("all");
    const [viewMode, setViewMode] = useState<"transaction" | "vendor">("transaction");

    const filteredTransactions = transactions.filter((tx) => {
        // "Internal" tab logic: Show explicit filtered transfers OR known internal category
        if (filter === "internal") {
            return (
                tx.transactionType === "transfer" ||
                tx.category === "internal_transfer"
            );
        }

        // "Income" tab logic: Show income, BUT exclude internal transfers
        if (filter === "income") {
            return (
                tx.transactionType === "income" &&
                tx.category !== "internal_transfer"
            );
        }

        // "Expense" tab logic: Show expense, BUT exclude internal transfers
        if (filter === "expense") {
            return (
                tx.transactionType === "expense" &&
                tx.category !== "internal_transfer"
            );
        }

        return true;
    });

    // Vendor Aggregation Logic (Now respects filter)
    const vendorStats = filteredTransactions.reduce((acc, tx) => {
        if (!acc[tx.vendor]) {
            acc[tx.vendor] = {
                vendor: tx.vendor,
                count: 0,
                totalAmount: 0,
                transactions: [],
                categories: {},
                recurringCount: 0,
                excludedCount: 0,
                currency: tx.currency, // Capture currency
            };
        }
        const vendor = acc[tx.vendor];
        vendor.count++;
        // TODO: Handle multi-currency summation better. For now simple sum.
        vendor.totalAmount += parseFloat(tx.amount);
        vendor.transactions.push(tx);

        if (tx.category) {
            vendor.categories[tx.category] = (vendor.categories[tx.category] || 0) + 1;
        }
        if (tx.isRecurring) vendor.recurringCount++;
        if (tx.isExcluded) vendor.excludedCount++;

        return acc;
    }, {} as Record<string, {
        vendor: string;
        count: number;
        totalAmount: number;
        transactions: Transaction[];
        categories: Record<string, number>;
        recurringCount: number;
        excludedCount: number;
        currency: string;
    }>);

    const vendorList = Object.values(vendorStats).map(v => {
        // Determine most common category
        let mostCommonCategory: string | null = null;
        let maxCount = 0;
        Object.entries(v.categories).forEach(([cat, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostCommonCategory = cat;
            }
        });

        return {
            ...v,
            commonCategory: mostCommonCategory,
            isRecurring: v.recurringCount > v.count / 2, // If more than half are recurring
            isExcluded: v.excludedCount === v.count, // If ALL are excluded
        };
    }).sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount));

    // Validation Check: Sum of totals
    const transactionsTotal = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const vendorTotal = vendorList.reduce((sum, v) => sum + v.totalAmount, 0);
    const isSumMismatch = Math.abs(transactionsTotal - vendorTotal) > 0.01; // Allow small float drift

    const fetchTransactions = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/analytics/csv-transactions?month=${periodMonth}&year=${periodYear}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch transactions");
            }

            const data = await response.json();
            setTransactions(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load transactions");
        } finally {
            setIsLoading(false);
        }
    }, [periodMonth, periodYear]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const handleUpdateTransaction = useCallback(
        async (id: string, updates: Partial<Transaction>) => {
            try {
                const response = await fetch(`/api/analytics/csv-transactions/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates),
                });

                if (!response.ok) {
                    throw new Error("Failed to update transaction");
                }

                const updatedTransaction = await response.json();

                // Update local state
                setTransactions((prev) =>
                    prev.map((tx) =>
                        tx.id === id ? { ...tx, ...updatedTransaction } : tx
                    )
                );
            } catch (err) {
                console.error("Failed to update transaction:", err);
            }
        },
        []
    );

    const handleBulkUpdate = useCallback(
        async (transactionIds: string[], updates: Partial<Transaction>) => {
            try {
                const response = await fetch(`/api/analytics/csv-transactions`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        transactionIds,
                        updates: {
                            category: updates.category,
                            isRecurring: updates.isRecurring,
                            isExcluded: updates.isExcluded,
                        }
                    }),
                });

                if (!response.ok) {
                    throw new Error("Failed to bulk update transactions");
                }

                // Optimistically update local state
                setTransactions((prev) =>
                    prev.map((tx) =>
                        transactionIds.includes(tx.id) ? { ...tx, ...updates } : tx
                    )
                );
            } catch (err) {
                console.error("Failed to bulk update transactions:", err);
            }
        },
        []
    );

    const formatCurrency = (amount: string, currencyCode: string = "USD") => {
        const num = parseFloat(amount);
        try {
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currencyCode,
            }).format(Math.abs(num));
            return num < 0 ? `-${formatted}` : formatted;
        } catch (e) {
            // Fallback for invalid currency codes
            return `${currencyCode} ${num.toFixed(2)}`;
        }
    };

    const formatDate = (dateStr: string) => {
        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(new Date(dateStr));
    };



    const stats = {
        total: transactions.length,
        income: transactions.filter((tx) => tx.transactionType === "income").length,
        expense: transactions.filter((tx) => tx.transactionType === "expense").length,
        internal: transactions.filter((tx) => tx.transactionType === "transfer" || tx.category === "internal_transfer").length,
        excluded: transactions.filter((tx) => tx.isExcluded).length,
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Loading Transactions...</CardTitle>
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
                    <CardTitle>Error Loading Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-destructive">{error}</p>
                    <Button onClick={fetchTransactions} className="mt-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (transactions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No Transactions</CardTitle>
                    <CardDescription>
                        Upload CSV files to start reviewing transactions
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
                        <CardDescription>
                            Review and categorize all transactions for this period
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-secondary p-1 rounded-md">
                            <Button
                                variant={viewMode === "transaction" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("transaction")}
                                className="h-7 text-xs"
                            >
                                Conversations
                            </Button>
                            <Button
                                variant={viewMode === "vendor" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("vendor")}
                                className="h-7 text-xs"
                            >
                                Vendors
                            </Button>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchTransactions}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {isSumMismatch && (
                    <div className="bg-destructive/15 border-destructive text-destructive px-4 py-3 rounded-md flex items-center gap-2 mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                            Validation Error: Vendor totals (${vendorTotal.toFixed(2)}) do not match transaction total (${transactionsTotal.toFixed(2)})
                        </span>
                    </div>
                )}

                {/* Filter Tabs */}
                <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                    <TabsList>
                        <TabsTrigger value="all">
                            All
                            <Badge variant="secondary" className="ml-2">
                                {stats.total}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="income">
                            Income
                            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                                {stats.income}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="expense">
                            Expenses
                            <Badge variant="secondary" className="ml-2 bg-red-100 text-red-700">
                                {stats.expense}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Transaction Table */}
                <ScrollArea className="h-[600px]">
                    {viewMode === "transaction" ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Date</TableHead>
                                    <TableHead className="w-[100px]">Source</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead className="text-right w-[120px]">Amount</TableHead>
                                    <TableHead className="w-[180px]">Category</TableHead>
                                    <TableHead className="w-[80px] text-center">Recurring</TableHead>
                                    <TableHead className="w-[80px] text-center">Exclude</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTransactions.map((tx) => (
                                    <TableRow
                                        key={tx.id}
                                        className={tx.isExcluded ? "opacity-50" : ""}
                                    >
                                        <TableCell className="text-sm">
                                            {formatDate(tx.transactionDate)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {SOURCE_LABELS[tx.source]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{tx.vendor}</span>
                                                {tx.description !== tx.vendor && (
                                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {tx.description}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            <span
                                                className={
                                                    tx.transactionType === "income"
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                }
                                            >
                                                {formatCurrency(tx.amount, tx.currency)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={tx.category || "none"}
                                                onValueChange={(value) =>
                                                    handleUpdateTransaction(tx.id, {
                                                        category: value === "none" ? null : value,
                                                    })
                                                }
                                                disabled={tx.isExcluded}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">
                                                        <span className="text-muted-foreground">
                                                            No category
                                                        </span>
                                                    </SelectItem>
                                                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(
                                                        ([value, label]) => (
                                                            <SelectItem key={value} value={value}>
                                                                {label}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={tx.isRecurring}
                                                onCheckedChange={(checked) =>
                                                    handleUpdateTransaction(tx.id, {
                                                        isRecurring: checked,
                                                    })
                                                }
                                                disabled={tx.isExcluded}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={tx.isExcluded}
                                                onCheckedChange={(checked) =>
                                                    handleUpdateTransaction(tx.id, {
                                                        isExcluded: checked,
                                                    })
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead className="text-center">Transactions</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                    <TableHead className="w-[180px]">Category</TableHead>
                                    <TableHead className="w-[80px] text-center">Recurring</TableHead>
                                    <TableHead className="w-[80px] text-center">Exclude</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vendorList.map((vendor) => (
                                    <TableRow
                                        key={vendor.vendor}
                                        className={vendor.isExcluded ? "opacity-50" : ""}
                                    >
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{vendor.vendor}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">
                                                {vendor.count}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            <span
                                                className={
                                                    vendor.totalAmount > 0
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                }
                                            >
                                                {formatCurrency(vendor.totalAmount.toString(), vendor.currency)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={vendor.commonCategory || "none"}
                                                onValueChange={(value) =>
                                                    handleBulkUpdate(
                                                        vendor.transactions.map(t => t.id),
                                                        { category: value === "none" ? null : value }
                                                    )
                                                }
                                                disabled={vendor.isExcluded}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">
                                                        <span className="text-muted-foreground">
                                                            Mixed/None
                                                        </span>
                                                    </SelectItem>
                                                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(
                                                        ([value, label]) => (
                                                            <SelectItem key={value} value={value}>
                                                                {label}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={vendor.isRecurring}
                                                onCheckedChange={(checked) =>
                                                    handleBulkUpdate(
                                                        vendor.transactions.map(t => t.id),
                                                        { isRecurring: checked }
                                                    )
                                                }
                                                disabled={vendor.isExcluded}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={vendor.isExcluded}
                                                onCheckedChange={(checked) =>
                                                    handleBulkUpdate(
                                                        vendor.transactions.map(t => t.id),
                                                        { isExcluded: checked }
                                                    )
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )
                    }
                </ScrollArea >
            </CardContent >
        </Card >
    );
}
