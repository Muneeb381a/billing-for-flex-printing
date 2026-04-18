import * as ProdQ from '../db/queries/products.js';
import {
  calcAreaPrice,
  resolveQuantityTier,
  calcFixedPrice,
  calcCustomPrice,
  buildBreakdown,
  buildEstimate,
  getInputSchema,
  validatePricingInputs,
} from '../utils/pricing.js';
import { createError } from '../middleware/errorHandler.js';

// ── Internal: fetch everything needed to price one product ───
const loadProductPricingConfig = async (productId) => {
  const [{ rows: product }, { rows: tiers }, { rows: pricingRules }, { rows: specs }] =
    await Promise.all([
      ProdQ.findById(productId),
      ProdQ.getTiers(productId),
      ProdQ.getActivePricingRule(productId),
      ProdQ.getSpecs(productId),
    ]);

  if (!product.length) return null;

  return {
    product:     product[0],
    tiers,
    activeRule:  pricingRules[0] ?? null,
    specs,
  };
};

// ── Internal: resolve a single item price from its config ────
const resolveItemFromConfig = (config, inputs) => {
  const { product, tiers, activeRule } = config;
  const model = inputs.pricingModel ?? product.pricing_model;

  switch (model) {
    case 'area_based': {
      if (!activeRule?.price_per_sqft)
        throw createError(422, `No active pricing rule (price_per_sqft) for product "${product.name}"`);
      return {
        model,
        result: calcAreaPrice({
          width:        inputs.width,
          height:       inputs.height,
          qty:          inputs.quantity ?? 1,
          pricePerSqft: activeRule.price_per_sqft,
          minSqft:      activeRule.min_sqft ?? 1,
        }),
      };
    }
    case 'quantity_based': {
      if (!tiers.length)
        throw createError(422, `No quantity tiers defined for product "${product.name}"`);
      const resolved = resolveQuantityTier(tiers, inputs.quantity);
      if (!resolved)
        throw createError(422, `Quantity ${inputs.quantity} is below minimum tier for "${product.name}"`);
      return { model, result: resolved };
    }
    case 'fixed_charge': {
      if (!activeRule?.fixed_price)
        throw createError(422, `No active fixed price for product "${product.name}"`);
      return {
        model,
        result: calcFixedPrice({ fixedPrice: activeRule.fixed_price, qty: inputs.quantity ?? 1 }),
      };
    }
    case 'custom': {
      if (inputs.unitPrice == null)
        throw createError(400, 'unitPrice is required for custom pricing');
      return {
        model,
        result: calcCustomPrice({ unitPrice: inputs.unitPrice, qty: inputs.quantity ?? 1 }),
      };
    }
    default:
      throw createError(400, `Unknown pricingModel: "${model}"`);
  }
};

// ── GET /api/pricing/product/:productId ──────────────────────
// Returns everything the billing form needs to render a product row:
// what inputs to show, current rates, tiers, specs.

export const getProductPricingConfig = async (req, res, next) => {
  const config = await loadProductPricingConfig(req.params.productId);
  if (!config) return next(createError(404, 'Product not found'));

  const { product, tiers, activeRule, specs } = config;

  res.json({
    data: {
      product: {
        id:           product.id,
        name:         product.name,
        unit:         product.unit,
        pricingModel: product.pricing_model,
        categoryName: product.category_name,
      },
      // What form fields to render in the billing UI
      inputs:      getInputSchema(product.pricing_model),
      // Current active rate (null for quantity_based — use tiers instead)
      activeRule,
      // Tiers for quantity_based products (shown as a reference table in UI)
      tiers,
      // Product specs (paper type, size, etc. — shown as a badge/info panel)
      specs: specs.reduce((acc, s) => ({ ...acc, [s.spec_key]: s.spec_value }), {}),
    },
  });
};

// ── POST /api/pricing/calculate ──────────────────────────────
// Live single-item price preview. No DB writes.
// Called on every keypress in the billing form.
//
// Body: { productId, pricingModel?, width?, height?, quantity, unitPrice? }

export const calculate = async (req, res, next) => {
  const { productId, ...inputs } = req.body;
  if (!productId) return next(createError(400, 'productId is required'));

  const config = await loadProductPricingConfig(productId);
  if (!config) return next(createError(404, 'Product not found'));

  // Validate inputs first
  const model  = inputs.pricingModel ?? config.product.pricing_model;
  const errors = validatePricingInputs(model, inputs, config.tiers);
  if (errors.length) return next(createError(400, errors.join('; ')));

  const { model: resolvedModel, result } = resolveItemFromConfig(config, inputs);

  const designFee  = parseFloat(inputs.designFee  ?? 0);
  const urgentFee  = parseFloat(inputs.urgentFee  ?? 0);
  const lineTotal  = parseFloat((result.itemTotal + designFee + urgentFee).toFixed(2));
  const breakdown  = buildBreakdown(resolvedModel, inputs, result, config.product.name);

  res.json({
    data: {
      productId:    Number(productId),
      productName:  config.product.name,
      pricingModel: resolvedModel,
      // Dimension info (area_based only)
      ...(result.sqft !== undefined && { sqft: result.sqft }),
      // Tier info (quantity_based only)
      ...(result.tierId !== undefined && {
        tier: { id: result.tierId, minQty: result.minQty, maxQty: result.maxQty },
      }),
      quantity:   parseInt(inputs.quantity ?? 1, 10),
      unitPrice:  result.unitPrice,
      itemTotal:  result.itemTotal,
      designFee,
      urgentFee,
      lineTotal,
      breakdown,
    },
  });
};

// ── POST /api/pricing/estimate ───────────────────────────────
// Multi-item full bill preview. No DB writes.
// Used by the billing form to show running totals as user builds a bill.
//
// Body: {
//   items: [{ productId, pricingModel?, width?, height?, quantity, unitPrice?, designFee?, urgentFee? }],
//   extraCharges: [{ label, amount }],
//   discountType: 'fixed'|'percentage',
//   discountValue: number
// }

export const estimate = async (req, res, next) => {
  const { items = [], extraCharges = [], discountType = 'fixed', discountValue = 0 } = req.body;

  if (!items.length) return next(createError(400, 'At least one item is required'));

  // Resolve all items in parallel
  const resolvedItems = await Promise.all(
    items.map(async (item, idx) => {
      if (!item.productId)
        throw createError(400, `Item ${idx + 1}: productId is required`);

      const config = await loadProductPricingConfig(item.productId);
      if (!config) throw createError(404, `Item ${idx + 1}: product ${item.productId} not found`);

      const model  = item.pricingModel ?? config.product.pricing_model;
      const errors = validatePricingInputs(model, item, config.tiers);
      if (errors.length) throw createError(400, `Item ${idx + 1} (${config.product.name}): ${errors.join('; ')}`);

      const { model: resolvedModel, result } = resolveItemFromConfig(config, item);

      const designFee = parseFloat(item.designFee ?? 0);
      const urgentFee = parseFloat(item.urgentFee ?? 0);
      const lineTotal = parseFloat((result.itemTotal + designFee + urgentFee).toFixed(2));

      return {
        idx:          idx + 1,
        productId:    item.productId,
        productName:  config.product.name,
        pricingModel: resolvedModel,
        ...(result.sqft !== undefined && { sqft: result.sqft }),
        quantity:     parseInt(item.quantity ?? 1, 10),
        unitPrice:    result.unitPrice,
        itemTotal:    result.itemTotal,
        designFee,
        urgentFee,
        lineTotal,
        breakdown:    buildBreakdown(resolvedModel, item, result, config.product.name),
      };
    })
  );

  const totals = buildEstimate({ resolvedItems, extraCharges, discountType, discountValue });

  res.json({
    data: {
      items:        resolvedItems,
      extraCharges,
      discountType,
      discountValue: parseFloat(discountValue),
      totals,
    },
  });
};

// ── GET /api/pricing/tiers/:productId ────────────────────────
// Shortcut — returns tiers with next-tier guidance for the billing UI.
// Tells the clerk "add X more cards to reach the next tier".

export const getTiersWithGuidance = async (req, res, next) => {
  const { productId } = req.params;
  const currentQty    = parseInt(req.query.qty ?? 0, 10);

  const { rows: product } = await ProdQ.findById(productId);
  if (!product.length) return next(createError(404, 'Product not found'));

  const { rows: tiers } = await ProdQ.getTiers(productId);

  if (!tiers.length) {
    return res.json({ data: { tiers: [], currentTier: null, nextTier: null } });
  }

  const sorted      = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  const currentTier = currentQty > 0 ? resolveQuantityTier(sorted, currentQty) : null;

  // Find the next tier above the current quantity
  const nextTier = sorted.find((t) => t.min_qty > currentQty) ?? null;

  // How many more units to reach the next tier?
  const unitsToNextTier = nextTier ? nextTier.min_qty - currentQty : null;

  res.json({
    data: {
      tiers: sorted.map((t) => ({
        id:        t.id,
        minQty:    t.min_qty,
        maxQty:    t.max_qty,
        price:     parseFloat(t.price),
        label:     t.max_qty ? `${t.min_qty}–${t.max_qty} pcs` : `${t.min_qty}+ pcs`,
        isCurrent: currentTier?.tierId === t.id,
      })),
      currentTier,
      nextTier: nextTier
        ? {
            ...nextTier,
            unitsAway: unitsToNextTier,
            savingVsCurrent:
              currentTier
                ? parseFloat((parseFloat(currentTier.unitPrice) - parseFloat(nextTier.price)).toFixed(2))
                : null,
          }
        : null,
    },
  });
};
