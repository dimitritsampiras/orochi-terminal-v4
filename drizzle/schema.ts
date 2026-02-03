import { pgEnum, pgTable, uuid, bigint, text, timestamp, integer, bigserial, jsonb, doublePrecision, numeric, boolean, json, index, uniqueIndex, foreignKey, primaryKey, unique, pgPolicy } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { users, usersInAuth } from "./auth"

export const fulfillmentPriority = pgEnum("fulfillment_priority", ["normal", "urgent", "critical", "low", "priority"])
export const shippingPriority = pgEnum("shipping_priority", ["express", "fastest", "standard"])
export const displayFulfillmentStatus = pgEnum("display_fulfillment_status", ["FULFILLED", "IN_PROGRESS", "ON_HOLD", "OPEN", "PARTIALLY_FULFILLED", "PENDING_FULFILLMENT", "RESTOCKED", "SCHEDULED", "UNFULFILLED", "REQUEST_DECLINED"])
export const printLocation = pgEnum("print_location", ["front", "back", "left_sleeve", "right_sleeve", "other"])
export const lineItemCompletionStatus = pgEnum("line_item_completion_status", ["not_printed", "partially_printed", "printed", "in_stock", "oos_blank", "skipped", "ignore"])
export const garmentType = pgEnum("garment_type", ["coat", "jacket", "hoodie", "crewneck", "longsleeve", "tee", "shorts", "sweatpants", "headwear", "accessory"])
export const garmentSize = pgEnum("garment_size", ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "os"])
export const productStatus = pgEnum("product_status", ["ACTIVE", "DRAFT", "ARCHIVED", "UNLISTED"])
export const logType = pgEnum("log_type", ["INFO", "WARN", "ERROR"])
export const orderLogCategory = pgEnum("order_log_category", ["SHIPPING", "ASSEMBLY", "AUTOMATED"])
export const shipmentApi = pgEnum("shipment_api", ["SHIPPO", "EASYPOST"])
export const taskStatus = pgEnum("task_status", ["running", "completed", "cancelled"])
export const userRole = pgEnum("user_role", ["admin", "superadmin", "staff", "creator", "va", "warehouse"])
export const batchDocumentType = pgEnum("batch_document_type", ["assembly_list", "picking_list", "merged_label_slips"])
export const orderHoldCause = pgEnum("order_hold_cause", ["address_issue", "shipping_issue", "stock_shortage", "other"])
export const pretreat = pgEnum("pretreat", ["light", "dark"])
export const inventoryTransactionReason = pgEnum("inventory_transaction_reason", ["manual_adjustment", "assembly_usage", "restock", "return", "stock_take", "correction", "manual_print", "defected_item", "misprint"])
export const expenseCategory = pgEnum("expense_category", [
	"rent",
	"salary",
	"marketing_meta",
	"marketing_google",
	"sponsorship",
	"other",
	// New categories for CSV transactions
	"software_saas",
	"advertising",
	"shipping_logistics",
	"labor_payroll",
	"inventory_blanks",
	"subscriptions",
	"banking_fees",
	"insurance",
	"refunds_chargebacks",
	"internal_transfer",
	"personal",
	// New Consolidated Categories
	"inventory",
	"dtg_printing",
	"software",
	"chargeback",
	"commissions",
	"influencers",
	"shipping",
	// Missing categories
	"contractors",
	"utilities",
	"credit_card_payments",
	"shopify_payouts",
	"fees", // general fees
	"refunds", // general refunds
	// Specific ones used in adapters
	"blanks_inventory",
	"dtf_print_services",
	"international_payments",
	"software_subscriptions",
	"shipping_postage",
	"marketing", // general marketing
	"premade_garments",
	"sales",
	"warehouse",
])
export const userRoleV4 = pgEnum("user_role_v4", ["admin", "super_admin", "warehouse_staff", "customer_support", "operator"])
export const recurringExpenseFrequency = pgEnum("recurring_expense_frequency", ["weekly", "monthly", "yearly"])


export const batchDocuments = pgTable("batch_documents", {
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	documentPath: text("document_path").primaryKey(),
	name: text().default("").notNull(),
	batchId: integer("batch_id").references(() => batches.id, { onDelete: "cascade" }),
	documentNotes: text("document_notes").default("").notNull(),
	documentType: batchDocumentType("document_type").notNull(),
	mergedPdfOrderIds: text("merged_pdf_order_ids").array(),
	documentGroup: bigint("document_group", { mode: 'number' }).default(1).notNull(),
}, (table) => [
	unique("batch_documents_document_path_key").on(table.documentPath),]);

export const batches = pgTable.withRLS("batches", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "session_batch_id_seq" }),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	active: boolean().default(false).notNull(),
	assemblyLineJson: text("assembly_line_json"),
	pickingListJson: jsonb("picking_list_json"),
	premadeStockVerifiedAt: timestamp("premade_stock_verified_at", { withTimezone: true }),
	blankStockVerifiedAt: timestamp("blank_stock_verified_at", { withTimezone: true }),
	itemSyncVerifiedAt: timestamp("item_sync_verified_at", { withTimezone: true }),
	shipmentsVerifiedAt: timestamp("shipments_verified_at", { withTimezone: true }),
	startedAt: timestamp("started_at", { withTimezone: true }),
	settledAt: timestamp("settled_at", { withTimezone: true }),
	premadeStockRequirementsJson: text("premade_stock_requirements_json"),
	blankStockRequirementsJson: text("blank_stock_requirements_json"),
}, (table) => [
	uniqueIndex("unique_active").using("btree", table.active.asc().nullsLast()).where(sql`active`),

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const blankVariants = pgTable("blank_variants", {
	id: uuid().defaultRandom().primaryKey(),
	size: garmentSize().notNull(),
	color: text().notNull(),
	blankId: uuid("blank_id").notNull().references(() => blanks.id, { onDelete: "cascade" }),
	weight: doublePrecision().notNull(),
	volume: doublePrecision().notNull(),
	quantity: bigint({ mode: 'number' }).default(0).notNull(),
}, (table) => [
	unique("blank_variants_color_size_blank_id_key").on(table.color, table.size, table.blankId),]);

export const blanks = pgTable.withRLS("blanks", {
	id: uuid().defaultRandom().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	blankCompany: text("blank_company").notNull(),
	blankName: text("blank_name").notNull(),
	garmentType: garmentType("garment_type").notNull(),
	links: text().array().notNull(),
	customsPrice: doublePrecision("customs_price").notNull(),
	hsCode: text("hs_code"),
	productNameGarmentType: text("product_name_garment_type"),
}, (table) => [

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const creatorPayout = pgTable("creator_payout", {
	creatorName: text("creator_name").notNull().references(() => profiles.creatorVendorName, { onDelete: "cascade" }),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	amount: doublePrecision().notNull(),
	id: uuid().defaultRandom().primaryKey(),
});

export const globalSettings = pgTable("global_settings", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	misprintCostMultiplier: doublePrecision("misprint_cost_multiplier").default(1).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
	supplementaryItemCost: doublePrecision("supplementary_item_cost").default(0).notNull(),
	inkCostPerItem: doublePrecision("ink_cost_per_item").default(1.20).notNull(),
	printerRepairCostPerItem: doublePrecision("printer_repair_cost_per_item").default(0.45).notNull(),
	pretreatCostPerItem: doublePrecision("pretreat_cost_per_item").default(0.27).notNull(),
	electricityCostPerItem: doublePrecision("electricity_cost_per_item").default(0.24).notNull(),
	neckLabelCostPerItem: doublePrecision("neck_label_cost_per_item").default(0.08).notNull(),
	parchmentPaperCostPerItem: doublePrecision("parchment_paper_cost_per_item").default(0.06).notNull(),
	thankYouCardCostPerOrder: doublePrecision("thank_you_card_cost_per_order").default(0.14).notNull(),
	polymailerCostPerOrder: doublePrecision("polymailer_cost_per_order").default(0.09).notNull(),
	cleaningSolutionCostPerOrder: doublePrecision("cleaning_solution_cost_per_order").default(0.08).notNull(),
	integratedPaperCostPerOrder: doublePrecision("integrated_paper_cost_per_order").default(0.06).notNull(),
	blankPaperCostPerOrder: doublePrecision("blank_paper_cost_per_order").default(0.02).notNull(),
	costBufferPercentage: doublePrecision("cost_buffer_percentage").default(10.0).notNull(),
});

export const inventoryTransactions = pgTable.withRLS("inventory_transactions", {
	id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	blankVariantId: uuid("blank_variant_id").references(() => blankVariants.id),
	productVariantId: text("product_variant_id").references(() => productVariants.id),
	profileId: uuid("profile_id").references(() => profiles.id),
	changeAmount: bigint("change_amount", { mode: 'number' }).notNull(),
	previousQuantity: bigint("previous_quantity", { mode: 'number' }).notNull(),
	newQuantity: bigint("new_quantity", { mode: 'number' }).notNull(),
	reason: inventoryTransactionReason().notNull(),
	lineItemId: text("line_item_id").references(() => lineItems.id),
	logId: bigint("log_id", { mode: 'number' }).references(() => logs.id),
	batchId: integer("batch_id").references(() => batches.id),
});

export const lineItems = pgTable("line_items", {
	id: text().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
	updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
	name: text().notNull(),
	orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
	variantId: text("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
	productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
	completionStatus: lineItemCompletionStatus("completion_status").default("not_printed").notNull(),
	quantity: bigint({ mode: 'number' }).default(1).notNull(),
	hasDeprecatedBlankStock: boolean("has_deprecated_blank_stock"),
	hasDeprecatedVariantStock: boolean("has_deprecated_variant_stock"),
	markedAsPackaged: boolean("marked_as_packaged").default(false).notNull(),
	requiresShipping: boolean("requires_shipping").default(true).notNull(),
	unfulfilledQuantity: bigint("unfulfilled_quantity", { mode: 'number' }).default(0).notNull(),
});

export const logs = pgTable("logs", {
	id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	type: logType().default("INFO").notNull(),
	category: orderLogCategory(),
	message: text().notNull(),
	orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
	profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
	metadata: jsonb(),
	batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
	lineItemId: text("line_item_id").references(() => lineItems.id, { onDelete: "set null" }),
});

export const orderHolds = pgTable("order_holds", {
	id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	cause: orderHoldCause().notNull(),
	reasonNotes: text("reason_notes").notNull(),
	isResolved: boolean("is_resolved").default(false).notNull(),
	orderId: text("order_id").notNull().references(() => orders.id),
	orderNumber: text("order_number").notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true }),
	resolvedNotes: text("resolved_notes"),
});

export const orderNotes = pgTable("order_notes", {
	id: uuid().defaultRandom().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
	profileId: uuid("profile_id").notNull().references(() => profiles.id),
	note: text().notNull(),
});

export const orders = pgTable.withRLS("orders", {
	id: text().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
	updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
	name: text().notNull(),
	queued: boolean().default(true).notNull(),
	fulfillmentPriority: fulfillmentPriority("fulfillment_priority").default("normal").notNull(),
	shippingPriority: shippingPriority("shipping_priority").default("standard").notNull(),
	displayFulfillmentStatus: displayFulfillmentStatus("display_fulfillment_status").notNull(),
	displayCustomerName: text("display_customer_name"),
	displayDestinationCountryName: text("display_destination_country_name"),
	displayDestinationCountryCode: text("display_destination_country_code"),
	displayIsCancelled: boolean("display_is_cancelled").default(false).notNull(),
	displayPriorityReason: text("display_priority_reason"),
}, (table) => [
	index("orders_name_idx").using("btree", table.name.asc().nullsLast()),

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const ordersBatches = pgTable("orders_batches", {
	orderId: text("order_id").notNull().references(() => orders.id),
	batchId: integer("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" }),
}, (table) => [
	primaryKey({ columns: [table.orderId, table.batchId], name: "orders_session_batches_pkey" }),
]);

export const parcelTemplates = pgTable("parcel_templates", {
	id: bigserial({ mode: 'number' }).primaryKey(),
	name: text().notNull(),
	widthCm: numeric("width_cm", { precision: 6, scale: 2 }).notNull(),
	lengthCm: numeric("length_cm", { precision: 6, scale: 2 }).notNull(),
	heightCm: numeric("height_cm", { precision: 6, scale: 2 }).notNull(),
	maxVolume: integer("max_volume").notNull(),
});

export const printLogs = pgTable("print_logs", {
	id: uuid().defaultRandom().primaryKey(),
	lineItemId: text("line_item_id").notNull().references(() => lineItems.id, { onDelete: "cascade" }),
	printId: uuid("print_id").references(() => prints.id, { onDelete: "set null" }),
	active: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
});

export const prints = pgTable("prints", {
	id: uuid().defaultRandom().primaryKey(),
	location: printLocation().notNull(),
	heatTransferCode: text("heat_transfer_code"),
	isSmallPrint: boolean("is_small_print"),
	productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
	pretreat: pretreat(),
});

export const productVariants = pgTable.withRLS("product_variants", {
	id: text().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
	updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
	title: text().notNull(),
	price: text().notNull(),
	productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
	warehouseInventory: integer("warehouse_inventory").default(0).notNull(),
	blankVariantId: uuid("blank_variant_id").references(() => blankVariants.id, { onDelete: "set null" }),
}, (table) => [

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const products = pgTable.withRLS("products", {
	id: text().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
	updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
	title: text().notNull(),
	vendor: text().notNull(),
	status: productStatus().default("DRAFT").notNull(),
	blankId: uuid("blank_id").references(() => blanks.id, { onDelete: "set null" }),
	isBlackLabel: boolean("is_black_label").default(false).notNull(),
}, (table) => [

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const profiles = pgTable.withRLS("profiles", {
	id: uuid().primaryKey().references(() => users.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
	username: text().notNull(),
	email: text().notNull(),
	creatorVendorName: text("creator_vendor_name"),
	role: userRole().default("staff").notNull(),
	roleV4: userRoleV4("role_v4").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	unique("creator profiles_vendor_name_key").on(table.creatorVendorName), unique("profiles_email_key").on(table.email), unique("profiles_username_key").on(table.username),
	pgPolicy("Enable read access for all users", { for: "select", using: sql`true` }),
]);

export const recurringExpenses = pgTable("recurring_expenses", {
	id: uuid().defaultRandom().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	name: text().notNull(),
	amount: doublePrecision().notNull(),
	frequency: recurringExpenseFrequency().notNull(),
	active: boolean().default(true).notNull(),
	startDate: timestamp("start_date", { withTimezone: true }).notNull(),
	endDate: timestamp("end_date", { withTimezone: true }),
	category: expenseCategory().default("other").notNull(),
});

export const shipments = pgTable.withRLS("shipments", {
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	api: shipmentApi().default("SHIPPO").notNull(),
	shipmentId: text("shipment_id").notNull(),
	chosenRateId: text("chosen_rate_id"),
	orderId: text("order_id").notNull().references(() => orders.id),
	lineItemIds: text("line_item_ids").array(),
	parcelSnapshot: json("parcel_snapshot").notNull(),
	id: uuid().defaultRandom().primaryKey(),
	shippoTransactionId: text("shippo_transaction_id"),
	labelSlipPath: text("label_slip_path"),
	plainSlipPath: text("plain_slip_path"),
	isPurchased: boolean("is_purchased").default(false).notNull(),
	isRefunded: boolean("is_refunded").default(false),
	chosenCarrierName: text("chosen_carrier_name"),
	cost: numeric(),
	trackingNumber: text("tracking_number"),
	gateScannedAt: timestamp("gate_scanned_at", { withTimezone: true }),
	gateScannerBy: uuid("gate_scanner_by").references(() => profiles.id),
}, (table) => [

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const shippingRateCache = pgTable("shipping_rate_cache", {
	id: uuid().defaultRandom().primaryKey(),
	orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
	rate: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
	unique("shipping_rate_cache_order_id_key").on(table.orderId),]);

export const tasks = pgTable("tasks", {
	id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	completedItems: bigint({ mode: 'number' }).notNull(),
	totalItems: bigint({ mode: 'number' }).notNull(),
	status: taskStatus().notNull(),
});

export const warehouseExpenses = pgTable("warehouse_expenses", {
	id: uuid().defaultRandom().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	category: expenseCategory().notNull(),
	amount: doublePrecision().notNull(),
	date: timestamp({ withTimezone: true }).notNull(),
	notes: text(),
	batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
	periodStart: timestamp("period_start", { withTimezone: true }),
	periodEnd: timestamp("period_end", { withTimezone: true }),
});

// CSV transaction source type
export const csvSource = pgEnum("csv_source", ["rho_bank", "rho_credit_card", "mercury", "paypal", "wise", "rbc_bank", "rbc_card"]);

// CSV transaction type
export const transactionType = pgEnum("transaction_type", ["income", "expense", "transfer"]);

// CSV Transactions table - stores imported CSV financial data
export const csvTransactions = pgTable(
	"csv_transactions",
	{
		id: uuid().defaultRandom().primaryKey(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),

		// Period tracking
		periodMonth: integer("period_month").notNull(), // 1-12
		periodYear: integer("period_year").notNull(), // 2026

		// Source identification
		source: csvSource().notNull(),
		sourceTransactionId: text("source_transaction_id").notNull(),

		// Transaction data
		transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull(),
		description: text().notNull(),
		vendor: text().notNull(),
		amount: numeric({ precision: 12, scale: 2 }).notNull(), // Positive = income, negative = expense
		currency: text().default('USD').notNull(),
		transactionType: transactionType("transaction_type").notNull(),

		// User categorization
		category: expenseCategory(),
		isExcluded: boolean("is_excluded").default(false).notNull(),
		isRecurring: boolean("is_recurring").default(false).notNull(),

		// Reconciliation
		reconciliationGroupId: uuid("reconciliation_group_id"),
		isReconciled: boolean("is_reconciled").default(false).notNull(),
		reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
		reconciliationNotes: text("reconciliation_notes"),

		// Soft delete (NON-DESTRUCTIVE)
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: uuid("deleted_by").references(() => users.id),

		// Audit trail
		rawCsvRow: jsonb("raw_csv_row").notNull(),
		uploadedBy: uuid("uploaded_by").references(() => users.id),
		uploadedAt: timestamp("uploaded_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
		lastModifiedAt: timestamp("last_modified_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
	},
	(table) => [
		// Unique constraint on source + transaction ID + period
		unique("csv_transactions_unique_source_transaction").on(
			table.source,
			table.sourceTransactionId,
			table.periodYear,
			table.periodMonth
		),
		// Indexes for performance
		index("csv_transactions_period_idx").on(table.periodYear, table.periodMonth),
		index("csv_transactions_source_idx").on(table.source),
		index("csv_transactions_vendor_idx").on(table.vendor),
		index("csv_transactions_reconciliation_idx").on(table.reconciliationGroupId),
	]
);

// Monthly Periods table - tracks upload status and cached totals per month
export const monthlyPeriods = pgTable(
	"monthly_periods",
	{
		id: uuid().defaultRandom().primaryKey(),
		periodMonth: integer("period_month").notNull(),
		periodYear: integer("period_year").notNull(),

		// Upload status tracking
		rhoBankUploaded: boolean("rho_bank_uploaded").default(false).notNull(),
		rhoCardUploaded: boolean("rho_card_uploaded").default(false).notNull(),
		mercuryUploaded: boolean("mercury_uploaded").default(false).notNull(),
		paypalUploaded: boolean("paypal_uploaded").default(false).notNull(),
		wiseUploaded: boolean("wise_uploaded").default(false).notNull(),
		rbcBankUploaded: boolean("rbc_bank_uploaded").default(false).notNull(),
		rbcCardUploaded: boolean("rbc_card_uploaded").default(false).notNull(),

		uploadCompletedAt: timestamp("upload_completed_at", { withTimezone: true }),

		// Cached totals (updated after reconciliation)
		totalRevenue: numeric("total_revenue", { precision: 12, scale: 2 }).default("0").notNull(),
		totalExpenses: numeric("total_expenses", { precision: 12, scale: 2 }).default("0").notNull(),
		netCashFlow: numeric("net_cash_flow", { precision: 12, scale: 2 }).default("0").notNull(),

		// Reconciliation status
		reconciliationCompleted: boolean("reconciliation_completed").default(false).notNull(),
		reconciliationCompletedAt: timestamp("reconciliation_completed_at", { withTimezone: true }),

		lastModifiedAt: timestamp("last_modified_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
	},
	(table) => [
		// Unique constraint on period (month + year combination)
		unique("monthly_periods_unique_period").on(table.periodYear, table.periodMonth),
	]
);

// Weekly Reports table - stores weekly profitability analysis
export const weeklyReports = pgTable(
	"weekly_reports",
	{
		id: uuid().defaultRandom().primaryKey(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),

		// Week identification
		weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
		weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
		weekNumber: integer("week_number"), // ISO week number
		year: integer().notNull(),

		// Revenue (from Shopify)
		grossSales: numeric("gross_sales", { precision: 12, scale: 2 }).notNull(),
		shopifyFees: numeric("shopify_fees", { precision: 12, scale: 2 }).notNull(),
		refunds: numeric("refunds", { precision: 12, scale: 2 }).default("0").notNull(),
		returns: numeric("returns", { precision: 12, scale: 2 }).default("0").notNull(),
		netRevenue: numeric("net_revenue", { precision: 12, scale: 2 }).notNull(),

		// Fulfillment costs (calculated)
		blanksCost: numeric("blanks_cost", { precision: 12, scale: 2 }).notNull(),
		inkCost: numeric("ink_cost", { precision: 12, scale: 2 }).notNull(),
		shippingCost: numeric("shipping_cost", { precision: 12, scale: 2 }).notNull(),
		perItemCosts: numeric("per_item_costs", { precision: 12, scale: 2 }).notNull(),
		perOrderCosts: numeric("per_order_costs", { precision: 12, scale: 2 }).notNull(),
		totalFulfillmentCost: numeric("total_fulfillment_cost", { precision: 12, scale: 2 }).notNull(),

		// Operating expenses
		payrollCost: numeric("payroll_cost", { precision: 12, scale: 2 }),
		payrollSource: text("payroll_source"), // 'manual' | 'historical_average'
		marketingCostMeta: numeric("marketing_cost_meta", { precision: 12, scale: 2 }).default("0"),
		marketingCostGoogle: numeric("marketing_cost_google", { precision: 12, scale: 2 }).default("0"),
		marketingCostOther: numeric("marketing_cost_other", { precision: 12, scale: 2 }).default("0"),
		totalMarketingCost: numeric("total_marketing_cost", { precision: 12, scale: 2 }).default("0").notNull(),

		// Recurring expenses (prorated for week)
		recurringExpenses: numeric("recurring_expenses", { precision: 12, scale: 2 }).default("0").notNull(),

		// CSV uploaded expenses (optional)
		csvExpenses: numeric("csv_expenses", { precision: 12, scale: 2 }).default("0"),
		csvExpenseSource: text("csv_expense_source"), // 'rho_bank' | 'mercury' | etc

		// Profitability metrics
		totalCosts: numeric("total_costs", { precision: 12, scale: 2 }).notNull(),
		grossProfit: numeric("gross_profit", { precision: 12, scale: 2 }).notNull(),
		profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }), // percentage

		// Metadata
		itemsFulfilled: integer("items_fulfilled").default(0).notNull(),
		ordersFulfilled: integer("orders_fulfilled").default(0).notNull(),
		costPerItem: numeric("cost_per_item", { precision: 12, scale: 2 }),
		costPerOrder: numeric("cost_per_order", { precision: 12, scale: 2 }),

		// Analysis notes
		notes: text(),
		analysisJson: jsonb("analysis_json"), // Store detailed breakdown

		// Tracking
		isFinalized: boolean("is_finalized").default(false).notNull(),
		finalizedAt: timestamp("finalized_at", { withTimezone: true }),
		createdBy: uuid("created_by").references(() => users.id),
		lastModifiedAt: timestamp("last_modified_at", { withTimezone: true })
			.default(sql`now()`)
			.notNull(),
	},
	(table) => [
		// Unique constraint on week range
		unique("weekly_reports_unique_week").on(table.weekStart, table.weekEnd),
		// Indexes for performance
		index("weekly_reports_week_start_idx").on(table.weekStart),
		index("weekly_reports_year_idx").on(table.year),
	]
);

// Re-export auth tables for relations
export { users, usersInAuth };
