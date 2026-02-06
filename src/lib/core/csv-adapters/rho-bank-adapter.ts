/**
 * Rho Bank CSV Adapter
 * 
 * Parses Rho bank transaction exports and normalizes to common format.
 * Auto-detects known vendors and assigns suggested categories.
 */

import type {
    CSVAdapter,
    NormalizedTransaction,
    ExpenseCategory,
    RhoBankRow,
} from '@/lib/types/csv-types';

// Known vendor patterns and their auto-assigned categories
const VENDOR_CATEGORY_MAP: Array<{
    patterns: RegExp[];
    vendor: string;
    category: ExpenseCategory;
    isRecurring: boolean;
    autoExclude?: boolean;
    isIncome?: boolean; // For income sources like Shopify payouts
}> = [
        {
            patterns: [/^shopify$/i],
            vendor: 'Shopify Payouts',
            category: 'shopify_payouts',
            isRecurring: true,
            isIncome: true, // This is income, not expense
        },
        {
            patterns: [/s\s*&\s*s\s+activewear/i, /s\s+and\s+s\s+activewe/i],
            vendor: 'S&S Activewear',
            category: 'inventory',
            isRecurring: true,
        },
        {
            patterns: [/print\s*plus\s*inc/i],
            vendor: 'Print Plus Inc',
            category: 'internal_transfer',
            isRecurring: true,
            autoExclude: true,
        },
        {
            patterns: [/wise\s*inc/i],
            vendor: 'Wise',
            category: 'internal_transfer',
            isRecurring: false,
            autoExclude: true,
        },
        {
            patterns: [/rho\s+card\s+payment/i],
            vendor: 'Rho Card Payment',
            category: 'internal_transfer',
            isRecurring: true,
            autoExclude: true, // Internal transfer, exclude by default
        },
        {
            patterns: [/rho\s+rewards/i],
            vendor: 'RHO Rewards',
            category: 'other',
            isRecurring: false,
            autoExclude: true, // Cashback, not really income/expense
        },
        {
            patterns: [/clover\s+talent/i],
            vendor: 'Clover Talent',
            category: 'contractors',
            isRecurring: false,
        },
        {
            patterns: [/project\s*zero\s*inc/i],
            vendor: 'Project Zero Inc',
            category: 'internal_transfer',
            isRecurring: true,
            isIncome: true,
            autoExclude: true,
        },
        {
            patterns: [/tiktok\s*inc/i, /tiktok/i],
            vendor: 'TikTok Inc',
            category: 'sales',
            isRecurring: true,
            isIncome: true,
        },
        {
            patterns: [/cash\s*\(checking\)/i, /cash\s*checking/i],
            vendor: 'Cash (Checking)',
            category: 'sales',
            isRecurring: true,
            isIncome: true,
        },
    ];

// Headers that identify a Rho Bank CSV
const RHO_BANK_REQUIRED_HEADERS = [
    'ID',
    'Date',
    'Description',
    'Amount',
    'Details',
    'Type',
    'Status',
];

function normalizeVendorName(description: string, recipientName?: string): string {
    // First check if we have a recipient name (for wire transfers)
    if (recipientName && recipientName.trim()) {
        return recipientName.trim();
    }

    // Otherwise use description, cleaned up
    return description
        .replace(/\s+/g, ' ')
        .trim();
}

function detectKnownVendor(description: string, recipientName?: string): {
    vendor: string;
    category: ExpenseCategory | null;
    isRecurring: boolean;
    autoExclude: boolean;
} | null {
    const searchText = `${description} ${recipientName || ''}`.toLowerCase();

    for (const mapping of VENDOR_CATEGORY_MAP) {
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

function parseRhoDate(dateStr: string): Date {
    // Rho format: "2026-01-29" or "2026-01-29 07:15"
    const parts = dateStr.split(' ')[0].split('-');
    return new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10)
    );
}

export const rhoBankAdapter: CSVAdapter = {
    source: 'rho_bank',

    detect(headers: string[]): boolean {
        const headerSet = new Set(headers.map(h => h.trim()));
        return RHO_BANK_REQUIRED_HEADERS.every(required => headerSet.has(required));
    },

    parse(data: Record<string, string>[]): NormalizedTransaction[] {
        return data.map((row, index) => {
            const typedRow = row as unknown as RhoBankRow;
            const amount = parseFloat(typedRow.Amount.replace(/,/g, ''));
            const isExpense = amount < 0 || typedRow.Details === 'DEBIT';

            // Check for known vendor
            const knownVendor = detectKnownVendor(
                typedRow.Description,
                typedRow['Recipient Account Name']
            );

            const vendor = knownVendor?.vendor || normalizeVendorName(
                typedRow.Description,
                typedRow['Recipient Account Name']
            );

            return {
                id: typedRow.ID || `rho-${index}`,
                date: parseRhoDate(typedRow.Date),
                description: typedRow.Description,
                amount: amount,
                currency: 'USD',
                vendor: vendor,
                type: isExpense ? 'expense' : 'income',
                rawData: row,
                category: knownVendor?.category ?? null,
                isExcluded: knownVendor?.autoExclude ?? false,
                isRecurring: knownVendor?.isRecurring ?? false,
            };
        });
    },
};

export default rhoBankAdapter;
