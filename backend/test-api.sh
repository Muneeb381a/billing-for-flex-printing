#!/usr/bin/env bash
# ============================================================
# Printing Press ERP — API Test Script
# Run: bash test-api.sh
# Requires: curl, jq
# Server must be running on http://localhost:5000
# DB must have schema.sql applied
# ============================================================

BASE="http://localhost:5000/api"
PASS=0
FAIL=0

# ── Helpers ──────────────────────────────────────────────────
green()  { echo -e "\033[32m✓ $1\033[0m"; }
red()    { echo -e "\033[31m✗ $1\033[0m"; }
header() { echo -e "\n\033[1;34m── $1 ──\033[0m"; }

assert() {
  local label="$1"
  local status="$2"
  local expected="$3"
  if [ "$status" -eq "$expected" ]; then
    green "$label (HTTP $status)"
    PASS=$((PASS+1))
  else
    red "$label (expected $expected, got $status)"
    FAIL=$((FAIL+1))
  fi
}

# ── Health ────────────────────────────────────────────────────
header "Health Check"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/../health")
assert "GET /health" "$STATUS" 200

# ── Categories ───────────────────────────────────────────────
header "Categories"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/categories")
assert "GET /categories" "$STATUS" 200

CAT_BODY=$(curl -s -X POST "$BASE/categories" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Category","description":"For testing"}')
CAT_ID=$(echo "$CAT_BODY" | jq -r '.data.id')
STATUS=$(echo "$CAT_BODY" | jq -r '.data.id // empty' | wc -c | tr -d ' ')
[ "$CAT_ID" != "null" ] && [ "$CAT_ID" != "" ] && { green "POST /categories (id=$CAT_ID)"; PASS=$((PASS+1)); } || { red "POST /categories"; FAIL=$((FAIL+1)); }

# ── Products ─────────────────────────────────────────────────
header "Products"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/products")
assert "GET /products" "$STATUS" 200

PROD_BODY=$(curl -s -X POST "$BASE/products" \
  -H "Content-Type: application/json" \
  -d "{\"categoryId\":$CAT_ID,\"name\":\"Test Flex\",\"pricingModel\":\"area_based\",\"basePrice\":100,\"unit\":\"sqft\"}")
PROD_ID=$(echo "$PROD_BODY" | jq -r '.data.id')
[ "$PROD_ID" != "null" ] && [ "$PROD_ID" != "" ] && { green "POST /products (id=$PROD_ID)"; PASS=$((PASS+1)); } || { red "POST /products"; FAIL=$((FAIL+1)); }

# Add pricing rule for this product
PR_BODY=$(curl -s -X POST "$BASE/products/$PROD_ID/pricing-rules" \
  -H "Content-Type: application/json" \
  -d '{"pricePerSqft":100,"minSqft":1,"effectiveFrom":"2024-01-01"}')
PR_ID=$(echo "$PR_BODY" | jq -r '.data.id')
[ "$PR_ID" != "null" ] && [ "$PR_ID" != "" ] && { green "POST /products/:id/pricing-rules (id=$PR_ID)"; PASS=$((PASS+1)); } || { red "POST /products/:id/pricing-rules"; FAIL=$((FAIL+1)); }

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/products/$PROD_ID")
assert "GET /products/:id" "$STATUS" 200

# ── Customers ────────────────────────────────────────────────
header "Customers"
CUST_BODY=$(curl -s -X POST "$BASE/customers" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ahmed Khan","phone":"03119876543","address":"Lahore"}')
CUST_ID=$(echo "$CUST_BODY" | jq -r '.data.id')
[ "$CUST_ID" != "null" ] && [ "$CUST_ID" != "" ] && { green "POST /customers (id=$CUST_ID)"; PASS=$((PASS+1)); } || { red "POST /customers"; FAIL=$((FAIL+1)); }

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/customers/$CUST_ID")
assert "GET /customers/:id" "$STATUS" 200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/customers?search=Ahmed")
assert "GET /customers?search=Ahmed" "$STATUS" 200

# ── Bills: step-by-step creation ─────────────────────────────
header "Bills (step-by-step)"
BILL_BODY=$(curl -s -X POST "$BASE/bills" \
  -H "Content-Type: application/json" \
  -d "{\"customerId\":$CUST_ID,\"notes\":\"Test order\",\"dueDate\":\"2025-12-31\"}")
BILL_ID=$(echo "$BILL_BODY" | jq -r '.data.id')
BILL_NO=$(echo "$BILL_BODY" | jq -r '.data.bill_number')
[ "$BILL_ID" != "null" ] && [ "$BILL_ID" != "" ] && { green "POST /bills (id=$BILL_ID, number=$BILL_NO)"; PASS=$((PASS+1)); } || { red "POST /bills"; FAIL=$((FAIL+1)); }

# Add area-based item (5ft × 3ft × 2 qty)
ITEM_BODY=$(curl -s -X POST "$BASE/bills/$BILL_ID/items" \
  -H "Content-Type: application/json" \
  -d "{\"productId\":$PROD_ID,\"pricingModel\":\"area_based\",\"width\":5,\"height\":3,\"quantity\":2,\"designFee\":0,\"urgentFee\":0}")
ITEM_ID=$(echo "$ITEM_BODY" | jq -r '.data.id')
ITEM_TOTAL=$(echo "$ITEM_BODY" | jq -r '.data.item_total')
[ "$ITEM_ID" != "null" ] && [ "$ITEM_ID" != "" ] && { green "POST /bills/:id/items (id=$ITEM_ID, total=$ITEM_TOTAL)"; PASS=$((PASS+1)); } || { red "POST /bills/:id/items"; FAIL=$((FAIL+1)); }

# Add extra charge
CHARGE_BODY=$(curl -s -X POST "$BASE/bills/$BILL_ID/extra-charges" \
  -H "Content-Type: application/json" \
  -d '{"label":"Design Fee","amount":500}')
CHARGE_ID=$(echo "$CHARGE_BODY" | jq -r '.data.id')
[ "$CHARGE_ID" != "null" ] && [ "$CHARGE_ID" != "" ] && { green "POST /bills/:id/extra-charges (id=$CHARGE_ID)"; PASS=$((PASS+1)); } || { red "POST /bills/:id/extra-charges"; FAIL=$((FAIL+1)); }

# Apply discount
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/bills/$BILL_ID/discount" \
  -H "Content-Type: application/json" \
  -d '{"discountType":"fixed","discountValue":200}')
assert "PATCH /bills/:id/discount" "$STATUS" 200

# Verify totals
BILL_DATA=$(curl -s "$BASE/bills/$BILL_ID")
TOTAL=$(echo "$BILL_DATA" | jq -r '.data.bill.total_amount')
green "Bill total after items+charge-discount: PKR $TOTAL"

# ── Bills: complete (one-shot) ────────────────────────────────
header "Bills (complete one-shot)"
COMPLETE_BODY=$(curl -s -X POST "$BASE/bills/complete" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerId\": $CUST_ID,
    \"items\": [
      {
        \"productId\": $PROD_ID,
        \"pricingModel\": \"area_based\",
        \"width\": 10,
        \"height\": 4,
        \"quantity\": 1
      }
    ],
    \"extraCharges\": [{\"label\":\"Urgent\",\"amount\":300}],
    \"discountType\": \"percentage\",
    \"discountValue\": 10,
    \"advance\": 1000,
    \"paymentMethod\": \"cash\",
    \"notes\": \"One-shot bill test\"
  }")
COMPLETE_ID=$(echo "$COMPLETE_BODY" | jq -r '.data.bill.id')
[ "$COMPLETE_ID" != "null" ] && [ "$COMPLETE_ID" != "" ] && { green "POST /bills/complete (id=$COMPLETE_ID)"; PASS=$((PASS+1)); } || { red "POST /bills/complete — $(echo "$COMPLETE_BODY" | jq -r '.error')"; FAIL=$((FAIL+1)); }

# ── Invoice ───────────────────────────────────────────────────
header "Invoice"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/bills/$BILL_ID/invoice")
assert "GET /bills/:id/invoice" "$STATUS" 200

# ── Payments ─────────────────────────────────────────────────
header "Payments"
PAY_BODY=$(curl -s -X POST "$BASE/payments" \
  -H "Content-Type: application/json" \
  -d "{\"billId\":$BILL_ID,\"amount\":1000,\"paymentMethod\":\"cash\",\"notes\":\"Partial payment\"}")
PAY_ID=$(echo "$PAY_BODY" | jq -r '.data.id')
[ "$PAY_ID" != "null" ] && [ "$PAY_ID" != "" ] && { green "POST /payments (id=$PAY_ID)"; PASS=$((PASS+1)); } || { red "POST /payments"; FAIL=$((FAIL+1)); }

# ── Ledger ────────────────────────────────────────────────────
header "Ledger"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/ledger")
assert "GET /ledger" "$STATUS" 200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/ledger/$CUST_ID")
assert "GET /ledger/:customerId" "$STATUS" 200

LEDGER=$(curl -s "$BASE/ledger/$CUST_ID")
echo "  outstanding_balance: $(echo "$LEDGER" | jq -r '.data.summary.outstanding_balance')"

# ── Dashboard ─────────────────────────────────────────────────
header "Dashboard"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard/summary")
assert "GET /dashboard/summary" "$STATUS" 200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard/daily-sales")
assert "GET /dashboard/daily-sales" "$STATUS" 200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard/monthly-sales")
assert "GET /dashboard/monthly-sales" "$STATUS" 200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard/pending-orders")
assert "GET /dashboard/pending-orders" "$STATUS" 200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard/top-products")
assert "GET /dashboard/top-products" "$STATUS" 200

# ── Status transitions ────────────────────────────────────────
header "Order Status"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/bills/$BILL_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}')
assert "PATCH /bills/:id/status → in_progress" "$STATUS" 200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/bills/$BILL_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}')
assert "PATCH /bills/:id/status → completed" "$STATUS" 200

# ── Validation errors ─────────────────────────────────────────
header "Validation (should return 4xx)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/customers" \
  -H "Content-Type: application/json" \
  -d '{"name":"Missing Phone"}')
assert "POST /customers without phone → 400" "$STATUS" 400

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/customers/99999")
assert "GET /customers/99999 → 404" "$STATUS" 404

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/customers/abc")
assert "GET /customers/abc → 400" "$STATUS" 400

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo -e "\033[32m  ALL TESTS PASSED\033[0m" || echo -e "\033[31m  SOME TESTS FAILED\033[0m"
