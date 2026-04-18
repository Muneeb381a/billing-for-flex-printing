// ============================================================
// Pricing Engine — pure functions, zero side-effects
// All monetary values are in PKR, dimensions in feet.
// ============================================================

import { createError } from '../middleware/errorHandler.js';

// ── Core Calculators ─────────────────────────────────────────

/**
 * Area-based (Flex / Vinyl)
 *
 * Correct formula:  sqft = MAX(w×h, minSqft) × qty
 *                   total = sqft × rate
 *
 * sqft is TOTAL material consumed across all copies, not per-banner.
 * This value is stored in bill_items.sqft and used for stock deduction.
 * minSqft protects margin on tiny jobs (e.g. 0.5 sqft billed as 1 sqft each).
 */
export const calcAreaPrice = ({ width, height, qty = 1, pricePerSqft, minSqft = 1 }) => {
  const w        = parseFloat(width);
  const h        = parseFloat(height);
  const q        = parseInt(qty, 10);
  const rate     = parseFloat(pricePerSqft);
  const min      = parseFloat(minSqft);

  const rawSqft  = w * h;                      // per-piece area before minimum
  const unitSqft = Math.max(rawSqft, min);     // per-piece area after minimum
  const totalSqft = parseFloat((unitSqft * q).toFixed(3));  // total material
  const itemTotal = parseFloat((totalSqft * rate).toFixed(2));

  return {
    sqft:       totalSqft,                     // total sqft (stored in DB, used for stock)
    unitSqft:   parseFloat(unitSqft.toFixed(3)), // per-piece (for breakdown display)
    minApplied: rawSqft < min,                 // whether minimum floor was enforced
    unitPrice:  rate,
    itemTotal,
  };
};

/**
 * Quantity-based tiered (Business Cards, Flyers)
 * Finds the highest tier bracket whose min_qty ≤ requested qty.
 * Returns null when qty is below all defined tiers.
 */
export const resolveQuantityTier = (tiers, qty) => {
  const q      = parseInt(qty, 10);
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  let matched  = null;

  for (const tier of sorted) {
    if (q >= tier.min_qty) matched = tier;
    else break;
  }

  if (!matched) return null;

  return {
    tierId:    matched.id,
    minQty:    matched.min_qty,
    maxQty:    matched.max_qty,
    unitPrice: parseFloat(matched.price),
    itemTotal: parseFloat(matched.price),  // tier price is the whole-job price
  };
};

/** Fixed charge — price doesn't vary with dimensions, only with qty */
export const calcFixedPrice = ({ fixedPrice, qty = 1 }) => ({
  unitPrice: parseFloat(fixedPrice),
  itemTotal: parseFloat((fixedPrice * qty).toFixed(2)),
});

/** Custom / manual override */
export const calcCustomPrice = ({ unitPrice, qty = 1 }) => ({
  unitPrice: parseFloat(unitPrice),
  itemTotal: parseFloat((parseFloat(unitPrice) * parseInt(qty, 10)).toFixed(2)),
});

// ── Dispatcher ───────────────────────────────────────────────

export const calcItemPrice = ({ pricingModel, ...params }) => {
  switch (pricingModel) {
    case 'area_based':   return calcAreaPrice(params);
    case 'fixed_charge': return calcFixedPrice(params);
    case 'custom':       return calcCustomPrice(params);
    default:
      throw new Error(`calcItemPrice: unknown pricingModel "${pricingModel}"`);
  }
};

// ── Bill Totals ──────────────────────────────────────────────

/**
 * Recalculate all bill financial fields from raw rows.
 * Single source of truth — called after every bill mutation.
 */
export const calcBillTotals = ({
  items         = [],
  extraCharges  = [],
  discountType  = 'fixed',
  discountValue = 0,
  totalPaid     = 0,
}) => {
  const itemsSubtotal = items.reduce(
    (s, it) => s + parseFloat(it.item_total) + parseFloat(it.design_fee || 0) + parseFloat(it.urgent_fee || 0),
    0
  );
  const extraTotal = extraCharges.reduce((s, ec) => s + parseFloat(ec.amount), 0);

  const discountAmount =
    discountType === 'percentage'
      ? parseFloat(((itemsSubtotal * parseFloat(discountValue)) / 100).toFixed(2))
      : parseFloat(discountValue);

  const totalAmount      = parseFloat((itemsSubtotal + extraTotal - discountAmount).toFixed(2));
  const remainingBalance = parseFloat((totalAmount - parseFloat(totalPaid)).toFixed(2));

  return {
    subtotal:         parseFloat(itemsSubtotal.toFixed(2)),
    discountAmount:   parseFloat(discountAmount.toFixed(2)),
    extraCharges:     parseFloat(extraTotal.toFixed(2)),
    totalAmount,
    remainingBalance,
  };
};

// ── Input Schema ─────────────────────────────────────────────
// Tells the frontend which form fields to render for each pricing model.

const INPUT_SCHEMAS = {
  area_based: [
    { field: 'width',    label: 'Width (ft)',  type: 'decimal', min: 0.1, required: true },
    { field: 'height',   label: 'Height (ft)', type: 'decimal', min: 0.1, required: true },
    { field: 'quantity', label: 'Quantity',    type: 'integer', min: 1,   required: true, defaultValue: 1 },
  ],
  quantity_based: [
    { field: 'quantity', label: 'Quantity',    type: 'integer', min: 1,   required: true },
  ],
  fixed_charge: [
    { field: 'quantity', label: 'Quantity',    type: 'integer', min: 1,   required: true, defaultValue: 1 },
  ],
  custom: [
    { field: 'unitPrice', label: 'Unit Price (PKR)', type: 'decimal', min: 0, required: true },
    { field: 'quantity',  label: 'Quantity',         type: 'integer', min: 1, required: true, defaultValue: 1 },
  ],
};

export const getInputSchema = (pricingModel) =>
  INPUT_SCHEMAS[pricingModel] ?? INPUT_SCHEMAS.custom;

// ── Input Validation ─────────────────────────────────────────

export const validatePricingInputs = (pricingModel, inputs, tiers = []) => {
  const errors = [];

  const num = (v, field) => {
    const n = parseFloat(v);
    if (isNaN(n) || n <= 0) errors.push(`${field} must be a positive number`);
    return n;
  };

  const int = (v, field) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1) errors.push(`${field} must be a positive integer`);
    return n;
  };

  switch (pricingModel) {
    case 'area_based': {
      num(inputs.width,    'width');
      num(inputs.height,   'height');
      int(inputs.quantity, 'quantity');
      break;
    }
    case 'quantity_based': {
      const qty = int(inputs.quantity, 'quantity');
      if (!errors.length && tiers.length) {
        const match = resolveQuantityTier(tiers, qty);
        if (!match) {
          const min = Math.min(...tiers.map((t) => t.min_qty));
          errors.push(`Quantity ${qty} is below the minimum tier (${min} pcs)`);
        }
      }
      break;
    }
    case 'fixed_charge': {
      int(inputs.quantity, 'quantity');
      break;
    }
    case 'custom': {
      num(inputs.unitPrice, 'unitPrice');
      int(inputs.quantity,  'quantity');
      break;
    }
    default:
      errors.push(`Unknown pricing model: ${pricingModel}`);
  }

  return errors;
};

// ── Human-readable Breakdown ─────────────────────────────────
// Shown in the billing form and on the invoice.

const fmt = (n) => parseFloat(n).toLocaleString('en-PK', { minimumFractionDigits: 2 });

export const buildBreakdown = (pricingModel, inputs, result, productName = '') => {
  switch (pricingModel) {
    case 'area_based': {
      const { width, height, quantity: qty }            = inputs;
      const { sqft, unitSqft, minApplied, unitPrice, itemTotal } = result;
      if (minApplied) {
        const rawSqft = parseFloat((parseFloat(width) * parseFloat(height)).toFixed(3));
        return `${width} ft × ${height} ft = ${rawSqft} sqft → min. ${unitSqft} sqft applied → ${unitSqft} × ${qty} qty = ${sqft} sqft × PKR ${fmt(unitPrice)}/sqft = PKR ${fmt(itemTotal)}`;
      }
      return `${width} ft × ${height} ft × ${qty} qty = ${sqft} sqft × PKR ${fmt(unitPrice)}/sqft = PKR ${fmt(itemTotal)}`;
    }
    case 'quantity_based': {
      const { quantity: qty }                    = inputs;
      const { unitPrice, itemTotal, minQty, maxQty } = result;
      const tierLabel = maxQty ? `${minQty}–${maxQty} pcs` : `${minQty}+ pcs`;
      return `${qty} pcs → Tier [${tierLabel}] → PKR ${fmt(itemTotal)}`;
    }
    case 'fixed_charge': {
      const { quantity: qty }     = inputs;
      const { unitPrice, itemTotal } = result;
      return `${qty} × PKR ${fmt(unitPrice)} (fixed) = PKR ${fmt(itemTotal)}`;
    }
    case 'custom': {
      const { unitPrice, quantity: qty } = inputs;
      const { itemTotal }                = result;
      return `${qty} × PKR ${fmt(unitPrice)} (custom) = PKR ${fmt(itemTotal)}`;
    }
    default:
      return `PKR ${fmt(result.itemTotal)}`;
  }
};

// ── Estimate builder (no DB required on caller side) ─────────
// Takes already-resolved items (with unitPrice/itemTotal) and
// produces the same shape as calcBillTotals.

export const buildEstimate = ({ resolvedItems = [], extraCharges = [], discountType = 'fixed', discountValue = 0 }) => {
  const itemsAsRows = resolvedItems.map((it) => ({
    item_total: it.itemTotal,
    design_fee: it.designFee ?? 0,
    urgent_fee: it.urgentFee ?? 0,
  }));

  const ecAsRows = extraCharges.map((ec) => ({ amount: ec.amount }));

  return calcBillTotals({ items: itemsAsRows, extraCharges: ecAsRows, discountType, discountValue, totalPaid: 0 });
};
