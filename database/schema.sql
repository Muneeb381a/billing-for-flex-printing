-- ============================================================
-- PRINTING PRESS ERP — PostgreSQL Schema
-- ============================================================

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE pricing_model_type AS ENUM (
  'area_based',     -- Flex: width(ft) × height(ft) × qty × rate/sqft
  'quantity_based', -- Business Cards: tiered price by quantity
  'fixed_charge',   -- Fixed price (e.g., design template)
  'custom'          -- Manual price override per bill item
);

CREATE TYPE order_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'delivered',
  'cancelled'
);

CREATE TYPE payment_method AS ENUM (
  'cash',
  'bank_transfer',
  'cheque',
  'online'
);

CREATE TYPE discount_type AS ENUM (
  'fixed',       -- flat PKR amount
  'percentage'   -- % of subtotal
);

-- ============================================================
-- SEQUENCE: Human-readable bill numbers  PP-2024-0001
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS bill_number_seq START 1001 INCREMENT 1;

-- ============================================================
-- TABLE: customers
-- ============================================================

CREATE TABLE customers (
  id         SERIAL        PRIMARY KEY,
  name       VARCHAR(255)  NOT NULL,
  phone      VARCHAR(20)   NOT NULL UNIQUE,
  email      VARCHAR(255),
  address    TEXT,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_name  ON customers (name);
CREATE INDEX idx_customers_phone ON customers (phone);

-- ============================================================
-- TABLE: categories
-- Flex Printing, Offset Printing, Digital Printing, etc.
-- ============================================================

CREATE TABLE categories (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(255)  NOT NULL UNIQUE,
  slug        VARCHAR(255)  NOT NULL UNIQUE, -- 'flex-printing', 'offset-printing'
  description TEXT,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: subcategories
-- Material types / product families within a category.
-- Flex Printing → Star Flex | China Flex | Mesh Flex | Backlit Flex
-- Offset Printing → Business Cards | Flyers | Brochures | Letterheads
-- Digital Printing → Stickers | Vinyl | Photo Prints | Banners
-- ============================================================

CREATE TABLE subcategories (
  id          SERIAL        PRIMARY KEY,
  category_id INTEGER       NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  name        VARCHAR(255)  NOT NULL,
  description TEXT,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, name)
);

CREATE INDEX idx_subcategories_category ON subcategories (category_id);

-- ============================================================
-- TABLE: products
-- Star Flex, China Flex, Business Cards, Flyers, Stickers...
-- ============================================================

CREATE TABLE products (
  id              SERIAL              PRIMARY KEY,
  category_id     INTEGER             NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  subcategory_id  INTEGER             REFERENCES subcategories (id) ON DELETE SET NULL,
  name            VARCHAR(255)        NOT NULL,
  description   TEXT,
  pricing_model pricing_model_type  NOT NULL,
  -- base_price meaning varies by model:
  --   area_based    → price per sqft
  --   fixed_charge  → the fixed amount
  --   quantity_based → ignored (see quantity_tiers)
  --   custom        → ignored (entered per bill)
  base_price    NUMERIC(10, 2),
  unit          VARCHAR(50)         NOT NULL DEFAULT 'sqft', -- sqft | pcs | set | sheet
  is_active     BOOLEAN             NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category_id    ON products (category_id);
CREATE INDEX idx_products_subcategory_id ON products (subcategory_id);
CREATE INDEX idx_products_is_active      ON products (is_active);

-- ============================================================
-- TABLE: product_specifications
-- Generic key-value for product-specific attributes.
-- Business Cards: paper_type=350gsm, size=3.5x2, sides=double
-- ============================================================

CREATE TABLE product_specifications (
  id         SERIAL       PRIMARY KEY,
  product_id INTEGER      NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  spec_key   VARCHAR(100) NOT NULL, -- 'paper_type' | 'size' | 'printing_sides'
  spec_value VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, spec_key)
);

CREATE INDEX idx_product_specs_product ON product_specifications (product_id);

-- ============================================================
-- TABLE: pricing_rules
-- For area_based → price_per_sqft (with optional minimum sqft)
-- For fixed_charge → fixed_price
-- Supports effective date range for price history tracking
-- ============================================================

CREATE TABLE pricing_rules (
  id             SERIAL         PRIMARY KEY,
  product_id     INTEGER        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  price_per_sqft NUMERIC(10, 2),            -- area_based
  min_sqft       NUMERIC(10, 2) DEFAULT 1,  -- minimum billable sqft
  fixed_price    NUMERIC(10, 2),            -- fixed_charge
  effective_from DATE           NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE,                      -- NULL = currently active
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pricing_rule_has_value
    CHECK (price_per_sqft IS NOT NULL OR fixed_price IS NOT NULL)
);

CREATE INDEX idx_pricing_rules_product    ON pricing_rules (product_id);
CREATE INDEX idx_pricing_rules_effective  ON pricing_rules (effective_from, effective_to);

-- ============================================================
-- TABLE: quantity_tiers
-- Business Cards: 100 pcs → 500 PKR, 500 pcs → 1800 PKR, etc.
-- Query pattern: WHERE product_id=$1 AND min_qty <= $qty
--               ORDER BY min_qty DESC LIMIT 1
-- ============================================================

CREATE TABLE quantity_tiers (
  id         SERIAL         PRIMARY KEY,
  product_id INTEGER        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  min_qty    INTEGER        NOT NULL CHECK (min_qty > 0),
  max_qty    INTEGER,                   -- NULL = no upper bound
  price      NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_qty_tier_range
    CHECK (max_qty IS NULL OR max_qty >= min_qty),
  UNIQUE (product_id, min_qty)
);

CREATE INDEX idx_quantity_tiers_product ON quantity_tiers (product_id);
CREATE INDEX idx_quantity_tiers_lookup  ON quantity_tiers (product_id, min_qty DESC);

-- ============================================================
-- TABLE: bills
-- The main invoice. Financial totals are denormalized here
-- for fast dashboard queries. App layer keeps them in sync.
-- ============================================================

CREATE TABLE bills (
  id                SERIAL         PRIMARY KEY,
  bill_number       VARCHAR(50)    NOT NULL UNIQUE,
  customer_id       INTEGER        NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  status            order_status   NOT NULL DEFAULT 'pending',

  -- Financial summary (app-maintained, updated on every item change)
  subtotal          NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_type     discount_type  NOT NULL DEFAULT 'fixed',
  discount_value    NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  discount_amount   NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  extra_charges     NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (extra_charges >= 0),
  total_amount      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  advance_paid      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (advance_paid >= 0),
  remaining_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,

  notes             TEXT,
  due_date          DATE,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bills_customer_id  ON bills (customer_id);
CREATE INDEX idx_bills_status       ON bills (status);
CREATE INDEX idx_bills_created_at   ON bills (created_at DESC);
CREATE INDEX idx_bills_bill_number  ON bills (bill_number);

-- ============================================================
-- TABLE: bill_items
-- Each row = one product line in the invoice.
-- Dynamic inputs stored as columns; sqft is computed and stored.
-- ============================================================

CREATE TABLE bill_items (
  id            SERIAL              PRIMARY KEY,
  bill_id       INTEGER             NOT NULL REFERENCES bills (id) ON DELETE CASCADE,
  product_id    INTEGER             NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  description   TEXT,               -- custom label (overrides product name on invoice)
  pricing_model pricing_model_type  NOT NULL,

  -- Area-based inputs (Flex printing)
  width         NUMERIC(10, 3),     -- in feet
  height        NUMERIC(10, 3),     -- in feet
  sqft          NUMERIC(10, 3),     -- computed: width × height (stored for invoice display)

  -- Quantity (all models use this)
  quantity      INTEGER             NOT NULL DEFAULT 1 CHECK (quantity > 0),

  -- Pricing resolved at time of billing (snapshot — price can change later)
  unit_price    NUMERIC(10, 2)      NOT NULL CHECK (unit_price >= 0),
  item_total    NUMERIC(10, 2)      NOT NULL CHECK (item_total >= 0),

  -- Optional per-item surcharges
  design_fee    NUMERIC(10, 2)      NOT NULL DEFAULT 0,
  urgent_fee    NUMERIC(10, 2)      NOT NULL DEFAULT 0,

  notes         TEXT,
  sort_order    INTEGER             NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bill_items_bill_id    ON bill_items (bill_id);
CREATE INDEX idx_bill_items_product_id ON bill_items (product_id);

-- ============================================================
-- TABLE: bill_extra_charges
-- Open-ended extra charges at bill level.
-- e.g., 'Rush Delivery', 'Lamination', 'Mounting'
-- ============================================================

CREATE TABLE bill_extra_charges (
  id         SERIAL         PRIMARY KEY,
  bill_id    INTEGER        NOT NULL REFERENCES bills (id) ON DELETE CASCADE,
  label      VARCHAR(255)   NOT NULL,
  amount     NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bill_extra_charges_bill ON bill_extra_charges (bill_id);

-- ============================================================
-- TABLE: payments
-- Source of truth for the customer ledger.
-- Every payment (including initial advance) is a row here.
-- ============================================================

CREATE TABLE payments (
  id               SERIAL           PRIMARY KEY,
  bill_id          INTEGER          NOT NULL REFERENCES bills (id) ON DELETE RESTRICT,
  customer_id      INTEGER          NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  amount           NUMERIC(10, 2)   NOT NULL CHECK (amount > 0),
  payment_method   payment_method   NOT NULL DEFAULT 'cash',
  payment_date     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  reference_number VARCHAR(100),    -- cheque number / bank reference
  notes            TEXT,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_bill_id     ON payments (bill_id);
CREATE INDEX idx_payments_customer_id ON payments (customer_id);
CREATE INDEX idx_payments_date        ON payments (payment_date DESC);

-- ============================================================
-- FUNCTION + TRIGGERS: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- FUNCTION: generate_bill_number()
-- Produces: PP-2024-0001
-- Called by application before INSERT into bills
-- ============================================================

CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS VARCHAR
LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'PP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('bill_number_seq')::TEXT, 4, '0');
END;
$$;

-- ============================================================
-- VIEW: customer_ledger
-- Aggregates billing and payment data per customer
-- ============================================================

CREATE VIEW customer_ledger AS
SELECT
  c.id                                          AS customer_id,
  c.name                                        AS customer_name,
  c.phone,
  COUNT(DISTINCT b.id)                          AS total_bills,
  COALESCE(SUM(b.total_amount),       0)        AS total_billed,
  COALESCE(SUM(p.total_paid),         0)        AS total_paid,
  COALESCE(SUM(b.total_amount), 0)
    - COALESCE(SUM(p.total_paid), 0)            AS outstanding_balance
FROM customers c
LEFT JOIN bills b
  ON b.customer_id = c.id
LEFT JOIN (
  SELECT bill_id, SUM(amount) AS total_paid
  FROM payments
  GROUP BY bill_id
) p ON p.bill_id = b.id
GROUP BY c.id, c.name, c.phone;

-- ============================================================
-- TABLE: expenses
-- ============================================================

CREATE TABLE expenses (
  id             SERIAL PRIMARY KEY,
  title          VARCHAR(255)    NOT NULL,
  amount         NUMERIC(12, 2)  NOT NULL CHECK (amount >= 0),
  category       VARCHAR(100),
  payment_method payment_method  NOT NULL DEFAULT 'cash',
  expense_date   DATE            NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses (expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses (category);

-- ============================================================
-- VIEW: daily_sales
-- Used by the Dashboard for daily/monthly reports
-- ============================================================

CREATE VIEW daily_sales AS
SELECT
  DATE(b.created_at)                            AS sale_date,
  COUNT(b.id)                                   AS bill_count,
  COALESCE(SUM(b.total_amount),  0)             AS total_sales,
  COALESCE(SUM(p.total_paid),    0)             AS total_collected,
  COALESCE(SUM(b.total_amount),  0)
    - COALESCE(SUM(p.total_paid), 0)            AS pending_collection
FROM bills b
LEFT JOIN (
  SELECT bill_id, SUM(amount) AS total_paid
  FROM payments
  GROUP BY bill_id
) p ON p.bill_id = b.id
GROUP BY DATE(b.created_at)
ORDER BY sale_date DESC;

-- ============================================================
-- SEED: Default categories
-- ============================================================

INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Flex Printing',    'flex-printing',    'Large format flex banners and signage',   1),
  ('Offset Printing',  'offset-printing',  'Business cards, flyers, brochures',       2),
  ('Digital Printing', 'digital-printing', 'Stickers, photo prints, digital outputs', 3);

-- ============================================================
-- SEED: Subcategories (material types / product families)
-- ============================================================

INSERT INTO subcategories (category_id, name, sort_order) VALUES
  -- Flex Printing
  ((SELECT id FROM categories WHERE slug='flex-printing'), 'Star Flex',    1),
  ((SELECT id FROM categories WHERE slug='flex-printing'), 'China Flex',   2),
  ((SELECT id FROM categories WHERE slug='flex-printing'), 'Mesh Flex',    3),
  ((SELECT id FROM categories WHERE slug='flex-printing'), 'Backlit Flex', 4),
  -- Offset Printing
  ((SELECT id FROM categories WHERE slug='offset-printing'), 'Business Cards', 1),
  ((SELECT id FROM categories WHERE slug='offset-printing'), 'Flyers',         2),
  ((SELECT id FROM categories WHERE slug='offset-printing'), 'Brochures',      3),
  ((SELECT id FROM categories WHERE slug='offset-printing'), 'Letterheads',    4),
  -- Digital Printing
  ((SELECT id FROM categories WHERE slug='digital-printing'), 'Stickers',    1),
  ((SELECT id FROM categories WHERE slug='digital-printing'), 'Vinyl',       2),
  ((SELECT id FROM categories WHERE slug='digital-printing'), 'Photo Prints',3),
  ((SELECT id FROM categories WHERE slug='digital-printing'), 'Banners',     4);

-- ============================================================
-- SEED: Sample products (customize pricing per your shop)
-- ============================================================

INSERT INTO products (category_id, subcategory_id, name, pricing_model, base_price, unit) VALUES
  -- Flex → Star Flex
  ((SELECT id FROM categories WHERE slug='flex-printing'),
   (SELECT id FROM subcategories WHERE name='Star Flex'),
   'Star Flex Standard', 'area_based', 120.00, 'sqft'),
  ((SELECT id FROM categories WHERE slug='flex-printing'),
   (SELECT id FROM subcategories WHERE name='Star Flex'),
   'Star Flex Premium',  'area_based', 140.00, 'sqft'),
  -- Flex → China Flex
  ((SELECT id FROM categories WHERE slug='flex-printing'),
   (SELECT id FROM subcategories WHERE name='China Flex'),
   'China Flex Economy', 'area_based',  80.00, 'sqft'),
  ((SELECT id FROM categories WHERE slug='flex-printing'),
   (SELECT id FROM subcategories WHERE name='China Flex'),
   'China Flex Standard','area_based',  90.00, 'sqft'),
  -- Flex → Backlit Flex
  ((SELECT id FROM categories WHERE slug='flex-printing'),
   (SELECT id FROM subcategories WHERE name='Backlit Flex'),
   'Backlit Flex',       'area_based', 150.00, 'sqft'),
  -- Flex → Mesh Flex
  ((SELECT id FROM categories WHERE slug='flex-printing'),
   (SELECT id FROM subcategories WHERE name='Mesh Flex'),
   'Mesh Flex',          'area_based', 110.00, 'sqft'),
  -- Offset → Business Cards
  ((SELECT id FROM categories WHERE slug='offset-printing'),
   (SELECT id FROM subcategories WHERE name='Business Cards'),
   'Business Cards 350GSM', 'quantity_based', NULL, 'pcs'),
  ((SELECT id FROM categories WHERE slug='offset-printing'),
   (SELECT id FROM subcategories WHERE name='Business Cards'),
   'Business Cards 250GSM', 'quantity_based', NULL, 'pcs'),
  -- Offset → Flyers
  ((SELECT id FROM categories WHERE slug='offset-printing'),
   (SELECT id FROM subcategories WHERE name='Flyers'),
   'Flyers A5', 'quantity_based', NULL, 'pcs'),
  ((SELECT id FROM categories WHERE slug='offset-printing'),
   (SELECT id FROM subcategories WHERE name='Flyers'),
   'Flyers A4', 'quantity_based', NULL, 'pcs'),
  -- Offset → Brochures
  ((SELECT id FROM categories WHERE slug='offset-printing'),
   (SELECT id FROM subcategories WHERE name='Brochures'),
   'Brochures A4 Tri-Fold', 'quantity_based', NULL, 'pcs'),
  -- Offset → Letterheads
  ((SELECT id FROM categories WHERE slug='offset-printing'),
   (SELECT id FROM subcategories WHERE name='Letterheads'),
   'Letterhead A4', 'quantity_based', NULL, 'pcs'),
  -- Digital → Stickers
  ((SELECT id FROM categories WHERE slug='digital-printing'),
   (SELECT id FROM subcategories WHERE name='Stickers'),
   'Vinyl Stickers',  'area_based', 200.00, 'sqft'),
  ((SELECT id FROM categories WHERE slug='digital-printing'),
   (SELECT id FROM subcategories WHERE name='Stickers'),
   'Paper Stickers',  'area_based', 150.00, 'sqft'),
  -- Digital → Vinyl
  ((SELECT id FROM categories WHERE slug='digital-printing'),
   (SELECT id FROM subcategories WHERE name='Vinyl'),
   'Vinyl Banner',         'area_based', 180.00, 'sqft'),
  ((SELECT id FROM categories WHERE slug='digital-printing'),
   (SELECT id FROM subcategories WHERE name='Vinyl'),
   'One-Way Vision Vinyl', 'area_based', 250.00, 'sqft'),
  -- Digital → Photo Prints
  ((SELECT id FROM categories WHERE slug='digital-printing'),
   (SELECT id FROM subcategories WHERE name='Photo Prints'),
   'Photo Print 4x6',  'fixed_charge',  50.00, 'pcs'),
  ((SELECT id FROM categories WHERE slug='digital-printing'),
   (SELECT id FROM subcategories WHERE name='Photo Prints'),
   'Photo Print 8x10', 'fixed_charge', 120.00, 'pcs');

-- ============================================================
-- SEED: Quantity tiers
-- ============================================================

-- Business Cards 350GSM
INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price) VALUES
  ((SELECT id FROM products WHERE name='Business Cards 350GSM'), 100,  199,  500.00),
  ((SELECT id FROM products WHERE name='Business Cards 350GSM'), 200,  499,  800.00),
  ((SELECT id FROM products WHERE name='Business Cards 350GSM'), 500,  999, 1500.00),
  ((SELECT id FROM products WHERE name='Business Cards 350GSM'), 1000, NULL,2500.00);

-- Business Cards 250GSM
INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price) VALUES
  ((SELECT id FROM products WHERE name='Business Cards 250GSM'), 100,  199,  400.00),
  ((SELECT id FROM products WHERE name='Business Cards 250GSM'), 200,  499,  650.00),
  ((SELECT id FROM products WHERE name='Business Cards 250GSM'), 500,  999, 1200.00),
  ((SELECT id FROM products WHERE name='Business Cards 250GSM'), 1000, NULL,2000.00);

-- Flyers A5
INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price) VALUES
  ((SELECT id FROM products WHERE name='Flyers A5'), 100,  499,  800.00),
  ((SELECT id FROM products WHERE name='Flyers A5'), 500,  999, 2500.00),
  ((SELECT id FROM products WHERE name='Flyers A5'), 1000, NULL,4000.00);

-- Flyers A4
INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price) VALUES
  ((SELECT id FROM products WHERE name='Flyers A4'), 100,  499, 1200.00),
  ((SELECT id FROM products WHERE name='Flyers A4'), 500,  999, 3500.00),
  ((SELECT id FROM products WHERE name='Flyers A4'), 1000, NULL,6000.00);

-- Brochures A4 Tri-Fold
INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price) VALUES
  ((SELECT id FROM products WHERE name='Brochures A4 Tri-Fold'), 100,  499, 2000.00),
  ((SELECT id FROM products WHERE name='Brochures A4 Tri-Fold'), 500,  999, 6000.00),
  ((SELECT id FROM products WHERE name='Brochures A4 Tri-Fold'), 1000, NULL,10000.00);

-- Letterhead A4
INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price) VALUES
  ((SELECT id FROM products WHERE name='Letterhead A4'), 100,  499,  900.00),
  ((SELECT id FROM products WHERE name='Letterhead A4'), 500,  999, 3000.00),
  ((SELECT id FROM products WHERE name='Letterhead A4'), 1000, NULL,5000.00);

-- ============================================================
-- SEED: Business Card specifications
-- ============================================================

INSERT INTO product_specifications (product_id, spec_key, spec_value) VALUES
  ((SELECT id FROM products WHERE name='Business Cards 350GSM'), 'size',           '3.5 x 2 inch'),
  ((SELECT id FROM products WHERE name='Business Cards 350GSM'), 'paper_type',     '350 GSM Art Card'),
  ((SELECT id FROM products WHERE name='Business Cards 350GSM'), 'printing_sides', 'double'),
  ((SELECT id FROM products WHERE name='Business Cards 350GSM'), 'lamination',     'matte'),
  ((SELECT id FROM products WHERE name='Business Cards 250GSM'), 'size',           '3.5 x 2 inch'),
  ((SELECT id FROM products WHERE name='Business Cards 250GSM'), 'paper_type',     '250 GSM Art Card'),
  ((SELECT id FROM products WHERE name='Business Cards 250GSM'), 'printing_sides', 'single');
