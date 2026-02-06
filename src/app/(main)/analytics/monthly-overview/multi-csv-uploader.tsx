"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { parseCSVFile } from "@/lib/core/csv-adapters";
import type { CSVSource } from "@/lib/types/csv-types";

interface SourceConfig {
    source: CSVSource;
    allowedSources?: CSVSource[];
    title: string;
    description: string;
}

const SOURCES: SourceConfig[] = [
    {
        source: "rho_bank", // Primary ID (used for UI state key)
        allowedSources: ["rho_bank", "rho_credit_card"],
        title: "Rho (Bank & Card)",
        description: "Upload all Rho exports here. We'll sort them automatically.",
    },
    {
        source: "mercury",
        allowedSources: ["mercury"],
        title: "Mercury",
        description: "Mercury bank account including card payments",
    },
    {
        source: "paypal",
        allowedSources: ["paypal"],
        title: "PayPal",
        description: "PayPal income and expenses",
    },
    {
        source: "wise",
        allowedSources: ["wise"],
        title: "Wise",
        description: "International payments and transfers",
    },
    {
        source: "rbc_bank", // Primary ID
        allowedSources: ["rbc_bank", "rbc_card"],
        title: "RBC (Bank & Card)",
        description: "Upload all RBC exports here (CAD/USD, Chequing/Visa).",
    },
];

interface UploadStatus {
    source: CSVSource;
    status: "idle" | "processing" | "success" | "error";
    message?: string;
    count?: number;
}

interface MultiCSVUploaderProps {
    periodMonth: number;
    periodYear: number;
    onUploadComplete?: () => void;
}

export function MultiCSVUploader({
    periodMonth,
    periodYear,
    onUploadComplete,
}: MultiCSVUploaderProps) {
    const [uploadStatuses, setUploadStatuses] = useState<Record<CSVSource, UploadStatus>>({
        rho_bank: { source: "rho_bank", status: "idle" },
        rho_credit_card: { source: "rho_credit_card", status: "idle" },
        mercury: { source: "mercury", status: "idle" },
        paypal: { source: "paypal", status: "idle" },
        wise: { source: "wise", status: "idle" },
        rbc_bank: { source: "rbc_bank", status: "idle" },
        rbc_card: { source: "rbc_card", status: "idle" },
        unknown: { source: "unknown", status: "idle" },
    });

    const [confirmReplace, setConfirmReplace] = useState<{
        source: CSVSource;
        files: FileList | File[];
        existingCount: number;
    } | null>(null);

    const updateStatus = useCallback((source: CSVSource, update: Partial<UploadStatus>) => {
        setUploadStatuses((prev) => ({
            ...prev,
            [source]: { ...prev[source], ...update },
        }));
    }, []);

    const handleFileSelect = useCallback(
        async (source: CSVSource, files: FileList | File[], replace = false) => {
            if (files.length === 0) return;

            updateStatus(source, { status: "processing", message: `Parsing ${files.length} file(s)...` });
            console.log(`[MultiUploader] Received ${files.length} files for source ${source}`);

            try {
                // Group transactions by source
                const transactionsBySource = new Map<CSVSource, any[]>();
                let totalParsed = 0;

                // Process each file
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    console.log(`[MultiUploader] Processing file ${i + 1}/${files.length}: ${file.name} (${file.size} bytes)`);

                    try {
                        const parseResult = await parseCSVFile(file);

                        // Find config for this drop zone
                        const config = SOURCES.find(s => s.source === source);
                        const allowed = config?.allowedSources || [source];

                        if (!allowed.includes(parseResult.source)) {
                            console.warn(`[MultiUploader] Skipping ${file.name}: Detected as ${parseResult.source}, expected one of ${allowed.join(', ')}`);
                            continue;
                        }

                        const currentList = transactionsBySource.get(parseResult.source) || [];
                        currentList.push(...parseResult.transactions);
                        transactionsBySource.set(parseResult.source, currentList);

                        totalParsed++;
                    } catch (err) {
                        console.error(`[MultiUploader] Failed to parse file ${file.name}:`, err);
                    }
                }

                if (transactionsBySource.size === 0) {
                    throw new Error("No valid files found or parsed.");
                }

                updateStatus(source, { message: `Uploading batches for ${transactionsBySource.size} sources...` });

                let totalInserted = 0;
                let messages: string[] = [];

                // Upload for each detected source
                // We use a loop to handle each source type separately (e.g. rho_bank separate from rho_credit_card)
                for (const [detectedSource, transactions] of Array.from(transactionsBySource.entries())) {
                    console.log(`[MultiUploader] Uploading ${transactions.length} transactions for ${detectedSource}`);

                    const response = await fetch("/api/analytics/csv-transactions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            periodMonth,
                            periodYear,
                            source: detectedSource, // Use the detected source (e.g. rho_credit_card)
                            transactions: transactions,
                            replace,
                        }),
                    });

                    const data = await response.json();

                    if (response.status === 409) {
                        setConfirmReplace({
                            source: detectedSource,
                            files: Array.from(files),
                            existingCount: data.existingCount || 0,
                        });

                        updateStatus(source, {
                            status: "idle",
                            message: `Existing data found for ${detectedSource}. Please confirm replacement.`
                        });
                        return; // Stop processing to wait for user input
                    }

                    if (!response.ok) {
                        throw new Error(data.error || `Upload failed for ${detectedSource}`);
                    }

                    if (data.success) {
                        totalInserted += (data.inserted || 0);
                        messages.push(`${detectedSource}: +${data.inserted}`);
                    }
                }

                updateStatus(source, {
                    status: "success",
                    message: `Success! ${messages.join(', ')}`,
                    count: totalInserted,
                });

                // Call parent callback
                onUploadComplete?.();
            } catch (error) {
                updateStatus(source, {
                    status: "error",
                    message: error instanceof Error ? error.message : "Upload failed",
                });
            }
        },
        [periodMonth, periodYear, updateStatus, onUploadComplete]
    );

    const handleConfirmReplace = useCallback(() => {
        if (confirmReplace) {
            handleFileSelect(confirmReplace.source, confirmReplace.files, true);
            setConfirmReplace(null);
        }
    }, [confirmReplace, handleFileSelect]);

    const handleFileInput = useCallback(
        (source: CSVSource, e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                // Convert FileList to Array to prevent it from being cleared when we reset the input
                const fileArray = Array.from(files);
                handleFileSelect(source, fileArray);
            }
            // Reset input
            e.target.value = "";
        },
        [handleFileSelect]
    );

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2">
                {SOURCES.map((config) => {
                    const status = uploadStatuses[config.source];

                    return (
                        <Card
                            key={config.source}
                            className={
                                status.status === "success"
                                    ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
                                    : status.status === "error"
                                        ? "border-destructive"
                                        : ""
                            }
                        >
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="flex items-center gap-2">
                                            {config.title}
                                            {status.status === "success" && (
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            )}
                                            {status.status === "error" && (
                                                <AlertCircle className="h-5 w-5 text-destructive" />
                                            )}
                                        </CardTitle>
                                        <CardDescription>{config.description}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {status.message && (
                                    <Alert
                                        variant={
                                            status.status === "error"
                                                ? "destructive"
                                                : status.status === "success"
                                                    ? "default"
                                                    : "default"
                                        }
                                    >
                                        <AlertDescription className="text-sm">
                                            {status.message}
                                            {status.count && ` (${status.count} transactions)`}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="flex gap-2">
                                    <Button
                                        variant={status.status === "success" ? "outline" : "default"}
                                        className="flex-1"
                                        onClick={() =>
                                            document.getElementById(`file-input-${config.source}`)?.click()
                                        }
                                        disabled={status.status === "processing"}
                                    >
                                        <input
                                            id={`file-input-${config.source}`}
                                            type="file"
                                            accept=".csv"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => handleFileInput(config.source, e)}
                                        />
                                        {status.status === "processing" ? (
                                            <>
                                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                Processing...
                                            </>
                                        ) : status.status === "success" ? (
                                            <>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Re-upload
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="mr-2 h-4 w-4" />
                                                Select CSV(s)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Confirmation Dialog for Replace */}
            <AlertDialog open={!!confirmReplace} onOpenChange={() => setConfirmReplace(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Replace Existing Data?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmReplace &&
                                `You've already uploaded ${confirmReplace.existingCount} ${confirmReplace.source} transactions for ${new Date(
                                    periodYear,
                                    periodMonth - 1
                                ).toLocaleDateString("en-US", {
                                    month: "long",
                                    year: "numeric",
                                })}. `}
                            Uploading will archive the existing data (it will be preserved for audit trail)
                            and replace it with the new upload.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmReplace}>
                            Archive & Upload New Data
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
