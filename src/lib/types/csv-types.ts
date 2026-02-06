/**
 * CSV Expense Analyzer Types
 * Normalized interfaces for processing bank/payment CSV exports
 */

export type ExpenseCategory =
    | 'inventory'              // Combined blanks and inventory
    | 'dtg_printing'           // Renamed from dtf
    | 'premade_garments'       // New
    | 'contractors'
    | 'labor_payroll'
    | 'commissions'            // New
    | 'influencers'            // New
    | 'shipping'               // Combined shipping categories
    | 'software'               // Combined software/saas/subscriptions
    | 'marketing'              // Combined marketing/advertising
    | 'credit_card_payments'
    | 'fees'                   // Combined fees/banking_fees
    | 'refunds'
    | 'chargeback'             // Renamed from refunds_chargebacks
    | 'utilities'
    | 'shopify_payouts'
    | 'internal_transfer'
    | 'personal'
    | 'insurance'
    | 'sales'
    | 'warehouse'              // New
    | 'other';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    inventory: 'Inventory',
    dtg_printing: 'DTG Printing',
    premade_garments: 'Premade Garments',
    contractors: 'Contractors',
    labor_payroll: 'Labor / Payroll',
    commissions: 'Commissions',
    influencers: 'Influencers',
    shipping: 'Shipping',
    software: 'Software',
    marketing: 'Marketing',
    credit_card_payments: 'Credit Card Payments',
    fees: 'Fees',
    refunds: 'Refunds',
    chargeback: 'Chargeback',
    utilities: 'Utilities',
    shopify_payouts: 'Shopify Payouts',
    internal_transfer: 'Internal Transfer',
    personal: 'Personal',
    insurance: 'Insurance',
    sales: 'Sales',
    warehouse: 'Warehouse',
    other: 'Other',
};

export interface NormalizedTransaction {
    id: string;
    date: Date;
    description: string;
    amount: number; // Positive = income, negative = expense
    vendor: string; // Extracted/normalized vendor name
    currency: string; // 'USD', 'CAD', etc.
    type: 'income' | 'expense' | 'transfer';
    rawData: Record<string, string>; // Original CSV row

    // User-assigned fields
    category: ExpenseCategory | null;
    isExcluded: boolean;
    isRecurring: boolean;
}

export interface VendorSummary {
    vendor: string;
    totalAmount: number;
    transactionCount: number;
    category: ExpenseCategory | null;
    isRecurring: boolean;
    transactions: NormalizedTransaction[];
}

export interface CSVParseResult {
    transactions: NormalizedTransaction[];
    source: CSVSource;
    dateRange: {
        start: Date;
        end: Date;
    };
    totalIncome: number;
    totalExpenses: number;
}

export type CSVSource =
    | 'rho_bank'
    | 'rho_credit_card'
    | 'wise'
    | 'paypal'
    | 'mercury'
    | 'rbc_bank'
    | 'rbc_card'
    | 'unknown';

export interface CSVAdapter {
    source: CSVSource;
    detect: (headers: string[]) => boolean;
    parse: (data: Record<string, string>[]) => NormalizedTransaction[];
    resolveSource?: (data: Record<string, string>[]) => CSVSource;
}

// Rho Bank CSV column structure
export interface RhoBankRow {
    ID: string;
    Date: string;
    Description: string;
    Amount: string;
    Details: string; // CREDIT or DEBIT
    Type: string;    // ACH-US, WIRE-DOM, INTERNAL
    User: string;
    Status: string;
    Labels: string;
    Note: string;
    Department: string;
    'Creation Date': string;
    'Settlement Date': string;
    Balance: string;
    'Invoice Number': string;
    'Sender Account Name': string;
    'Sender Account Number': string;
    'Recipient Account Name': string;
    'Recipient Account Number': string;
}
