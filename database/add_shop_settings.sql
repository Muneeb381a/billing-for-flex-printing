-- ============================================================
-- Additive migration: shop_settings singleton table
-- Run once against any database that already has the schema.
-- Safe to run on Neon — does not touch existing tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS shop_settings (
  id          INTEGER      PRIMARY KEY DEFAULT 1,
  shop_name   VARCHAR(255) NOT NULL    DEFAULT 'My Print Shop',
  tagline     TEXT                     DEFAULT 'Professional Printing Solutions',
  cta_text    VARCHAR(100) NOT NULL    DEFAULT 'Create Order',
  cta_route   VARCHAR(100) NOT NULL    DEFAULT '/bills/new',
  updated_at  TIMESTAMPTZ NOT NULL     DEFAULT NOW(),

  -- Enforces exactly one row — the app always upserts id=1
  CONSTRAINT one_row CHECK (id = 1)
);

-- Insert default row if not already present
INSERT INTO shop_settings (id, shop_name, tagline, cta_text, cta_route)
VALUES (1, 'Press ERP', 'Professional Printing Solutions', 'New Bill', '/bills/new')
ON CONFLICT (id) DO NOTHING;
