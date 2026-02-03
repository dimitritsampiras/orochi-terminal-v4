"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Calendar, Trash2 } from "lucide-react";
import { useState } from "react";

interface MonthSelectorProps {
    selectedMonth: number;
    selectedYear: number;
    onMonthChange: (month: number) => void;
    onYearChange: (year: number) => void;
}

const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
];

// Generate years from 2020 to current year + 1
const currentYear = new Date().getFullYear();
const YEARS = Array.from(
    { length: currentYear - 2020 + 2 },
    (_, i) => 2020 + i
);

export function MonthSelector({
    selectedMonth,
    selectedYear,
    onMonthChange,
    onYearChange,
    onClearComplete,
}: MonthSelectorProps & { onClearComplete?: () => void }) {
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    const handleClear = async () => {
        setIsClearing(true);
        try {
            const response = await fetch(
                `/api/analytics/csv-transactions?month=${selectedMonth}&year=${selectedYear}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                throw new Error("Failed to clear transactions");
            }

            setShowClearConfirm(false);
            onClearComplete?.();
        } catch (error) {
            console.error("Failed to clear transactions:", error);
            // Ideally trigger a toast here
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <Card>
            <CardContent className="flex items-center p-6 gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">Period:</span>
                </div>

                <Select
                    value={selectedMonth.toString()}
                    onValueChange={(value) => onMonthChange(parseInt(value))}
                >
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                        {MONTHS.map((month) => (
                            <SelectItem key={month.value} value={month.value.toString()}>
                                {month.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) => onYearChange(parseInt(value))}
                >
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                        {YEARS.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                                {year}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex-1" />

                <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setShowClearConfirm(true)}
                    title="Clear all transactions for this month"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>


                <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Clear All Transactions?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete ALL transactions for{" "}
                                {MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear}?
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleClear();
                                }}
                                disabled={isClearing}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {isClearing ? "Clearing..." : "Delete All"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card >
    );
}
