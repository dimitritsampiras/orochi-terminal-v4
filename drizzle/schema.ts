import { pgEnum, pgTable, text, bigint, integer, timestamp, uuid, bigserial, numeric, boolean, doublePrecision, json, jsonb, index, uniqueIndex, foreignKey, primaryKey, unique, pgPolicy } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { users } from "./auth"

export const fulfillmentPriority = pgEnum("fulfillment_priority", ["normal", "urgent", "critical", "low", "priority"])
export const shippingPriority = pgEnum("shipping_priority", ["express", "fastest", "standard"])
export const displayFulfillmentStatus = pgEnum("display_fulfillment_status", ["FULFILLED", "IN_PROGRESS", "ON_HOLD", "OPEN", "PARTIALLY_FULFILLED", "PENDING_FULFILLMENT", "RESTOCKED", "SCHEDULED", "UNFULFILLED", "REQUEST_DECLINED"])
export const printLocation = pgEnum("print_location", ["front", "back", "left_sleeve", "right_sleeve", "other"])
export const lineItemCompletionStatus = pgEnum("line_item_completion_status", ["not_printed", "partially_printed", "printed", "in_stock", "oos_blank", "skipped", "ignore"])
export const garmentType = pgEnum("garment_type", ["coat", "jacket", "hoodie", "crewneck", "longsleeve", "tee", "shorts", "sweatpants", "headwear", "accessory"])
export const garmentSize = pgEnum("garment_size", ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "os"])
export const productStatus = pgEnum("product_status", ["ACTIVE", "DRAFT", "ARCHIVED"])
export const logType = pgEnum("log_type", ["INFO", "WARN", "ERROR"])
export const orderLogCategory = pgEnum("order_log_category", ["SHIPPING", "ASSEMBLY", "AUTOMATED"])
export const shipmentApi = pgEnum("shipment_api", ["SHIPPO", "EASYPOST"])
export const taskStatus = pgEnum("task_status", ["running", "completed", "cancelled"])
export const userRole = pgEnum("user_role", ["admin", "superadmin", "staff", "creator", "va", "warehouse"])
export const batchDocumentType = pgEnum("batch_document_type", ["assembly_list", "picking_list", "merged_label_slips"])
export const orderHoldCause = pgEnum("order_hold_cause", ["address_issue", "shipping_issue", "stock_shortage", "other"])


export const batchDocuments = pgTable("batch_documents", {
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	documentPath: text("document_path").primaryKey(),
	name: text().default("").notNull(),
	batchId: integer("batch_id").references(() => batches.id, { onDelete: "cascade" } ),
	documentNotes: text("document_notes").default("").notNull(),
	documentType: batchDocumentType("document_type").notNull(),
	mergedPdfOrderIds: text("merged_pdf_order_ids").array(),
}, (table) => [
	unique("batch_documents_document_path_key").on(table.documentPath),]);

export const batches = pgTable.withRLS("batches", {
	id: integer().primaryKey().generatedByDefaultAsIdentity({ name: "session_batch_id_seq" }),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	active: boolean().default(false).notNull(),
	assemblyLineJson: text("assembly_line_json"),
}, (table) => [
	uniqueIndex("unique_active").using("btree", table.active.asc().nullsLast()).where(sql`active`),

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const blankVariants = pgTable("blank_variants", {
	id: uuid().defaultRandom().primaryKey(),
	size: garmentSize().notNull(),
	color: text().notNull(),
	blankId: uuid("blank_id").notNull().references(() => blanks.id, { onDelete: "cascade" } ),
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
	creatorName: text("creator_name").notNull().references(() => profiles.creatorVendorName, { onDelete: "cascade" } ),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	amount: doublePrecision().notNull(),
	id: uuid().defaultRandom().primaryKey(),
});

export const lineItems = pgTable("line_items", {
	id: text().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
	updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
	name: text().notNull(),
	orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" } ),
	variantId: text("variant_id").references(() => productVariants.id, { onDelete: "cascade" } ),
	productId: text("product_id").references(() => products.id, { onDelete: "cascade" } ),
	completionStatus: lineItemCompletionStatus("completion_status").default("not_printed").notNull(),
	quantity: bigint({ mode: 'number' }).default(1).notNull(),
	hasDeprecatedBlankStock: boolean("has_deprecated_blank_stock"),
	hasDeprecatedVariantStock: boolean("has_deprecated_variant_stock"),
	markedAsPackaged: boolean("marked_as_packaged").default(false).notNull(),
});

export const logs = pgTable("logs", {
	id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	type: logType().default("INFO").notNull(),
	category: orderLogCategory(),
	message: text().notNull(),
	orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" } ),
	profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" } ),
	metadata: jsonb(),
});

export const orderHolds = pgTable("order_holds", {
	id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	cause: orderHoldCause().notNull(),
	reasonNotes: text("reason_notes").notNull(),
	isResolved: boolean("is_resolved").default(false).notNull(),
	orderId: text("order_id").notNull().references(() => orders.id),
	orderNumber: text("order_number").notNull(),
});

export const orderNotes = pgTable("order_notes", {
	id: uuid().defaultRandom().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" } ),
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
}, (table) => [
	index("orders_name_idx").using("btree", table.name.asc().nullsLast()),

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const ordersBatches = pgTable("orders_batches", {
	orderId: text("order_id").notNull().references(() => orders.id),
	batchId: integer("batch_id").notNull().references(() => batches.id, { onDelete: "cascade" } ),
}, (table) => [
	primaryKey({ columns: [table.orderId, table.batchId], name: "orders_session_batches_pkey"}),
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
	lineItemId: text("line_item_id").notNull().references(() => lineItems.id, { onDelete: "cascade" } ),
	printId: uuid("print_id").references(() => prints.id, { onDelete: "set null" } ),
	active: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
});

export const prints = pgTable("prints", {
	id: uuid().defaultRandom().primaryKey(),
	location: printLocation().notNull(),
	heatTransferCode: text("heat_transfer_code"),
	isSmallPrint: boolean("is_small_print"),
	productId: text("product_id").references(() => products.id, { onDelete: "cascade" } ),
});

export const productVariants = pgTable.withRLS("product_variants", {
	id: text().primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
	updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
	title: text().notNull(),
	price: text().notNull(),
	productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" } ),
	warehouseInventory: integer("warehouse_inventory").default(0).notNull(),
	blankVariantId: uuid("blank_variant_id").references(() => blankVariants.id, { onDelete: "set null" } ),
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
	blankId: uuid("blank_id").references(() => blanks.id, { onDelete: "set null" } ),
	isBlackLabel: boolean("is_black_label").default(false).notNull(),
}, (table) => [

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
	username: text().notNull(),
	email: text().notNull(),
	creatorVendorName: text("creator_vendor_name"),
	role: userRole().default("staff").notNull(),
}, (table) => [
	unique("creator profiles_vendor_name_key").on(table.creatorVendorName),	unique("profiles_email_key").on(table.email),	unique("profiles_username_key").on(table.username),
	pgPolicy("Enable read access for all users", { for: "select", using: sql`true` }),
]);

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
}, (table) => [

	pgPolicy("Enable insert for authenticated users only", { to: ["authenticated"], using: sql`(auth.uid() IS NOT NULL)` }),
]);

export const tasks = pgTable("tasks", {
	id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
	completedItems: bigint({ mode: 'number' }).notNull(),
	totalItems: bigint({ mode: 'number' }).notNull(),
	status: taskStatus().notNull(),
});
