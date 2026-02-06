/**
 * Wise CSV Adapter
 * 
 * Parses Wise transaction exports.
 * Handles "Sent money to" as expenses/transfers.
 * Handles "Received money from" as income/transfers.
 * Detects internal transfers to/from Rho and Mercury.
 */

import type {
    CSVAdapter,
    NormalizedTransaction,
    ExpenseCategory,
} from '@/lib/types/csv-types';

const WISE_REQUIRED_HEADERS = [
    'TransferWise ID',
    'Date',
    'Amount',
    'Currency',
    'Description',
    'Payment Reference',
    'Exchange From',
    'Exchange To',
];

// Map specific Wise descriptions to categories
const WISE_VENDOR_MAP: Array<{
    patterns: RegExp[];
    vendor: string;
    category: ExpenseCategory;
    isRecurring: boolean;
    autoExclude?: boolean;
}> = [
        {
            patterns: [/sent\s+money\s+to\s+apollo\s+creatives/i],
            vendor: 'Apollo Creatives Inc',
            category: 'personal',
            isRecurring: true,
        },
        {
            patterns: [/sent\s+money\s+to\s+daniel\s+pinsker/i],
            vendor: 'Daniel Pinsker',
            category: 'personal', // Often personal reimbursement or draw
            isRecurring: true,
        },
        {
            patterns: [/sent\s+money\s+to\s+maven\s+marketing/i],
            vendor: 'Maven Marketing',
            category: 'personal',
            isRecurring: true,
        },
        {
            patterns: [/sent\s+money\s+to\s+dimitri\s+tsampiras/i],
            vendor: 'Dimitri Tsampiras',
            category: 'personal',
            isRecurring: true,
        },
        {
            patterns: [/sent\s+money\s+to\s+bill\s+carlton/i],
            vendor: 'Bill Carlton Rallos Cheng',
            category: 'contractors',
            isRecurring: true,
        },
        {
            patterns: [/sent\s+money\s+to\s+sakura\s+mori/i],
            vendor: 'Sakura Mori',
            category: 'contractors',
            isRecurring: false,
        },
        {
            patterns: [/sent\s+money\s+to\s+in\s+the\s+black\s+media/i],
            vendor: 'In The Black Media LLC',
            category: 'marketing',
            isRecurring: false,
        },
        {
            patterns: [/sent\s+money\s+to\s+dmytro\s+pinchuk/i],
            vendor: 'Dmytro Pinchuk',
            category: 'contractors',
            isRecurring: false,
        },
        {
            patterns: [/sent\s+money\s+to\s+michael\s+evans/i],
            vendor: 'Michael Evans',
            category: 'contractors',
            isRecurring: false,
        },
        {
            patterns: [/card\s+transaction.*wetracked\.io/i],
            vendor: 'Wetracked.io',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/card\s+transaction.*alp\*personalservices/i],
            vendor: 'Alipay Services',
            category: 'contractors', // Often sourcing agents
            isRecurring: false,
        },
        {
            patterns: [/card\s+transaction.*monitask\.com/i],
            vendor: 'Monitask',
            category: 'software',
            isRecurring: true,
        },
        // Transfers
        {
            patterns: [/received\s+money\s+from\s+project\s+orochi/i, /paypal\s+iat/i],
            vendor: 'PayPal Transfer',
            category: 'internal_transfer', // Income from PayPal
            isRecurring: true,
            autoExclude: true,
        },
    ];

function parseWiseDate(dateStr: string): Date {
    // Format: "30-01-2026" (DD-MM-YYYY)
    const [day, month, year] = dateStr.split('-');
    return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10)
    );
}

function cleanWiseDescription(desc: string): string {
    return desc
        .replace(/^Sent money to /i, '')
        .replace(/^Received money from /i, '')
        .replace(/^Card transaction of .* issued by /i, '')
        .trim();
}

function detectWiseVendor(description: string, payeeName?: string, merchant?: string): {
    vendor: string;
    category: ExpenseCategory | null;
    isRecurring: boolean;
    autoExclude: boolean;
} | null {
    const searchText = `${description} ${payeeName || ''} ${merchant || ''}`.toLowerCase();

    for (const mapping of WISE_VENDOR_MAP) {
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

export const wiseAdapter: CSVAdapter = {
    source: 'wise',

    detect(headers: string[]): boolean {
        const headerSet = new Set(headers.map(h => h.trim()));
        const isWise = WISE_REQUIRED_HEADERS.every(h => headerSet.has(h));
        if (isWise) {
            console.log("Wise Adapter detected file with headers:", headers);
        }
        return isWise;
    },

    parse(data: Record<string, string>[]): NormalizedTransaction[] {
        console.log(`Wise Adapter parsing ${data.length} rows`);
        return data
            .filter(row => row['Date'] && row['Amount']) // Skip empty rows
            .map((row, index) => {
                const amount = parseFloat(row.Amount);
                const isExpense = amount < 0;

                // Get vendor/payee info
                const payeeName = row['Payee Name'] || row['Payer Name'];
                const merchant = row['Merchant'];

                const knownVendor = detectWiseVendor(row.Description, payeeName, merchant);

                let vendor = knownVendor?.vendor;

                if (!vendor) {
                    // Fallback vendor cleanup
                    if (payeeName) {
                        vendor = payeeName;
                    } else if (merchant) {
                        vendor = merchant;
                    } else {
                        vendor = cleanWiseDescription(row.Description);
                    }
                }

                // Determine transaction type
                let type: 'income' | 'expense' | 'transfer' = isExpense ? 'expense' : 'income';

                // Explicit transfer detection
                if (row.Description.toLowerCase().includes('paypal iat') ||
                    (payeeName && payeeName.toLowerCase().includes('project orochi'))) {
                    // Even if it's income, mark as transfer if it comes from our other accounts
                    if (!isExpense) type = 'transfer';
                }

                // Internal conversions
                if (row.Description.startsWith('Converted ')) {
                    type = 'transfer'; // Or ignore
                }

                // Generate robust ID
                // Prefer TransferWise ID, fallback to content hash to prevent collisions across multiple files
                let id = row['TransferWise ID'];

                if (!id) {
                    const cleanDesc = row.Description.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
                    // Use Date + Amount + Description snippet to create a unique enough key for deduplication
                    // wise-20260130-150.00-sentmoneyto...
                    const dateStr = row.Date.replace(/-/g, ''); // 30012026
                    id = `wise-${dateStr}-${amount.toFixed(2)}-${cleanDesc}`;
                }

                // Append currency to ID to distinguish between legs of the same transfer in different currencies
                // e.g. A Conversion has the same ID in USD and CAD files, but we want both ledger entries.
                id = `${id}-${row.Currency || 'USD'}`;

                console.log(`Generated Wise ID: ${id} (${row.Currency})`);

                return {
                    id: id,
                    date: parseWiseDate(row.Date),
                    description: row.Description,
                    amount: amount,
                    currency: row.Currency || 'USD',
                    vendor: vendor,
                    type: type as any,
                    rawData: row,
                    category: knownVendor?.category ?? null,
                    isExcluded: knownVendor?.autoExclude ?? (type === 'transfer'),
                    isRecurring: knownVendor?.isRecurring ?? false,
                };
            });
    },
};

export default wiseAdapter;
