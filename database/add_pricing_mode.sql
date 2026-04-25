-- Additive migration: add pricing_mode to categories
-- Controls how quantity-based categories calculate totals.
-- Safe to re-run — uses IF NOT EXISTS / DO NOTHING patterns.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) NOT NULL DEFAULT 'total';

-- Ensure existing quantity_based rows default to 'total'
UPDATE categories
  SET pricing_mode = 'total'
  WHERE pricing_mode IS NULL;
