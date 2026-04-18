-- ============================================================
-- SAMPLE BILL — demonstrates all relationships
-- Run AFTER schema.sql
-- ============================================================

-- 1. Add a customer
INSERT INTO customers (name, phone, address) VALUES
  ('Ali Printing House', '03001234567', 'Main Market, Lahore');

-- 2. Create a bill
INSERT INTO bills (bill_number, customer_id, status, subtotal, total_amount, advance_paid, remaining_balance)
VALUES (
  generate_bill_number(),
  (SELECT id FROM customers WHERE phone='03001234567'),
  'pending',
  0, 0, 0, 0
);

-- 3. Add bill items (app will call this after user fills the form)
-- Item 1: Star Flex  5ft × 3ft × 2 qty @ 120/sqft
INSERT INTO bill_items (bill_id, product_id, pricing_model, width, height, sqft, quantity, unit_price, item_total)
VALUES (
  (SELECT id FROM bills WHERE bill_number = (SELECT MAX(bill_number) FROM bills)),
  (SELECT id FROM products WHERE name='Star Flex'),
  'area_based',
  5, 3, 15.000,   -- sqft = 5×3
  2,              -- qty (number of pieces/copies)
  120.00,         -- price per sqft
  3600.00         -- 5×3×2×120 = 3600
);

-- Item 2: Business Cards  500 pcs  → tier price 1500
INSERT INTO bill_items (bill_id, product_id, pricing_model, quantity, unit_price, item_total)
VALUES (
  (SELECT id FROM bills WHERE bill_number = (SELECT MAX(bill_number) FROM bills)),
  (SELECT id FROM products WHERE name='Business Cards'),
  'quantity_based',
  500,
  1500.00,
  1500.00
);

-- 4. Extra charge: Design Fee
INSERT INTO bill_extra_charges (bill_id, label, amount)
VALUES (
  (SELECT id FROM bills WHERE bill_number = (SELECT MAX(bill_number) FROM bills)),
  'Design Fee',
  500.00
);

-- 5. Update bill totals (app does this automatically)
UPDATE bills SET
  subtotal          = 5100.00,   -- 3600 + 1500
  extra_charges     = 500.00,
  total_amount      = 5600.00,   -- subtotal + extra - discount
  advance_paid      = 2000.00,
  remaining_balance = 3600.00,
  updated_at        = NOW()
WHERE bill_number = (SELECT MAX(bill_number) FROM bills);

-- 6. Record the advance as a payment
INSERT INTO payments (bill_id, customer_id, amount, payment_method, notes)
VALUES (
  (SELECT id FROM bills WHERE bill_number = (SELECT MAX(bill_number) FROM bills)),
  (SELECT id FROM customers WHERE phone='03001234567'),
  2000.00,
  'cash',
  'Advance payment on order'
);

-- 7. Verify ledger
SELECT * FROM customer_ledger WHERE phone='03001234567';
SELECT * FROM daily_sales LIMIT 5;
