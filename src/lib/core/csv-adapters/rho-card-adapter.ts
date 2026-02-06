/**
 * Rho Credit Card CSV Adapter
 *
 * Parses Rho credit card transaction exports and normalizes to common format.
 * Auto-detects known merchants and assigns suggested categories.
 */

import type {
    CSVAdapter,
    NormalizedTransaction,
    ExpenseCategory,
} from '@/lib/types/csv-types';

// Rho Card CSV structure
export interface RhoCardRow {
    'ID': string;
    'Merchant Name': string;
    'Amount': string;
    'Cardholder': string;
    'Card Last 4': string;
    'Card Nickname': string;
    'Merchant Category': string;
    'Statement Descriptor': string;
    'Transaction Status': string;
    'Creation Date': string;
    'Settlement Date': string;
}

// Known merchant patterns and their auto-assigned categories
const MERCHANT_CATEGORY_MAP: Array<{
    patterns: RegExp[];
    vendor: string;
    category: ExpenseCategory;
    isRecurring: boolean;
    autoExclude?: boolean;
}> = [
        {
            patterns: [/adobe/i],
            vendor: 'Adobe',
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
            patterns: [/facebook|facebk|meta.*ads/i],
            vendor: 'Facebook Ads',
            category: 'marketing',
            isRecurring: false,
        },
        {
            patterns: [/google.*ads/i],
            vendor: 'Google Ads',
            category: 'marketing',
            isRecurring: false,
        },
        {
            patterns: [/google.*workspace|google\*workspace/i],
            vendor: 'Google Workspace',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/google.*one|google\*google\s+one/i],
            vendor: 'Google One',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/shippo/i],
            vendor: 'Shippo',
            category: 'shipping',
            isRecurring: false,
        },
        {
            patterns: [/asendia/i],
            vendor: 'Asendia USA',
            category: 'shipping',
            isRecurring: false,
        },
        {
            patterns: [/easypost/i],
            vendor: 'EasyPost',
            category: 'shipping',
            isRecurring: false,
        },
        {
            patterns: [/upwork/i],
            vendor: 'Upwork',
            category: 'labor_payroll', // or contractors? User put contractors separately. 'labor_payroll' exists. Keeping labor_payroll as it was.
            isRecurring: false,
        },
        {
            patterns: [/zendesk/i],
            vendor: 'Zendesk',
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
            patterns: [/decodo/i],
            vendor: 'Decodo',
            category: 'software',
            isRecurring: false,
        },
        {
            patterns: [/open\s*ai|openai/i],
            vendor: 'OpenAI',
            category: 'software',
            isRecurring: false,
        },
        {
            patterns: [/vercel/i],
            vendor: 'Vercel',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/supabase/i],
            vendor: 'Supabase',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/render\.com|render\s+com/i],
            vendor: 'Render.com',
            category: 'software',
            isRecurring: true,
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
            patterns: [/made\s*blanks/i],
            vendor: 'Made Blanks',
            category: 'inventory',
            isRecurring: false,
        },
        {
            patterns: [/howard\s+custom/i],
            vendor: 'Howard Custom',
            category: 'inventory',
            isRecurring: false,
        },
        {
            patterns: [/sp\s*originalfavorites|originalfavor/i],
            vendor: 'Original Favorites',
            category: 'inventory',
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
            patterns: [/manychat/i],
            vendor: 'Manychat',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/omnisend/i],
            vendor: 'Omnisend',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/midjourney/i],
            vendor: 'Midjourney',
            category: 'software',
            isRecurring: true,
        },
        {
            patterns: [/rho\s*card\s*payment/i],
            vendor: 'Rho Card Payment',
            category: 'internal_transfer',
            isRecurring: true,
            autoExclude: true,
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
    ];

// Headers that identify a Rho Card CSV
const RHO_CARD_REQUIRED_HEADERS = [
    'ID',
    'Merchant Name',
    'Amount',
    'Settlement Date',
];

function normalizeMerchantName(merchantName: string, statementDescriptor: string): string {
    // Use merchant name, fallback to statement descriptor
    const name = merchantName || statementDescriptor;

    // Remove location info (city, state abbreviations at end)
    return name
        .replace(/\s+[A-Z]{2}\s*$/i, '') // Remove state codes at end
        .replace(/\s+\d{5}(-\d{4})?\s*$/i, '') // Remove zip codes
        .trim();
}

function detectKnownMerchant(merchantName: string, statementDescriptor: string): {
    vendor: string;
    category: ExpenseCategory | null;
    isRecurring: boolean;
    autoExclude?: boolean;
} | null {
    const searchText = `${merchantName} ${statementDescriptor}`.toLowerCase();

    for (const mapping of MERCHANT_CATEGORY_MAP) {
        for (const pattern of mapping.patterns) {
            if (pattern.test(searchText)) {
                return {
                    vendor: mapping.vendor,
                    category: mapping.category,
                    isRecurring: mapping.isRecurring,
                    autoExclude: (mapping as any).autoExclude,
                };
            }
        }
    }

    return null;
}

function parseRhoCardDate(dateStr: string): Date {
    // Rho Card format: "2026-01-29" or "2026-01-29 09:35"
    const parts = dateStr.split(' ')[0].split('-');
    return new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10)
    );
}

export const rhoCardAdapter: CSVAdapter = {
    source: 'rho_credit_card',

    detect(headers: string[]): boolean {
        const headerSet = new Set(headers.map(h => h.trim()));
        return RHO_CARD_REQUIRED_HEADERS.every(required => headerSet.has(required));
    },

    parse(data: Record<string, string>[]): NormalizedTransaction[] {
        return data.map((row, index) => {
            const typedRow = row as unknown as RhoCardRow;

            // Credit card amounts in CSV:
            // Expenses are negative (e.g. -41.99)
            // Payments/Repayments are positive (e.g. 948.93)
            // We should trust the sign from the CSV.
            const amount = parseFloat(typedRow.Amount.replace(/,/g, ''));

            // Check for known merchant
            const knownMerchant = detectKnownMerchant(
                typedRow['Merchant Name'],
                typedRow['Statement Descriptor']
            );

            const vendor = knownMerchant?.vendor || normalizeMerchantName(
                typedRow['Merchant Name'],
                typedRow['Statement Descriptor']
            );

            // Determine type
            // If amount is positive, it's likely a payment TO the card (transfer/income)
            // If amount is negative, it's an expense
            const type = amount > 0 ? 'transfer' : 'expense';

            return {
                id: typedRow.ID || `rho-card-${index}`,
                date: parseRhoCardDate(typedRow['Settlement Date'] || typedRow['Creation Date']),
                description: typedRow['Merchant Name'] || typedRow['Statement Descriptor'], // Fallback if Merchant Name empty
                amount: amount,
                currency: 'USD',
                vendor: vendor,
                type: type,
                rawData: row,
                category: knownMerchant?.category ?? null,
                isExcluded: knownMerchant?.autoExclude || type === 'transfer', // Exclude transfers/payments by default
                isRecurring: knownMerchant?.isRecurring ?? false,
            };
        });
    },
};

export default rhoCardAdapter;
