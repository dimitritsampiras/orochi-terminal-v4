import {
  pgEnum,
  pgTable,
  bigserial,
  bigint,
  text,
  timestamp,
  uuid,
  integer,
  doublePrecision,
  numeric,
  boolean,
  json,
  jsonb,
  index,
  uniqueIndex,
  foreignKey,
  primaryKey,
  unique,
  pgPolicy,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const fulfillmentPriority = pgEnum("fulfillment_priority", [
  "normal",
  "urgent",
  "critical",
  "low",
  "priority",
]);
export const shippingPriority = pgEnum("shipping_priority", [
  "express",
  "fastest",
  "standard",
]);
export const displayFulfillmentStatus = pgEnum("display_fulfillment_status", [
  "FULFILLED",
  "IN_PROGRESS",
  "ON_HOLD",
  "OPEN",
  "PARTIALLY_FULFILLED",
  "PENDING_FULFILLMENT",
  "RESTOCKED",
  "SCHEDULED",
  "UNFULFILLED",
  "REQUEST_DECLINED",
]);
export const printLocation = pgEnum("print_location", [
  "front",
  "back",
  "left_sleeve",
  "right_sleeve",
  "other",
]);
export const lineItemCompletionStatus = pgEnum("line_item_completion_status", [
  "not_printed",
  "partially_printed",
  "printed",
  "in_stock",
  "oos_blank",
  "skipped",
  "ignore",
]);
export const garmentType = pgEnum("garment_type", [
  "coat",
  "jacket",
  "hoodie",
  "crewneck",
  "longsleeve",
  "tee",
  "shorts",
  "sweatpants",
  "headwear",
  "accessory",
]);
export const garmentSize = pgEnum("garment_size", [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "os",
]);
export const productStatus = pgEnum("product_status", [
  "ACTIVE",
  "DRAFT",
  "ARCHIVED",
  "UNLISTED",
]);
export const logType = pgEnum("log_type", ["INFO", "WARN", "ERROR"]);
export const orderLogCategory = pgEnum("order_log_category", [
  "SHIPPING",
  "ASSEMBLY",
  "AUTOMATED",
]);
export const shipmentApi = pgEnum("shipment_api", ["SHIPPO", "EASYPOST"]);
export const taskStatus = pgEnum("task_status", [
  "running",
  "completed",
  "cancelled",
]);
export const userRole = pgEnum("user_role", [
  "admin",
  "superadmin",
  "staff",
  "creator",
  "va",
  "warehouse",
]);
export const userRoleV4 = pgEnum("user_role_v4", [
  "admin",
  "super_admin",
  "warehouse_staff",
  "customer_support",
  "operator"
]);
export const batchDocumentType = pgEnum("batch_document_type", [
  "assembly_list",
  "picking_list",
  "merged_label_slips",
]);
export const orderHoldCause = pgEnum("order_hold_cause", [
  "address_issue",
  "shipping_issue",
  "stock_shortage",
  "other",
]);
export const pretreat = pgEnum("pretreat", ["light", "dark"]);
export const inventoryTransactionReason = pgEnum(
  "inventory_transaction_reason",
  [
    "manual_adjustment",
    "assembly_usage",
    "restock",
    "return",
    "stock_take",
    "correction",
    "manual_print",
    "defected_item",
    "misprint"
  ],
);

export const expenseCategory = pgEnum("expense_category", [
  "rent",
  "utilities",
  "subscriptions",
  "salary",
  "marketing_meta",
  "marketing_google",
  "sponsorship",
  "other",
]);

export const batchDocuments = pgTable(
  "batch_documents",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    documentPath: text("document_path").primaryKey(),
    name: text().default("").notNull(),
    batchId: integer("batch_id").references(() => batches.id, {
      onDelete: "cascade",
    }),
    documentNotes: text("document_notes").default("").notNull(),
    documentType: batchDocumentType("document_type").notNull(),
    mergedPdfOrderIds: text("merged_pdf_order_ids").array(),
    /** Groups documents generated together (picking list + assembly list share same group number) */
    documentGroup: bigint("document_group", { mode: "number" }).default(1).notNull(),
  },
  (table) => [
    unique("batch_documents_document_path_key").on(table.documentPath),
  ],
);

export const batches = pgTable.withRLS(
  "batches",
  {
    id: integer()
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: "session_batch_id_seq" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    active: boolean().default(false).notNull(),
    pickingListJson: jsonb("picking_list_json"),
    assemblyLineJson: text("assembly_line_json"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    premadeStockVerifiedAt: timestamp("premade_stock_verified_at", {
      withTimezone: true,
    }),
    premadeStockRequirementsJson: text("premade_stock_requirements_json"),
    blankStockVerifiedAt: timestamp("blank_stock_verified_at", {
      withTimezone: true,
    }),
    blankStockRequirementsJson: text("blank_stock_requirements_json"),
    itemSyncVerifiedAt: timestamp("item_sync_verified_at", {
      withTimezone: true,
    }),
    shipmentsVerifiedAt: timestamp("shipments_verified_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    uniqueIndex("unique_active")
      .using("btree", table.active.asc().nullsLast())
      .where(sql`active`),

    pgPolicy("Enable insert for authenticated users only", {
      to: ["authenticated"],
      using: sql`(auth.uid() IS NOT NULL)`,
    }),
  ],
);

export const blankVariants = pgTable(
  "blank_variants",
  {
    id: uuid().defaultRandom().primaryKey(),
    size: garmentSize().notNull(),
    color: text().notNull(),
    blankId: uuid("blank_id")
      .notNull()
      .references(() => blanks.id, { onDelete: "cascade" }),
    weight: doublePrecision().notNull(),
    volume: doublePrecision().notNull(),
    quantity: bigint({ mode: "number" }).default(0).notNull(),
  },
  (table) => [
    unique("blank_variants_color_size_blank_id_key").on(
      table.color,
      table.size,
      table.blankId,
    ),
  ],
);

export const blanks = pgTable.withRLS(
  "blanks",
  {
    id: uuid().defaultRandom().primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    blankCompany: text("blank_company").notNull(),
    blankName: text("blank_name").notNull(),
    garmentType: garmentType("garment_type").notNull(),
    links: text().array().notNull(),
    customsPrice: doublePrecision("customs_price").notNull(),
    hsCode: text("hs_code"),
    productNameGarmentType: text("product_name_garment_type"),
  },
);

export const creatorPayout = pgTable("creator_payout", {
  creatorName: text("creator_name")
    .notNull()
    .references(() => profiles.creatorVendorName, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  amount: doublePrecision().notNull(),
  id: uuid().defaultRandom().primaryKey(),
});

export const inventoryTransactions = pgTable.withRLS("inventory_transactions", {
  id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  blankVariantId: uuid("blank_variant_id").references(() => blankVariants.id),
  productVariantId: text("product_variant_id").references(
    () => productVariants.id,
  ),
  profileId: uuid("profile_id").references(() => profiles.id),
  changeAmount: bigint("change_amount", { mode: "number" }).notNull(),
  previousQuantity: bigint("previous_quantity", { mode: "number" }).notNull(),
  newQuantity: bigint("new_quantity", { mode: "number" }).notNull(),
  reason: inventoryTransactionReason().notNull(),
  lineItemId: text("line_item_id").references(() => lineItems.id),
  logId: bigint("log_id", { mode: "number" }).references(() => logs.id),
  batchId: integer("batch_id").references(() => batches.id),
});

export const lineItems = pgTable("line_items", {
  id: text().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(
    sql`now()`,
  ),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(
    sql`now()`,
  ),
  name: text().notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  variantId: text("variant_id").references(() => productVariants.id, {
    onDelete: "cascade",
  }),
  productId: text("product_id").references(() => products.id, {
    onDelete: "cascade",
  }),
  completionStatus: lineItemCompletionStatus("completion_status")
    .default("not_printed")
    .notNull(),
  quantity: bigint({ mode: "number" }).default(1).notNull(),
  hasDeprecatedBlankStock: boolean("has_deprecated_blank_stock"),
  hasDeprecatedVariantStock: boolean("has_deprecated_variant_stock"),
  markedAsPackaged: boolean("marked_as_packaged").default(false).notNull(),
  requiresShipping: boolean("requires_shipping").default(true).notNull(),
  unfulfilledQuantity: integer("unfulfilled_quantity").default(1).notNull(),
});

export const logs = pgTable("logs", {
  id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  type: logType().default("INFO").notNull(),
  category: orderLogCategory(),
  message: text().notNull(),
  orderId: text("order_id").references(() => orders.id, {
    onDelete: "cascade",
  }),
  profileId: uuid("profile_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  metadata: jsonb(),
  batchId: integer("batch_id").references(() => batches.id, {
    onDelete: "set null",
  }),
  lineItemId: text("line_item_id").references(() => lineItems.id, {
    onDelete: "set null",
  }),
});

export const orderHolds = pgTable("order_holds", {
  id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  cause: orderHoldCause().notNull(),
  reasonNotes: text("reason_notes").notNull(),
  isResolved: boolean("is_resolved").default(false).notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  orderNumber: text("order_number").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedNotes: text("resolved_notes"),
});

export const orderNotes = pgTable("order_notes", {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id),
  note: text().notNull(),
});

export const orders = pgTable.withRLS(
  "orders",
  {
    id: text().primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`now()`,
    ),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`now()`,
    ),
    name: text().notNull(),
    queued: boolean().default(true).notNull(),
    fulfillmentPriority: fulfillmentPriority("fulfillment_priority")
      .default("normal")
      .notNull(),
    shippingPriority: shippingPriority("shipping_priority")
      .default("standard")
      .notNull(),
    displayFulfillmentStatus: displayFulfillmentStatus(
      "display_fulfillment_status",
    ).notNull(),
    displayCustomerName: text("display_customer_name"),
    displayDestinationCountryName: text("display_destination_country_name"),
    displayDestinationCountryCode: text("display_destination_country_code"),
    displayIsCancelled: boolean("display_is_cancelled")
      .default(false)
      .notNull(),
    displayPriorityReason: text("display_priority_reason"),
  },
  (table) => [
    index("orders_name_idx").using("btree", table.name.asc().nullsLast()),

    pgPolicy("Enable insert for authenticated users only", {
      to: ["authenticated"],
      using: sql`(auth.uid() IS NOT NULL)`,
    }),
  ],
);

export const ordersBatches = pgTable(
  "orders_batches",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    batchId: integer("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.orderId, table.batchId],
      name: "orders_session_batches_pkey",
    }),
  ],
);

export const parcelTemplates = pgTable("parcel_templates", {
  id: bigserial({ mode: "number" }).primaryKey(),
  name: text().notNull(),
  widthCm: numeric("width_cm", { precision: 6, scale: 2 }).notNull(),
  lengthCm: numeric("length_cm", { precision: 6, scale: 2 }).notNull(),
  heightCm: numeric("height_cm", { precision: 6, scale: 2 }).notNull(),
  maxVolume: integer("max_volume").notNull(),
});

export const printLogs = pgTable("print_logs", {
  id: uuid().defaultRandom().primaryKey(),
  lineItemId: text("line_item_id")
    .notNull()
    .references(() => lineItems.id, { onDelete: "cascade" }),
  printId: uuid("print_id").references(() => prints.id, {
    onDelete: "set null",
  }),
  active: boolean().default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(
    sql`(now() AT TIME ZONE 'utc'::text)`,
  ),
});

export const prints = pgTable("prints", {
  id: uuid().defaultRandom().primaryKey(),
  location: printLocation().notNull(),
  heatTransferCode: text("heat_transfer_code"),
  isSmallPrint: boolean("is_small_print"),
  productId: text("product_id").references(() => products.id, {
    onDelete: "cascade",
  }),
  pretreat: pretreat(),
});

export const productVariants = pgTable.withRLS(
  "product_variants",
  {
    id: text().primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`now()`,
    ),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`now()`,
    ),
    title: text().notNull(),
    price: text().notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseInventory: integer("warehouse_inventory").default(0).notNull(),
    blankVariantId: uuid("blank_variant_id").references(
      () => blankVariants.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    pgPolicy("Enable insert for authenticated users only", {
      to: ["authenticated"],
      using: sql`(auth.uid() IS NOT NULL)`,
    }),
  ],
);

export const products = pgTable.withRLS(
  "products",
  {
    id: text().primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`now()`,
    ),
    updatedAt: timestamp("updated_at", { withTimezone: true }).default(
      sql`now()`,
    ),
    title: text().notNull(),
    vendor: text().notNull(),
    status: productStatus().default("DRAFT").notNull(),
    blankId: uuid("blank_id").references(() => blanks.id, {
      onDelete: "set null",
    }),
    isBlackLabel: boolean("is_black_label").default(false).notNull(),
  },
  (table) => [
    pgPolicy("Enable insert for authenticated users only", {
      to: ["authenticated"],
      using: sql`(auth.uid() IS NOT NULL)`,
    }),
  ],
);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).default(
      sql`now()`,
    ),
    username: text().notNull(),
    email: text().notNull(),
    creatorVendorName: text("creator_vendor_name"),
    role: userRole().default("staff").notNull(),
    roleV4: userRoleV4("role_v4").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    unique("creator profiles_vendor_name_key").on(table.creatorVendorName),
    unique("profiles_email_key").on(table.email),
    unique("profiles_username_key").on(table.username),
    pgPolicy("Enable read access for all users", {
      for: "select",
      using: sql`true`,
    }),
  ],
);

export const shipments = pgTable.withRLS(
  "shipments",
  {
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    api: shipmentApi().default("SHIPPO").notNull(),
    shipmentId: text("shipment_id").notNull(),
    chosenRateId: text("chosen_rate_id"),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
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
  },
  (table) => [
    pgPolicy("Enable insert for authenticated users only", {
      to: ["authenticated"],
      using: sql`(auth.uid() IS NOT NULL)`,
    }),
  ],
);

export const tasks = pgTable("tasks", {
  id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  completedItems: bigint({ mode: "number" }).notNull(),
  totalItems: bigint({ mode: "number" }).notNull(),
  status: taskStatus().notNull(),
});

export const warehouseExpenses = pgTable("warehouse_expenses", {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  category: expenseCategory("category").notNull(),
  amount: doublePrecision().notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  notes: text("notes"),
  batchId: integer("batch_id").references(() => batches.id, { onDelete: "set null" }),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
});

export const globalSettings = pgTable("global_settings", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),

  // Per-item production costs
  inkCostPerItem: doublePrecision("ink_cost_per_item").default(1.20).notNull(),
  printerRepairCostPerItem: doublePrecision("printer_repair_cost_per_item").default(0.45).notNull(),
  pretreatCostPerItem: doublePrecision("pretreat_cost_per_item").default(0.27).notNull(),
  electricityCostPerItem: doublePrecision("electricity_cost_per_item").default(0.24).notNull(),
  neckLabelCostPerItem: doublePrecision("neck_label_cost_per_item").default(0.08).notNull(),
  parchmentPaperCostPerItem: doublePrecision("parchment_paper_cost_per_item").default(0.06).notNull(),

  // Per-order fulfillment costs
  thankYouCardCostPerOrder: doublePrecision("thank_you_card_cost_per_order").default(0.14).notNull(),
  polymailerCostPerOrder: doublePrecision("polymailer_cost_per_order").default(0.09).notNull(),
  cleaningSolutionCostPerOrder: doublePrecision("cleaning_solution_cost_per_order").default(0.08).notNull(),
  integratedPaperCostPerOrder: doublePrecision("integrated_paper_cost_per_order").default(0.06).notNull(),
  blankPaperCostPerOrder: doublePrecision("blank_paper_cost_per_order").default(0.02).notNull(),

  // Other settings
  supplementaryItemCost: doublePrecision("supplementary_item_cost").default(0).notNull(),
  misprintCostMultiplier: doublePrecision("misprint_cost_multiplier").default(1.0).notNull(),
  costBufferPercentage: doublePrecision("cost_buffer_percentage").default(10.0).notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

export const recurringExpenseFrequency = pgEnum("recurring_expense_frequency", ["weekly", "monthly", "yearly"]);

export const recurringExpenses = pgTable("recurring_expenses", {
  id: uuid().defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  name: text().notNull(),
  amount: doublePrecision().notNull(),
  frequency: recurringExpenseFrequency().notNull(),
  category: expenseCategory("category").default("other").notNull(),
  active: boolean().default(true).notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
});

export const shippingRateCache = pgTable("shipping_rate_cache", {
  id: uuid().defaultRandom().primaryKey(),
  orderId: text("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  rate: jsonb().notNull(), // Stores the NormalizedShipmentRate
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

