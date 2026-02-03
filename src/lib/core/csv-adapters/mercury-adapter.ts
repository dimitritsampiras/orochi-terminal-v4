/**
 * Mercury Bank CSV Adapter
 *
 * Parses Mercury bank transaction exports and normalizes to common format.
 * Auto-detects known vendors and assigns suggested categories.
 * Special handling for Rho Card payments (internal transfers).
 */

import type {
    CSVAdapter,
    NormalizedTransaction,
    ExpenseCategory,
} from '@/lib/types/csv-types';

// Mercury CSV structure
export interface MercuryRow {
    'Date (UTC)': string;
    'Description': string;
    'Amount': string;
    'Status': string;
    'Source Account': string;
    'Bank Description': string;
}

// Known vendor patterns and their auto-assigned categories
const MERCURY_VENDOR_MAP: Array<{
    patterns: RegExp[];
    vendor: string;
    category: ExpenseCategory;
    isRecurring: boolean;
    autoExclude?: boolean;
}> = [
        {
            patterns: [/rho\s+card\s+payment/i, /rho.*credit.*card/i],
            vendor: 'Rho Card Payment',
            category: 'internal_transfer',
            isRecurring: true,
            autoExclude: true, // This is internal transfer, exclude from totals
        },
        {
            patterns: [/gusto.*net/i],
            vendor: 'Gusto Payroll',
            category: 'labor_payroll',
            isRecurring: true,
        },
        {
            patterns: [/gusto.*tax/i],
            vendor: 'Gusto Taxes',
            category: 'labor_payroll',
            isRecurring: true,
        },
        {
            patterns: [/gusto.*fee/i],
            vendor: 'Gusto Fees',
            category: 'fees',
            isRecurring: true,
        },
        {
            patterns: [/s\s*&\s*s\s+activewe/i, /ssactivewr/i],
            vendor: 'S&S Activewear',
            category: 'inventory',
            isRecurring: true,
        },
        {
            patterns: [/verizon/i],
            vendor: 'Verizon',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/easypost/i],
            vendor: 'EasyPost',
            category: 'shipping',
            isRecurring: false,
        },
        {
            patterns: [/the\s+hartford/i],
            vendor: 'The Hartford Insurance',
            category: 'insurance',
            isRecurring: true,
        },
        {
            patterns: [/indeed/i],
            vendor: 'Indeed',
            category: 'marketing',
            isRecurring: false,
        },
        {
            patterns: [/wise/i],
            vendor: 'Wise',
            category: 'internal_transfer',
            isRecurring: true,
            autoExclude: true,
        },
        {
            patterns: [/alibaba/i],
            vendor: 'Alibaba',
            category: 'premade_garments',
            isRecurring: false,
        },
        {
            patterns: [/weixin/i],
            vendor: 'Weixin Pay',
            category: 'premade_garments',
            isRecurring: false,
        },
        {
            patterns: [/amazon/i],
            vendor: 'Amazon',
            category: 'warehouse',
            isRecurring: false,
        },
        {
            patterns: [/brother\s*international/i],
            vendor: 'Brother International',
            category: 'warehouse',
            isRecurring: false,
        },
        {
            patterns: [/rch\s*\*\s*nordproducts/i],
            vendor: 'Nordproducts Calgary',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/web\s*\*\s*bluehost/i],
            vendor: 'Bluehost',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/sp\s*originalfavorites|originalfavor/i],
            vendor: 'Original Favorites',
            category: 'inventory',
            isRecurring: false,
        },
        {
            patterns: [/project\s*zero\s*inc/i],
            vendor: 'Project Zero Inc',
            category: 'internal_transfer',
            isRecurring: true,
            autoExclude: true,
        },
        {
            patterns: [/tiktok\s*inc/i, /tiktok.*shop/i],
            vendor: 'TikTok Inc',
            category: 'sales',
            isRecurring: true,
        },
    ];

// Headers that identify a Mercury CSV
const MERCURY_REQUIRED_HEADERS = [
    'Date (UTC)',
    'Description',
    'Amount',
    'Status',
    'Bank Description',
];

function normalizeMercuryVendor(description: string, bankDescription: string): string {
    // Use bank description if available, otherwise description
    const name = bankDescription || description;

    // Clean up common Mercury formatting
    return name
        .replace(/;[^;]+$/i, '') // Remove trailing semicolons with extra info
        .trim();
}

function detectKnownMercuryVendor(description: string, bankDescription: string): {
    vendor: string;
    category: ExpenseCategory | null;
    isRecurring: boolean;
    autoExclude: boolean;
} | null {
    const searchText = `${description} ${bankDescription}`.toLowerCase();

    for (const mapping of MERCURY_VENDOR_MAP) {
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

function parseMercuryDate(dateStr: string): Date {
    // Mercury format: "01-28-2026 13:45:11"
    const [datePart] = dateStr.split(' ');
    const [month, day, year] = datePart.split('-');
    return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10)
    );
}

export const mercuryAdapter: CSVAdapter = {
    source: 'mercury',

    detect(headers: string[]): boolean {
        const headerSet = new Set(headers.map(h => h.trim()));
        return MERCURY_REQUIRED_HEADERS.every(required => headerSet.has(required));
    },

    parse(data: Record<string, string>[]): NormalizedTransaction[] {
        return data.map((row, index) => {
            const typedRow = row as unknown as MercuryRow;

            // Parse amount (negative = expense, positive = income)
            const amount = parseFloat(typedRow.Amount.replace(/,/g, ''));
            const isExpense = amount < 0;

            // Check for known vendor
            const knownVendor = detectKnownMercuryVendor(
                typedRow.Description,
                typedRow['Bank Description']
            );

            const vendor = knownVendor?.vendor || normalizeMercuryVendor(
                typedRow.Description,
                typedRow['Bank Description']
            );

            // Detect if this is an incoming transfer (income)
            const isIncomingTransfer = !isExpense && /incoming\s+transfer\s+from/i.test(typedRow['Bank Description']);

            return {
                id: `mercury-${index}`,
                date: parseMercuryDate(typedRow['Date (UTC)']),
                description: typedRow.Description,
                amount: amount,
                currency: 'USD',
                vendor: vendor,
                type: isIncomingTransfer ? 'income' : (isExpense ? 'expense' : 'income'),
                rawData: row,
                category: knownVendor?.category ?? null,
                isExcluded: knownVendor?.autoExclude ?? false,
                isRecurring: knownVendor?.isRecurring ?? false,
            };
        });
    },
};

export default mercuryAdapter;
