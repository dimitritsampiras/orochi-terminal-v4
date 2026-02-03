/**
 * PayPal CSV Adapter
 *
 * Parses PayPal transaction exports and normalizes to common format.
 * Handles multiple transaction types (payments, refunds, fees, etc.).
 * Express Checkout payments are treated as customer income.
 */

import type {
    CSVAdapter,
    NormalizedTransaction,
    ExpenseCategory,
} from '@/lib/types/csv-types';

// PayPal CSV structure (41 columns - showing relevant ones)
export interface PayPalRow {
    'Date': string;
    'Time': string;
    'TimeZone': string;
    'Name': string;
    'Type': string;
    'Status': string;
    'Currency': string;
    'Gross': string;
    'Fee': string;
    'Net': string;
    'From Email Address': string;
    'To Email Address': string;
    'Transaction ID': string;
    'Item Title': string;
    'Invoice Number': string;
    'Reference Txn ID': string;
    'Subject': string;
    'Note': string;
    'Balance Impact': string;
}

// PayPal transaction type mapping to our categories
const PAYPAL_TYPE_MAPPING: Record<string, {
    transactionType: 'income' | 'expense' | 'transfer';
    category: ExpenseCategory | null;
}> = {
    'Express Checkout Payment': { transactionType: 'income', category: null },
    'General Payment': { transactionType: 'income', category: null },
    'Payment Refund': { transactionType: 'expense', category: 'chargeback' },
    'Payment Reversal': { transactionType: 'expense', category: 'chargeback' },
    'Chargeback': { transactionType: 'expense', category: 'chargeback' },
    'Dispute Fee': { transactionType: 'expense', category: 'fees' },
    'PreApproved Payment Bill User Payment': { transactionType: 'expense', category: 'software' },
    'BillPay transaction': { transactionType: 'expense', category: 'other' },
    'Mobile Payment': { transactionType: 'expense', category: 'other' },
    'Hold on Balance for Dispute Investigation': { transactionType: 'expense', category: 'fees' },
    'Cancellation of Hold for Dispute Resolution': { transactionType: 'income', category: null },
    'General Currency Conversion': { transactionType: 'transfer', category: 'internal_transfer' }, // Internal movement
    'User Initiated Withdrawal': { transactionType: 'transfer', category: 'internal_transfer' },
};

// Known vendor patterns for PreApproved payments
const PAYPAL_VENDOR_MAP: Array<{
    patterns: RegExp[];
    vendor: string;
    category: ExpenseCategory;
    isRecurring: boolean;
}> = [
        {
            patterns: [/google.*one|200\s*gb/i],
            vendor: 'Google One',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/shopify/i],
            vendor: 'Shopify',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/discord/i],
            vendor: 'Discord',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/ionos/i],
            vendor: 'IONOS',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/leadsfunda/i],
            vendor: 'LeadsFunda',
            category: 'marketing',
            isRecurring: false,
        },
        {
            patterns: [/tiktok\s*inc/i, /tiktok/i],
            vendor: 'TikTok Inc',
            category: 'sales',
            isRecurring: true,
        },
    ];

// Headers that identify a PayPal CSV
const PAYPAL_REQUIRED_HEADERS = [
    'Date',
    'Time',
    'Name',
    'Type',
    'Status',
    'Gross',
    'Net',
    'Balance Impact',
];

function normalizePayPalVendor(name: string, subject: string, itemTitle: string): string {
    // Use name, fallback to subject or item title
    return (name || subject || itemTitle || 'Unknown').trim();
}

function detectKnownPayPalVendor(name: string, subject: string, itemTitle: string): {
    vendor: string;
    category: ExpenseCategory | null;
    isRecurring: boolean;
} | null {
    const searchText = `${name} ${subject} ${itemTitle}`.toLowerCase();

    for (const mapping of PAYPAL_VENDOR_MAP) {
        for (const pattern of mapping.patterns) {
            if (pattern.test(searchText)) {
                return {
                    vendor: mapping.vendor,
                    category: mapping.category,
                    isRecurring: mapping.isRecurring,
                };
            }
        }
    }

    return null;
}

function parsePayPalDate(dateStr: string, timeStr: string): Date {
    // PayPal format: Date="13/01/2026" (DD/MM/YYYY), Time="00:45:58"
    const [day, month, year] = dateStr.split('/');
    const [hours, minutes, seconds] = timeStr.split(':');

    return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10),
        parseInt(seconds, 10)
    );
}

export const paypalAdapter: CSVAdapter = {
    source: 'paypal',

    detect(headers: string[]): boolean {
        const headerSet = new Set(headers.map(h => h.trim()));
        return PAYPAL_REQUIRED_HEADERS.every(required => headerSet.has(required));
    },

    parse(data: Record<string, string>[]): NormalizedTransaction[] {
        const seenIds = new Map<string, number>();

        return data
            .filter((row, index) => {
                const typedRow = row as unknown as PayPalRow;

                // Skip completed status check - some valid transactions might not be "Completed"
                // Skip empty rows or header rows
                if (!typedRow.Date || !typedRow.Type) {
                    return false;
                }

                return true;
            })
            .map((row, index) => {
                const typedRow = row as unknown as PayPalRow;

                // Get transaction type mapping
                const typeMapping = PAYPAL_TYPE_MAPPING[typedRow.Type] || {
                    transactionType: 'expense',
                    category: null,
                };

                // Use "Net" column for actual impact (Gross - Fee)
                const netAmount = parseFloat(typedRow.Net.replace(/,/g, ''));

                // Check for known vendor (mainly for PreApproved payments)
                const knownVendor = detectKnownPayPalVendor(
                    typedRow.Name,
                    typedRow.Subject,
                    typedRow['Item Title']
                );

                const vendor = knownVendor?.vendor || normalizePayPalVendor(
                    typedRow.Name,
                    typedRow.Subject,
                    typedRow['Item Title']
                );

                // Determine transaction type based on PayPal type and amount sign
                let transactionType: 'income' | 'expense' | 'transfer' = typeMapping.transactionType;
                let category = knownVendor?.category ?? typeMapping.category;

                // Override for generic positive amounts (incoming payments)
                if (netAmount > 0 && !knownVendor) {
                    const isExplicitExpense = ['Payment Refund', 'Payment Reversal', 'Chargeback'].includes(typedRow.Type);

                    // If it's not an explicit expense (refund) and not a transfer (conversion)
                    if (!isExplicitExpense && transactionType !== 'transfer') {
                        // Case 1: Was wrongly marked as expense (e.g. some generic type)
                        if (transactionType === 'expense') {
                            transactionType = 'income';
                            category = 'sales';
                        }
                        // Case 2: Already income but needs category (e.g. General Payment)
                        else if (transactionType === 'income' && !category) {
                            category = 'sales';
                        }
                    }
                } else if (netAmount < 0) {
                    // Force expense if amount is negative, regardless of what the type mapping says
                    // unless it's explicitly a transfer/withdrawal
                    if (transactionType !== 'transfer') {
                        transactionType = 'expense';
                    }
                }

                // If it's a currency conversion with 0 net, it's likely a fee?
                // Actually, currency conversions usually come in pairs (one neg, one pos).
                // We marked them as 'transfer' above, so they will be auto-excluded.

                // Override for withdrawals
                if (typedRow.Type === 'User Initiated Withdrawal') {
                    transactionType = 'transfer';
                }

                // Handle ID uniqueness
                let baseId = typedRow['Transaction ID'] || `paypal-${index}`;
                // If ID is empty (sometimes happens with currency conversions), use a fallback
                if (!baseId.trim()) {
                    baseId = `paypal-no-id-${index}`;
                }

                // Check for duplicates
                let finalId = baseId;
                if (seenIds.has(baseId)) {
                    const count = seenIds.get(baseId)! + 1;
                    seenIds.set(baseId, count);
                    finalId = `${baseId}-${count}`;
                } else {
                    seenIds.set(baseId, 0);
                }

                return {
                    id: finalId,
                    date: parsePayPalDate(typedRow.Date, typedRow.Time),
                    description: `${typedRow.Type} - ${typedRow.Name || typedRow.Subject}`,
                    amount: netAmount,
                    currency: typedRow.Currency || 'USD',
                    vendor: vendor,
                    type: transactionType,
                    rawData: row,
                    category: category,
                    isExcluded: transactionType === 'transfer', // Auto-exclude withdrawals
                    isRecurring: knownVendor?.isRecurring ?? false,
                };
            });
    },
};

export default paypalAdapter;
