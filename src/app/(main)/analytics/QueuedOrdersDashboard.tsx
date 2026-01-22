
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    AlertCircle,
    AlarmClock,
    CheckCircle2,
    ArrowDownCircle,
    Truck,
    Package,
    Palette,
    Users,
    CalendarClock,
    RefreshCw
} from "lucide-react";
import {
    QueuedAnalyticsSummary,
    ShippingProgressUpdate
} from "@/lib/core/analytics/calculate-queued-analytics";
import { subDays, format } from "date-fns";

export function QueuedOrdersDashboard() {
    const [summary, setSummary] = useState<QueuedAnalyticsSummary | null>(null);
    const [shipping, setShipping] = useState<ShippingProgressUpdate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [cutoffDate, setCutoffDate] = useState<string>(
        format(subDays(new Date(), 30), "yyyy-MM-dd") // Default: 30 days ago
    );
    const [eventSource, setEventSource] = useState<EventSource | null>(null);

    const fetchAnalytics = useCallback(() => {
        // Close existing connection
        if (eventSource) {
            eventSource.close();
        }

        // Reset state
        setSummary(null);
        setShipping(null);
        setIsLoading(true);

        // Create new connection with cutoff date
        const url = cutoffDate
            ? `/api/analytics/queued?cutoff=${encodeURIComponent(cutoffDate)}`
            : "/api/analytics/queued";

        const newEventSource = new EventSource(url);

        newEventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === "SUMMARY") {
                    setSummary(payload.data);
                    setIsLoading(false);
                } else if (payload.type === "SHIPPING_PROGRESS") {
                    setShipping(payload.data);
                }
            } catch (error) {
                console.error("Error parsing analytics stream", error);
            }
        };

        newEventSource.onerror = (err) => {
            console.error("EventSource failed:", err);
            newEventSource.close();
            setIsLoading(false);
        };

        setEventSource(newEventSource);
    }, [cutoffDate]);

    useEffect(() => {
        fetchAnalytics();
        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, []); // Only run on mount

    if (!summary && isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-40 bg-muted rounded-lg"></div>
                <div className="grid grid-cols-4 gap-4">
                    <div className="h-32 bg-muted rounded-lg"></div>
                    <div className="h-32 bg-muted rounded-lg"></div>
                    <div className="h-32 bg-muted rounded-lg"></div>
                    <div className="h-32 bg-muted rounded-lg"></div>
                </div>
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Queued Orders Analytics</h2>

                {/* Date Filter */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="cutoff-date" className="text-sm text-muted-foreground whitespace-nowrap">
                            Orders after:
                        </Label>
                        <Input
                            id="cutoff-date"
                            type="date"
                            value={cutoffDate}
                            onChange={(e) => setCutoffDate(e.target.value)}
                            className="w-40"
                        />
                    </div>
                    <Button
                        onClick={fetchAnalytics}
                        size="sm"
                        variant="outline"
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* 1. Order Counts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <CountCard
                    title="Critical"
                    icon={<AlertCircle className="h-4 w-4 text-red-500" />}
                    count={summary.counts.critical.orders}
                    items={summary.counts.critical.items}
                    color="border-red-200 bg-red-50 dark:bg-red-900/10"
                />
                <CountCard
                    title="Urgent"
                    icon={<AlarmClock className="h-4 w-4 text-orange-500" />}
                    count={summary.counts.urgent.orders}
                    items={summary.counts.urgent.items}
                    color="border-orange-200 bg-orange-50 dark:bg-orange-900/10"
                />
                <CountCard
                    title="Normal"
                    icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
                    count={summary.counts.normal.orders}
                    items={summary.counts.normal.items}
                    color="border-green-200 bg-green-50 dark:bg-green-900/10"
                />
                <CountCard
                    title="Low Priority"
                    icon={<ArrowDownCircle className="h-4 w-4 text-gray-400" />}
                    count={summary.counts.low.orders}
                    items={summary.counts.low.items}
                />
            </div>

            {/* 2. Costs Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Shipping - with Progress */}
                <Card className="col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <Truck className="h-5 w-5" /> Shipping Costs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {shipping ? (
                            <>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Calculation Progress</span>
                                        <span>{shipping.processed} / {shipping.total}</span>
                                    </div>
                                    <Progress value={(shipping.processed / (shipping.total || 1)) * 100} />
                                </div>

                                <div className="text-3xl font-bold">
                                    ${shipping.currentCost.toFixed(2)}
                                </div>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-4">
                                    <RegionRow label="🇺🇸 HQ (US)" data={shipping.breakdown.domestic} />
                                    <RegionRow label="🇨🇦 CA" data={shipping.breakdown.ca} />
                                    <RegionRow label="🇬🇧 UK" data={shipping.breakdown.uk} />
                                    <RegionRow label="🇩🇪 DE" data={shipping.breakdown.de} />
                                    <RegionRow label="🇦🇺 AU" data={shipping.breakdown.au} />
                                    <RegionRow label="🌍 ROW" data={shipping.breakdown.row} />
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="animate-spin">⏳</span> Calculating shipping...
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Material & Labor Costs */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium flex items-center gap-2">
                                <Package className="h-5 w-5" /> Material Costs
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-muted-foreground">Blanks</span>
                                <span className="font-semibold">${summary.costs.blanks.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Palette className="h-3 w-3" /> Ink
                                </span>
                                <span className="font-semibold">${summary.costs.ink.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Supplementary Items</span>
                                <span className="font-semibold">${summary.costs.supplementary.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium flex items-center gap-2">
                                <Users className="h-5 w-5" /> Labor & Time
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <div>
                                    <p className="text-muted-foreground text-sm">Estimated Labor Cost</p>
                                    <p className="text-xs text-muted-foreground">
                                        (${summary.labor.costPerItem.toFixed(2)} / item)
                                    </p>
                                </div>
                                <span className="font-bold text-xl">${summary.labor.totalCost.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <CalendarClock className="h-4 w-4 text-blue-500" />
                                    <span className="text-sm text-foreground">Work Days Needed</span>
                                </div>
                                <div className="text-right">
                                    <span className="font-bold text-xl block">{Math.ceil(summary.labor.workDaysNeeded)} Days</span>
                                    <span className="text-xs text-muted-foreground">
                                        @ ~{Math.round(summary.labor.itemsPerDay)} items/day
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function CountCard({ title, icon, count, items, color }: any) {
    return (
        <Card className={`${color || "bg-card"}`}>
            <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm text-muted-foreground">{title}</span>
                    {icon}
                </div>
                <div>
                    <div className="text-2xl font-bold">{count} Orders</div>
                    <div className="text-xs text-muted-foreground mt-1">{items} items</div>
                </div>
            </CardContent>
        </Card>
    );
}

function RegionRow({ label, data }: { label: string, data: { total: number, avg: number, count: number } }) {
    if (data.count === 0) return null;
    return (
        <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">{label} ({data.count})</span>
            <div className="flex flex-col items-end">
                <span className="font-medium">${data.total.toFixed(2)}</span>
                <span className="text-[10px] text-muted-foreground">Avg: ${data.avg.toFixed(2)}</span>
            </div>
        </div>
    );
}
