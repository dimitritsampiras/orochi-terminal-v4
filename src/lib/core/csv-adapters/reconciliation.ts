/**
 * Reconciliation Algorithm
 *
 * Matches Rho Credit Card expenses with Mercury "Rho Card Payment" transfers
 * to verify that card expenses are being properly funded.
 *
 * Strategy:
 * 1. Group Rho Card transactions by settlement date (within 7-day window)
 * 2. Find matching Mercury "Rho Card Payment" transfers
 * 3. Match by amount (exact or within 1% tolerance for rounding)
 * 4. Assign reconciliation_group_id to matched pairs
 */

import type { NormalizedTransaction } from '@/lib/types/csv-types';
import { v4 as uuidv4 } from 'uuid';

export interface ReconciliationMatch {
    rhoCardTransaction: NormalizedTransaction;
    mercuryTransaction: NormalizedTransaction;
    confidence: 'high' | 'medium' | 'low';
    amountDifference: number;
    dateDifference: number; // days
    reconciliationGroupId: string;
}

/**
 * Reconcile Rho Card expenses with Mercury "Rho Card Payment" transfers
 *
 * @param rhoCardTransactions - Transactions from Rho Card CSV
 * @param mercuryTransactions - Transactions from Mercury CSV
 * @returns Array of matched transaction pairs with confidence scores
 */
export function reconcileRhoCardPayments(
    rhoCardTransactions: NormalizedTransaction[],
    mercuryTransactions: NormalizedTransaction[]
): ReconciliationMatch[] {
    const matches: ReconciliationMatch[] = [];

    // Filter Mercury transactions for Rho Card payments (internal transfers)
    const mercuryRhoPayments = mercuryTransactions.filter(tx =>
        tx.vendor === 'Rho Card Payment' ||
        /rho\s+card\s+payment/i.test(tx.description) ||
        tx.category === 'internal_transfer'
    );

    // Track which Mercury payments have been matched
    const matchedMercuryIds = new Set<string>();

    // For each Rho Card transaction, find matching Mercury payment
    for (const rhoCardTx of rhoCardTransactions) {
        // Skip if already excluded or not an expense
        if (rhoCardTx.isExcluded || rhoCardTx.type !== 'expense') {
            continue;
        }

        const rhoCardAmount = Math.abs(rhoCardTx.amount);
        const rhoCardDate = rhoCardTx.date;

        // Find potential matches within 7-day window
        const potentialMatches = mercuryRhoPayments
            .filter(mercuryTx => !matchedMercuryIds.has(mercuryTx.id))
            .filter(mercuryTx => {
                const mercuryAmount = Math.abs(mercuryTx.amount);
                const mercuryDate = mercuryTx.date;

                // Date within 7 days (Mercury payment usually happens after card transaction)
                const daysDiff = (mercuryDate.getTime() - rhoCardDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysDiff < -1 || daysDiff > 7) {
                    return false;
                }

                // Amount within 1% tolerance
                const amountDiff = Math.abs(mercuryAmount - rhoCardAmount);
                const tolerance = rhoCardAmount * 0.01;
                return amountDiff <= tolerance;
            });

        if (potentialMatches.length > 0) {
            // Take best match (smallest amount difference, then smallest date difference)
            const bestMatch = potentialMatches.reduce((best, current) => {
                const currentAmountDiff = Math.abs(Math.abs(current.amount) - rhoCardAmount);
                const bestAmountDiff = Math.abs(Math.abs(best.amount) - rhoCardAmount);

                if (currentAmountDiff < bestAmountDiff) {
                    return current;
                }

                if (currentAmountDiff === bestAmountDiff) {
                    const currentDateDiff = Math.abs((current.date.getTime() - rhoCardDate.getTime()) / (1000 * 60 * 60 * 24));
                    const bestDateDiff = Math.abs((best.date.getTime() - rhoCardDate.getTime()) / (1000 * 60 * 60 * 24));
                    return currentDateDiff < bestDateDiff ? current : best;
                }

                return best;
            });

            const amountDiff = Math.abs(Math.abs(bestMatch.amount) - rhoCardAmount);
            const dateDiff = Math.abs((bestMatch.date.getTime() - rhoCardDate.getTime()) / (1000 * 60 * 60 * 24));

            // Determine confidence level
            let confidence: 'high' | 'medium' | 'low';
            if (amountDiff === 0 && dateDiff <= 1) {
                confidence = 'high';
            } else if (amountDiff < 0.5 && dateDiff <= 3) {
                confidence = 'medium';
            } else {
                confidence = 'low';
            }

            const reconciliationGroupId = uuidv4();

            matches.push({
                rhoCardTransaction: rhoCardTx,
                mercuryTransaction: bestMatch,
                confidence,
                amountDifference: amountDiff,
                dateDifference: dateDiff,
                reconciliationGroupId,
            });

            // Mark this Mercury payment as matched
            matchedMercuryIds.add(bestMatch.id);
        }
    }

    return matches;
}

/**
 * Prepare reconciliation updates for database
 * Returns updates to apply to both Rho Card and Mercury transactions
 */
export function prepareReconciliationUpdates(matches: ReconciliationMatch[]): {
    updates: Array<{
        id: string;
        reconciliation_group_id: string;
        is_reconciled: boolean;
        reconciled_at: Date;
        reconciliation_notes?: string;
    }>;
} {
    const updates: Array<{
        id: string;
        reconciliation_group_id: string;
        is_reconciled: boolean;
        reconciled_at: Date;
        reconciliation_notes?: string;
    }> = [];

    const now = new Date();

    for (const match of matches) {
        // Update Rho Card transaction
        updates.push({
            id: match.rhoCardTransaction.id,
            reconciliation_group_id: match.reconciliationGroupId,
            is_reconciled: true,
            reconciled_at: now,
            reconciliation_notes: `Matched with Mercury payment (${match.confidence} confidence, $${match.amountDifference.toFixed(2)} diff, ${match.dateDifference.toFixed(1)} days apart)`,
        });

        // Update Mercury transaction
        updates.push({
            id: match.mercuryTransaction.id,
            reconciliation_group_id: match.reconciliationGroupId,
            is_reconciled: true,
            reconciled_at: now,
            reconciliation_notes: `Matched with Rho Card expense (${match.confidence} confidence)`,
        });
    }

    return { updates };
}

/**
 * Get unmatched Rho Card transactions (expenses without corresponding Mercury payment)
 */
export function getUnmatchedRhoCardTransactions(
    rhoCardTransactions: NormalizedTransaction[],
    matches: ReconciliationMatch[]
): NormalizedTransaction[] {
    const matchedIds = new Set(matches.map(m => m.rhoCardTransaction.id));

    return rhoCardTransactions.filter(
        tx => !matchedIds.has(tx.id) &&
            tx.type === 'expense' &&
            !tx.isExcluded
    );
}

/**
 * Get unmatched Mercury payments (payments without corresponding Rho Card expense)
 */
export function getUnmatchedMercuryPayments(
    mercuryTransactions: NormalizedTransaction[],
    matches: ReconciliationMatch[]
): NormalizedTransaction[] {
    const matchedIds = new Set(matches.map(m => m.mercuryTransaction.id));

    const mercuryRhoPayments = mercuryTransactions.filter(tx =>
        tx.vendor === 'Rho Card Payment' ||
        /rho\s+card\s+payment/i.test(tx.description) ||
        tx.category === 'internal_transfer'
    );

    return mercuryRhoPayments.filter(tx => !matchedIds.has(tx.id));
}
