"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { NormalizedTransaction, ExpenseCategory } from "@/lib/types/csv-types";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/types/csv-types";
import { aggregateByVendor, aggregateByCategory } from "@/lib/core/csv-adapters";

interface VendorSummaryProps {
    transactions: NormalizedTransaction[];
}

const COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#6b7280', // gray
];

export function VendorSummary({ transactions }: VendorSummaryProps) {
    const vendorData = aggregateByVendor(transactions);
    const categoryData = aggregateByCategory(transactions);

    // Only show expenses for vendor table
    const expenseVendors = vendorData.filter(v => v.totalAmount < 0);
    const totalExpenses = Math.abs(expenseVendors.reduce((sum, v) => sum + v.totalAmount, 0));

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(Math.abs(amount));
    };

    const pieData = categoryData.map((item, index) => ({
        name: EXPENSE_CATEGORY_LABELS[item.category as ExpenseCategory] || 'Other',
        value: item.amount,
        color: COLORS[index % COLORS.length],
    }));

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {/* Vendor Breakdown Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Expenses by Vendor</CardTitle>
                </CardHeader>
                <CardContent>
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
                            {expenseVendors.map((vendor) => {
                                const percentage = ((Math.abs(vendor.totalAmount) / totalExpenses) * 100).toFixed(1);
                                return (
                                    <TableRow key={vendor.vendor}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{vendor.vendor}</span>
                                                {vendor.category && (
                                                    <Badge variant="outline" className="w-fit text-xs mt-1">
                                                        {EXPENSE_CATEGORY_LABELS[vendor.category as ExpenseCategory]}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {formatCurrency(vendor.totalAmount)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary">{percentage}%</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {vendor.transactionCount}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            <TableRow className="font-bold border-t-2">
                                <TableCell>Total Expenses</TableCell>
                                <TableCell className="text-right font-mono">
                                    {formatCurrency(totalExpenses)}
                                </TableCell>
                                <TableCell className="text-right">100%</TableCell>
                                <TableCell className="text-center">
                                    {expenseVendors.reduce((sum, v) => sum + v.transactionCount, 0)}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
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
                                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => formatCurrency(Number(value))}
                                />
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
    );
}
