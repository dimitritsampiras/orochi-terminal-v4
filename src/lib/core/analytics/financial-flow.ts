/**
 * Financial Flow Analysis
 * 
 * Aggregates transactions from multiple sources to calculate true revenue,
 * true burn, and cash flow by correctly handling transfers between accounts.
 */

import type { NormalizedTransaction, ExpenseCategory } from '@/lib/types/csv-types';

export interface FinancialSummary {
    totalRevenue: Record<string, number>;
    totalExpenses: Record<string, number>;
    netCashFlow: Record<string, number>;
    burnRate: Record<string, number>; // Operating expenses
    transfers: {
        source: string;
        destination: string;
        amount: number;
        currency: string;
        date: Date;
    }[];
    categoryBreakdown: Record<ExpenseCategory | 'uncategorized', Record<string, number>>;
}

/**
 * Consolidates transactions from all sources and removes internal transfers
 * to show the true financial picture.
 */
export function analyzeFinancialFlow(transactions: NormalizedTransaction[]): FinancialSummary {
    const totalRevenue: Record<string, number> = {};
    const totalExpenses: Record<string, number> = {};
    const netCashFlow: Record<string, number> = {};
    const categoryBreakdown: Record<string, Record<string, number>> = {};

    // transfers array
    const transfers: Array<{ source: string; destination: string; amount: number; currency: string; date: Date }> = [];

    // Helper to safely add
    const add = (record: Record<string, number>, currency: string, amount: number) => {
        record[currency] = (record[currency] || 0) + amount;
    };

    for (const tx of transactions) {
        if (tx.isExcluded) continue;
        const currency = tx.currency || 'USD';

        // Skip internal transfers for revenue/expense calculation
        if (tx.type === 'transfer' || tx.category === 'internal_transfer') {
            transfers.push({
                source: tx.amount < 0 ? 'Source Account' : 'External',
                destination: tx.amount > 0 ? 'Destination Account' : 'External',
                amount: Math.abs(tx.amount),
                currency: currency,
                date: tx.date
            });
            continue;
        }

        if (tx.amount > 0) {
            // Income
            add(totalRevenue, currency, tx.amount);
            add(netCashFlow, currency, tx.amount);
        } else {
            // Expense
            const absAmount = Math.abs(tx.amount);
            add(totalExpenses, currency, absAmount);
            add(netCashFlow, currency, -absAmount); // Subtract expense from cash flow

            const category = tx.category || 'uncategorized';
            if (!categoryBreakdown[category]) categoryBreakdown[category] = {};
            add(categoryBreakdown[category], currency, absAmount);
        }
    }

    return {
        totalRevenue,
        totalExpenses,
        netCashFlow,
        burnRate: totalExpenses,
        transfers,
        categoryBreakdown,
    };
}
