/**
 * CSV Adapter Index
 * 
 * Exports all CSV adapters and provides a function to auto-detect
 * the appropriate adapter based on CSV headers.
 */

import Papa from 'papaparse';
import type { CSVAdapter, CSVParseResult, NormalizedTransaction, CSVSource } from '@/lib/types/csv-types';
export type { CSVParseResult } from '@/lib/types/csv-types';
import { rhoBankAdapter } from './rho-bank-adapter';
import { rhoCardAdapter } from './rho-card-adapter';
import { mercuryAdapter } from './mercury-adapter';
import { paypalAdapter } from './paypal-adapter';

import { wiseAdapter } from '@/lib/core/csv-adapters/wise-adapter';
import { rbcAdapter } from '@/lib/core/csv-adapters/rbc-adapter';

// Register all available adapters
const adapters: CSVAdapter[] = [
    rhoBankAdapter,
    rhoCardAdapter,
    mercuryAdapter,
    paypalAdapter,
    wiseAdapter,
    rbcAdapter,
];

/**
 * Detect the CSV source based on headers
 */
function detectSource(headers: string[]): CSVAdapter | null {
    for (const adapter of adapters) {
        if (adapter.detect(headers)) {
            return adapter;
        }
    }
    return null;
}

/**
 * Parse a CSV file and return normalized transactions
 */
export function parseCSVFile(file: File): Promise<CSVParseResult> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.warn(`[CSVAdapter] PapaParse reported errors for ${file.name}:`, results.errors);
                    // reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
                    // return;
                    // RELAXATION: Don't reject immediately on minor errors if data exists
                    if (results.data.length === 0) {
                        reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
                        return;
                    }
                }

                const headers = results.meta.fields || [];
                const data = results.data as Record<string, string>[];

                console.log(`[CSVAdapter] Parsed ${file.name}: ${data.length} rows, Headers: ${headers.length}`);

                // Auto-detect the CSV source
                const adapter = detectSource(headers);
                if (!adapter) {
                    console.error(`[CSVAdapter] Failed to detect source for ${file.name}. Headers:`, headers);
                    reject(new Error('Unknown CSV format. Please upload a supported bank export.'));
                    return;
                }

                // Refine source if adapter supports content-based resolution (e.g. RBC Bank vs Card)
                let source = adapter.source;
                if ('resolveSource' in adapter && typeof (adapter as any).resolveSource === 'function') {
                    source = (adapter as any).resolveSource(data);
                    console.log(`[CSVAdapter] Refined source for ${file.name} from ${adapter.source} to ${source}`);
                }

                // Parse using the detected adapter
                const transactions = adapter.parse(data);

                // Calculate summary stats
                const dates = transactions.map(t => t.date.getTime());
                const expenses = transactions.filter(t => t.type === 'expense' && !t.isExcluded);
                const income = transactions.filter(t => t.type === 'income' && !t.isExcluded);

                resolve({
                    transactions,
                    source,
                    dateRange: {
                        start: new Date(Math.min(...dates)),
                        end: new Date(Math.max(...dates)),
                    },
                    totalIncome: income.reduce((sum, t) => sum + t.amount, 0),
                    totalExpenses: Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0)),
                });
            },
            error: (error) => {
                reject(new Error(`Failed to parse CSV: ${error.message}`));
            },
        });
    });
}

/**
 * Aggregate transactions by vendor
 */
export function aggregateByVendor(transactions: NormalizedTransaction[]) {
    const vendorMap = new Map<string, {
        vendor: string;
        totalAmount: number;
        transactionCount: number;
        category: string | null;
        isRecurring: boolean;
        transactions: NormalizedTransaction[];
    }>();

    for (const tx of transactions) {
        if (tx.isExcluded) continue;

        const existing = vendorMap.get(tx.vendor);
        if (existing) {
            existing.totalAmount += tx.amount;
            existing.transactionCount += 1;
            existing.transactions.push(tx);
            // Use the most common category
            if (tx.category && !existing.category) {
                existing.category = tx.category;
            }
        } else {
            vendorMap.set(tx.vendor, {
                vendor: tx.vendor,
                totalAmount: tx.amount,
                transactionCount: 1,
                category: tx.category,
                isRecurring: tx.isRecurring,
                transactions: [tx],
            });
        }
    }

    return Array.from(vendorMap.values()).sort((a, b) => a.totalAmount - b.totalAmount);
}

/**
 * Aggregate transactions by category
 */
export function aggregateByCategory(transactions: NormalizedTransaction[]) {
    const categoryMap = new Map<string, number>();

    for (const tx of transactions) {
        if (tx.isExcluded || tx.type !== 'expense') continue;

        const category = tx.category || 'other';
        const existing = categoryMap.get(category) || 0;
        categoryMap.set(category, existing + Math.abs(tx.amount));
    }

    return Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
}

export { rhoBankAdapter, rhoCardAdapter, mercuryAdapter, paypalAdapter };
