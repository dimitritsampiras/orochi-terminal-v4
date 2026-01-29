-- Migration: Remove legacy cost settings from global_settings table
-- Safe to run - only drops unused legacy columns

-- Drop legacy columns that are no longer needed
ALTER TABLE "global_settings"
DROP COLUMN IF EXISTS "ink_cost_per_print";

ALTER TABLE "global_settings"
DROP COLUMN IF EXISTS "bag_cost_per_order";

ALTER TABLE "global_settings"
DROP COLUMN IF EXISTS "label_cost_per_order";

ALTER TABLE "global_settings"
DROP COLUMN IF EXISTS "ink_cost_per_design";
