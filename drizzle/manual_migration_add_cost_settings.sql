-- Migration: Add detailed cost settings to global_settings table
-- Safe to run - only adds new columns with default values

-- Per-item production costs
ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "ink_cost_per_item" double precision DEFAULT 1.20 NOT NULL;

ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "printer_repair_cost_per_item" double precision DEFAULT 0.45 NOT NULL;

ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "pretreat_cost_per_item" double precision DEFAULT 0.27 NOT NULL;

ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "electricity_cost_per_item" double precision DEFAULT 0.24 NOT NULL;

ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "neck_label_cost_per_item" double precision DEFAULT 0.08 NOT NULL;

ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "parchment_paper_cost_per_item" double precision DEFAULT 0.06 NOT NULL;

-- Per-order fulfillment costs
ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "thank_you_card_cost_per_order" double precision DEFAULT 0.14 NOT NULL;

ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "polymailer_cost_per_order" double precision DEFAULT 0.09 NOT NULL;

ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "cleaning_solution_cost_per_order" double precision DEFAULT 0.08 NOT NULL;

ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "integrated_paper_cost_per_order" double precision DEFAULT 0.06 NOT NULL;

ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "blank_paper_cost_per_order" double precision DEFAULT 0.02 NOT NULL;

-- Buffer percentage for contingency
ALTER TABLE "global_settings"
ADD COLUMN IF NOT EXISTS "cost_buffer_percentage" double precision DEFAULT 10.0 NOT NULL;
