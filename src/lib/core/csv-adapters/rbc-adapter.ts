/**
 * RBC CSV Adapter
 * 
 * Parses RBC Bank and Credit Card transaction exports.
 * Supports multi-currency columns (CAD$ and USD$).
 */

import type {
    CSVAdapter,
    NormalizedTransaction,
    ExpenseCategory,
    CSVSource,
} from '@/lib/types/csv-types';

const RBC_REQUIRED_HEADERS = [
    'Account Type',
    'Account Number',
    'Transaction Date',
    'Description 1',
    'Description 2',
    'CAD$',
    'USD$',
];

// Map specific RBC descriptions to categories
const RBC_VENDOR_MAP: Array<{
    patterns: RegExp[];
    vendor: string;
    category: ExpenseCategory;
    isRecurring: boolean;
    autoExclude?: boolean;
}> = [
        {
            patterns: [/purchase\s+interest/i],
            vendor: 'RBC Interest',
            category: 'fees',
            isRecurring: true,
        },
        {
            patterns: [/monthly\s+fee/i],
            vendor: 'RBC Monthly Fee',
            category: 'fees',
            isRecurring: true,
        },
        {
            patterns: [/payment\s+-\s+thank\s+you/i],
            vendor: 'Credit Card Payment',
            category: 'credit_card_payments',
            isRecurring: true,
            autoExclude: true, // Internal transfer
        },
        {
            patterns: [/cdn\s+cancer\s+society/i],
            vendor: 'Canadian Cancer Society',
            category: 'other', // Donation
            isRecurring: false,
        },
        {
            patterns: [/cash\s+back\s+reward/i],
            vendor: 'RBC Rewards',
            category: 'other',
            isRecurring: false,
            autoExclude: true,
        },
        {
            patterns: [/e-transfer.*project\s+orochi/i],
            vendor: 'Project Orochi',
            category: 'internal_transfer',
            isRecurring: true,
            autoExclude: true,
        },
    ];

function parseRBCDate(dateStr: string): Date {
    // Format: "12/9/2025" (MM/DD/YYYY)
    const [month, day, year] = dateStr.split('/');
    return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10)
    );
}

function detectRBCVendor(desc1: string, desc2: string): {
    vendor: string;
    category: ExpenseCategory | null;
    isRecurring: boolean;
    autoExclude: boolean;
} | null {
    const searchText = `${desc1} ${desc2}`.toLowerCase();

    for (const mapping of RBC_VENDOR_MAP) {
        for (const pattern of mapping.patterns) {
            if (pattern.test(searchText)) {
                return {
                    vendor: mapping.vendor,
                    category: mapping.category,
                    isRecurring: mapping.isRecurring,
                    autoExclude: mapping.autoExclude ?? false,
                };
            }
        }
    }

    return null;
}

export const rbcAdapter: CSVAdapter = {
    // logic to dynamically set source in parse() based on account type, 
    // but simplified to 'rbc_bank' as default, override in calling logic if needed
    source: 'rbc_bank',

    detect(headers: string[]): boolean {
        const headerSet = new Set(headers.map(h => h.trim()));
        return RBC_REQUIRED_HEADERS.every(h => headerSet.has(h));
    },

    resolveSource(data: Record<string, string>[]): CSVSource {
        // Check the first few rows to see if it's a credit card
        // Account Type usually contains "Visa" or "Credit" for cards
        // "Chequing" or "Savings" for bank
        for (const row of data) {
            const accountType = (row['Account Type'] || '').toLowerCase();
            if (accountType.includes('visa') || accountType.includes('mastercard') || accountType.includes('credit')) {
                return 'rbc_card';
            }
        }
        return 'rbc_bank';
    },

    parse(data: Record<string, string>[]): NormalizedTransaction[] {
        return data
            .filter(row => row['Transaction Date'] && (row['CAD$'] || row['USD$'])) // Skip empty
            .map((row, index) => {
                // RBC has separate columns for CAD and USD. Usually only one is filled.
                // We default to CAD if both (rare), or whichever matches.
                // IMPORTANT: The system might need multi-currency support later.
                // For now, we ingest the numeric value.

                const cadAmount = row['CAD$'] ? parseFloat(row['CAD$']) : 0;
                const usdAmount = row['USD$'] ? parseFloat(row['USD$']) : 0;

                const amount = cadAmount !== 0 ? cadAmount : usdAmount;
                const currency = cadAmount !== 0 ? 'CAD' : 'USD';

                // RBC logic: Expenses are negative?
                // Sample: "Purchase Interest" is -47.42. "Payment" is 3150.95 (income to card).
                // So Negative = Expense (or Debit), Positive = Income (or Credit).

                const isExpense = amount < 0;
                const desc1 = row['Description 1'];
                const desc2 = row['Description 2'];
                const description = `${desc1} ${desc2}`.trim();

                const knownVendor = detectRBCVendor(desc1, desc2);
                let vendor = knownVendor?.vendor || desc1;

                // Determine transaction type
                let type: 'income' | 'expense' | 'transfer' = isExpense ? 'expense' : 'income';
                if (knownVendor?.autoExclude) {
                    // If it's internal transfer like "Payment - Thank You", mark as transfer
                    type = 'transfer';
                }

                // Determine Account Type to refine Source
                const accountType = row['Account Type'];
                // This transaction's source will only be assigned by the uploader context.

                const idDescription = description.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
                const idDate = row['Transaction Date'].replace(/\//g, '');

                // Content-based ID: rbc-DATE-DESC-AMOUNT-INDEX
                // Adding index as fallback for identical transactions in same file
                return {
                    id: `rbc-${idDate}-${idDescription}-${Math.abs(amount)}-${index}`,
                    date: parseRBCDate(row['Transaction Date']),
                    description: description,
                    amount: amount,
                    currency: currency,
                    vendor: vendor,
                    type: type,
                    rawData: row,
                    category: knownVendor?.category ?? null,
                    isExcluded: knownVendor?.autoExclude ?? false,
                    isRecurring: knownVendor?.isRecurring ?? false,
                };
            });
    },
};

export default rbcAdapter;
