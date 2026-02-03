"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MonthSelector } from "./month-selector";
import { MultiCSVUploader } from "./multi-csv-uploader";
import { TransactionReview } from "./transaction-review";
import { ReconciliationView } from "./reconciliation-view";
import { MonthlyDashboard } from "./monthly-dashboard";
import { Upload, ListChecks, GitMerge, BarChart3 } from "lucide-react";
import { nowInEastern } from "@/lib/utils";

export default function MonthlyOverviewPage() {
    // Default to current month/year in Eastern Time
    const now = nowInEastern();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [activeTab, setActiveTab] = useState("upload");
    const [uploadKey, setUploadKey] = useState(0);

    const handleUploadComplete = () => {
        // Force refresh of other tabs by incrementing key
        setUploadKey((prev) => prev + 1);
    };

    const periodLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Monthly Financial Overview</h2>
                <p className="text-muted-foreground">
                    Upload and analyze all financial transactions for {periodLabel}
                </p>
            </div>

            {/* Month Selector */}
            <MonthSelector
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onMonthChange={setSelectedMonth}
                onYearChange={setSelectedYear}
                onClearComplete={handleUploadComplete}
            />

            {/* Main Content with Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload CSVs
                    </TabsTrigger>
                    <TabsTrigger value="review" className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4" />
                        Review & Categorize
                    </TabsTrigger>
                    <TabsTrigger value="reconcile" className="flex items-center gap-2">
                        <GitMerge className="h-4 w-4" />
                        Reconcile
                    </TabsTrigger>
                    <TabsTrigger value="dashboard" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Dashboard
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Upload CSVs */}
                <TabsContent value="upload" className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Upload CSV Files</h3>
                        <p className="text-sm text-muted-foreground">
                            Upload all 4 CSV exports for {periodLabel}. The system will automatically
                            detect the source and parse transactions.
                        </p>
                    </div>

                    <MultiCSVUploader
                        periodMonth={selectedMonth}
                        periodYear={selectedYear}
                        onUploadComplete={handleUploadComplete}
                    />

                    <div className="rounded-lg border p-4 bg-muted/50">
                        <h4 className="font-medium mb-2">Expected Sources:</h4>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>
                                <Badge variant="outline" className="mr-2">
                                    Rho Bank
                                </Badge>
                                Main business checking account
                            </li>
                            <li>
                                <Badge variant="outline" className="mr-2">
                                    Rho Card
                                </Badge>
                                Credit card expenses (will be reconciled with Mercury)
                            </li>
                            <li>
                                <Badge variant="outline" className="mr-2">
                                    Mercury
                                </Badge>
                                Mercury bank including Rho Card payments
                            </li>
                            <li>
                                <Badge variant="outline" className="mr-2">
                                    PayPal
                                </Badge>
                                Direct customer payments and PayPal expenses
                            </li>
                        </ul>
                    </div>
                </TabsContent>

                {/* Tab 2: Review & Categorize */}
                <TabsContent value="review" className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Review Transactions</h3>
                        <p className="text-sm text-muted-foreground">
                            Review all transactions, assign categories, mark recurring expenses, and
                            exclude internal transfers or duplicates.
                        </p>
                    </div>

                    <TransactionReview
                        key={`review-${uploadKey}`}
                        periodMonth={selectedMonth}
                        periodYear={selectedYear}
                    />
                </TabsContent>

                {/* Tab 3: Reconcile */}
                <TabsContent value="reconcile" className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Reconcile Card Payments</h3>
                        <p className="text-sm text-muted-foreground">
                            Match Rho Card expenses with Mercury "Rho Card Payment" transfers to
                            verify that card expenses are being properly funded.
                        </p>
                    </div>

                    <ReconciliationView
                        key={`reconcile-${uploadKey}`}
                        periodMonth={selectedMonth}
                        periodYear={selectedYear}
                    />
                </TabsContent>

                {/* Tab 4: Dashboard */}
                <TabsContent value="dashboard" className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold">Financial Summary</h3>
                        <p className="text-sm text-muted-foreground">
                            Overview of revenue, expenses, and cash flow for {periodLabel}
                        </p>
                    </div>

                    <MonthlyDashboard
                        key={`dashboard-${uploadKey}`}
                        periodMonth={selectedMonth}
                        periodYear={selectedYear}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
