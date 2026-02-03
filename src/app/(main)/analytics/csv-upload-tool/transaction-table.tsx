"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NormalizedTransaction, ExpenseCategory } from "@/lib/types/csv-types";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/types/csv-types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TransactionTableProps {
    transactions: NormalizedTransaction[];
    onUpdateTransaction: (id: string, updates: Partial<NormalizedTransaction>) => void;
}

export function TransactionTable({ transactions, onUpdateTransaction }: TransactionTableProps) {
    const formatCurrency = (amount: number) => {
        const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(Math.abs(amount));
        return amount < 0 ? `-${formatted}` : formatted;
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(date);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transactions ({transactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[500px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Date</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead className="text-right w-[120px]">Amount</TableHead>
                                <TableHead className="w-[180px]">Category</TableHead>
                                <TableHead className="w-[80px] text-center">Recurring</TableHead>
                                <TableHead className="w-[80px] text-center">Exclude</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((tx) => (
                                <TableRow
                                    key={tx.id}
                                    className={tx.isExcluded ? 'opacity-50' : ''}
                                >
                                    <TableCell className="text-sm">
                                        {formatDate(tx.date)}
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
                                        <span className={tx.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                                            {formatCurrency(tx.amount)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={tx.category || 'none'}
                                            onValueChange={(value) =>
                                                onUpdateTransaction(tx.id, {
                                                    category: value === 'none' ? null : value as ExpenseCategory
                                                })
                                            }
                                            disabled={tx.isExcluded}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    <span className="text-muted-foreground">No category</span>
                                                </SelectItem>
                                                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Switch
                                            checked={tx.isRecurring}
                                            onCheckedChange={(checked) =>
                                                onUpdateTransaction(tx.id, { isRecurring: checked })
                                            }
                                            disabled={tx.isExcluded}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Switch
                                            checked={tx.isExcluded}
                                            onCheckedChange={(checked) =>
                                                onUpdateTransaction(tx.id, { isExcluded: checked })
                                            }
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
