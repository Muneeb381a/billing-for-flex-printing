-- ============================================================
-- INVENTORY MANAGEMENT — Additive Migration
-- ============================================================

-- Physical materials / consumables tracked in the press
CREATE TABLE inventory_items (
  id                 SERIAL          PRIMARY KEY,
  name               VARCHAR(255)    NOT NULL,
  unit               VARCHAR(50)     NOT NULL DEFAULT 'pcs',  -- pcs | sqft | roll | kg | sheet
  current_stock      NUMERIC(12, 3)  NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  warning_threshold  NUMERIC(12, 3)  NOT NULL DEFAULT 150,
  critical_threshold NUMERIC(12, 3)  NOT NULL DEFAULT 50,
  reorder_point      NUMERIC(12, 3)  NOT NULL DEFAULT 0,      -- restock reminder level
  cost_per_unit      NUMERIC(10, 2),                          -- purchase cost for valuation
  supplier_name      VARCHAR(255),
  notes              TEXT,
  is_active          BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_items_active ON inventory_items (is_active);

-- Immutable movement ledger — never UPDATE or DELETE rows here
CREATE TABLE stock_movements (
  id             SERIAL          PRIMARY KEY,
  item_id        INTEGER         NOT NULL REFERENCES inventory_items (id) ON DELETE RESTRICT,
  movement_type  VARCHAR(10)     NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUST')),
  quantity       NUMERIC(12, 3)  NOT NULL CHECK (quantity > 0),
  -- Traceability
  reference_type VARCHAR(50),    -- 'bill' | 'purchase' | 'adjustment' | 'reversal'
  reference_id   INTEGER,        -- bill_id when reference_type='bill'
  bill_item_id   INTEGER REFERENCES bill_items (id) ON DELETE SET NULL,  -- deduplication anchor
  notes          TEXT,
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Unique constraint: one OUT movement per bill_item_id (prevents double deduction)
CREATE UNIQUE INDEX idx_stock_movements_bill_item_out
  ON stock_movements (bill_item_id)
  WHERE movement_type = 'OUT' AND bill_item_id IS NOT NULL;

CREATE INDEX idx_stock_movements_item_id    ON stock_movements (item_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements (created_at DESC);
CREATE INDEX idx_stock_movements_reference  ON stock_movements (reference_type, reference_id);

-- Links a product to the inventory material it consumes when ordered.
-- qty_per_unit: how much inventory is consumed per 1 bill_item quantity (or 1 sqft for area-based).
-- use_sqft: TRUE  → consumption = bill_item.sqft  × qty_per_unit  (flex, stickers)
--           FALSE → consumption = bill_item.quantity × qty_per_unit (cards, flyers)
CREATE TABLE product_inventory_map (
  id                SERIAL          PRIMARY KEY,
  product_id        INTEGER         NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  inventory_item_id INTEGER         NOT NULL REFERENCES inventory_items (id) ON DELETE RESTRICT,
  qty_per_unit      NUMERIC(12, 4)  NOT NULL DEFAULT 1 CHECK (qty_per_unit > 0),
  use_sqft          BOOLEAN         NOT NULL DEFAULT FALSE,
  UNIQUE (product_id, inventory_item_id)
);

CREATE INDEX idx_product_inventory_map_product ON product_inventory_map (product_id);

-- updated_at trigger for inventory_items
CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── SEED: Common printing press materials ─────────────────────

INSERT INTO inventory_items (name, unit, current_stock, warning_threshold, critical_threshold, reorder_point, cost_per_unit, supplier_name) VALUES
  ('Art Card 350gsm',     'sheet',  5000, 500,  200, 300,  8.50,  'Paper Mart Lahore'),
  ('Star Flex Roll',      'sqft',  10000, 500,  200, 300,  45.00, 'Flex World'),
  ('China Flex Roll',     'sqft',  12000, 500,  200, 300,  35.00, 'Flex World'),
  ('Backlit Flex Roll',   'sqft',   6000, 300,  100, 200,  60.00, 'Flex World'),
  ('Vinyl Sticker Roll',  'sqft',   4000, 300,  100, 200,  80.00, 'Vinyl Pak'),
  ('Inkjet Photo Paper',  'sheet',  2000, 200,   50, 100, 12.00,  'Photo Supplies'),
  ('Lamination Film',     'sqft',   8000, 400,  150, 250, 15.00,  'Lam Co'),
  ('Offset Ink Black',    'kg',      25,   5,    2,   3, 800.00,  'Inks Lahore'),
  ('Offset Ink CMYK Set', 'set',     10,   3,    1,   2, 3500.00, 'Inks Lahore');
