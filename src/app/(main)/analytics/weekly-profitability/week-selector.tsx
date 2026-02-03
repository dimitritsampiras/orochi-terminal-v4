"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { formatInEastern } from "@/lib/utils";

interface WeekSelectorProps {
    weekStart: Date;
    weekEnd: Date;
    onWeekChange: (start: Date, end: Date) => void;
}

export function WeekSelector({
    weekStart,
    weekEnd,
    onWeekChange,
}: WeekSelectorProps) {
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

        const startFormatted = formatInEastern(cleanStart, "MMM d");
        const endFormatted = formatInEastern(cleanEnd, "MMM d, yyyy");
        return `${startFormatted} - ${endFormatted}`;
    };

    const handlePreviousWeek = () => {
        const newStart = new Date(weekStart);
        newStart.setDate(weekStart.getDate() - 7);
        const newEnd = new Date(weekEnd);
        newEnd.setDate(weekEnd.getDate() - 7);
        onWeekChange(newStart, newEnd);
    };

    const handleNextWeek = () => {
        const newStart = new Date(weekStart);
        newStart.setDate(weekStart.getDate() + 7);
        const newEnd = new Date(weekEnd);
        newEnd.setDate(weekEnd.getDate() + 7);
        onWeekChange(newStart, newEnd);
    };

    const handleThisWeek = () => {
        const now = new Date();
        const dayOfWeek = now.getDay() || 7; // Sunday = 7
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek + 1);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        onWeekChange(monday, sunday);
    };

    const handleDateSelect = (date: Date | undefined) => {
        if (!date) return;

        // Calculate Monday of the selected week
        const dayOfWeek = date.getDay() || 7;
        const monday = new Date(date);
        monday.setDate(date.getDate() - dayOfWeek + 1);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        onWeekChange(monday, sunday);
    };

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm font-medium">Week:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handlePreviousWeek}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="min-w-[200px]">
                                    {formatWeekRange(weekStart, weekEnd)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="center">
                                <CalendarComponent
                                    mode="single"
                                    selected={weekStart}
                                    onSelect={handleDateSelect}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleNextWeek}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>

                        <Button variant="outline" onClick={handleThisWeek}>
                            This Week
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
