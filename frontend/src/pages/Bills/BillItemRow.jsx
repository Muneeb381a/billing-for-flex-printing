import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Input, Select } from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import useDebounce from '../../hooks/useDebounce.js';
import * as catApi     from '../../api/categories.js';
import * as prodApi    from '../../api/products.js';
import * as pricingApi from '../../api/pricing.js';

// ─────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────

const canCalculate = (model, item) => {
  if (!item.productId || !model) return false;
  switch (model) {
    case 'area_based':     return +item.width > 0 && +item.height > 0 && +item.quantity > 0;
    case 'quantity_based': return +item.quantity > 0;
    case 'fixed_charge':   return +item.quantity > 0;
    case 'custom':         return +item.unitPrice > 0 && +item.quantity > 0;
    default:               return false;
  }
};

/**
 * Instant sqft preview computed from local state — no API call needed.
 * Formula: MAX(w×h, minSqft) × qty  (mirrors calcAreaPrice on the backend)
 * Returns null when inputs are incomplete.
 */
const buildLiveFormula = (item, minSqft = 1) => {
  if (item.pricingModel !== 'area_based') return null;
  const w = parseFloat(item.width);
  const h = parseFloat(item.height);
  const q = parseInt(item.quantity, 10);
  if (!w || !h || !q || w <= 0 || h <= 0 || q < 1) return null;

  const rawSqft   = parseFloat((w * h).toFixed(3));
  const unitSqft  = Math.max(rawSqft, parseFloat(minSqft));
  const totalSqft = parseFloat((unitSqft * q).toFixed(3));
  const minNote   = rawSqft < parseFloat(minSqft) ? ` (min ${unitSqft} sqft/pc applied)` : '';

  return `${w} × ${h} × ${q} = ${totalSqft} sqft${minNote}`;
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const BillItemRow = ({ item, index, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  // Single field updater — keeps onUpdate calls consistent
  const u = (field, val) => onUpdate(item.id, { [field]: val });

  // Debounced values fed into the server-side price query
  const dWidth     = useDebounce(item.width,     400);
  const dHeight    = useDebounce(item.height,    400);
  const dQty       = useDebounce(item.quantity,  400);
  const dUnitPrice = useDebounce(item.unitPrice, 400);

  // ── Categories ─────────────────────────────────────────────
  const { data: catData } = useQuery({
    queryKey:  ['categories'],
    queryFn:   catApi.getCategories,
    staleTime: Infinity,
  });

  // ── Products filtered by category ─────────────────────────
  const { data: prodData } = useQuery({
    queryKey: ['products', item.categoryId],
    queryFn:  () => prodApi.getProducts({ category_id: item.categoryId, active_only: 'true' }),
    enabled:  !!item.categoryId,
    staleTime: 30_000,
  });

  // ── Pricing config when product changes ────────────────────
  const { data: configData } = useQuery({
    queryKey:  ['pricing-config', item.productId],
    queryFn:   () => pricingApi.getProductPricingConfig(item.productId),
    enabled:   !!item.productId,
    staleTime: 30_000,
  });

  // Propagate pricing model to parent when product is first selected
  useEffect(() => {
    const model = configData?.data?.product?.pricingModel;
    if (model && model !== item.pricingModel) {
      onUpdate(item.id, {
        pricingModel: model,
        width: '', height: '', quantity: 1, unitPrice: '',
        sqft: null, itemTotal: 0, breakdown: '',
      });
    }
  }, [configData]);  // eslint-disable-line

  // ── Server-side price calculation (debounced) ──────────────
  const calcReady = canCalculate(item.pricingModel, {
    ...item, width: dWidth, height: dHeight, quantity: dQty, unitPrice: dUnitPrice,
  });

  const { data: priceData, isFetching: calculating } = useQuery({
    // Every input that affects price is in the key — guarantees recalculation
    queryKey: ['calc', item.productId, item.pricingModel, dWidth, dHeight, dQty, dUnitPrice],
    queryFn:  () => pricingApi.calculatePrice({
      productId:    Number(item.productId),
      pricingModel: item.pricingModel,
      ...(item.pricingModel === 'area_based' && {
        width:  parseFloat(dWidth),
        height: parseFloat(dHeight),
      }),
      quantity:  parseInt(dQty, 10),
      ...(item.pricingModel === 'custom' && { unitPrice: parseFloat(dUnitPrice) }),
    }),
    enabled:   calcReady,
    staleTime: 0,
    retry:     false,
  });

  // Propagate confirmed price result to parent
  useEffect(() => {
    if (!priceData?.data) return;
    const d = priceData.data;
    onUpdate(item.id, {
      itemTotal: d.itemTotal,
      unitPrice: d.unitPrice,
      sqft:      d.sqft ?? null,   // now total sqft (w×h×qty) from backend
      breakdown: d.breakdown,
    });
  }, [priceData]);  // eslint-disable-line

  // ── Live formula — instant, no debounce, no API call ──────
  const config  = configData?.data;
  const tiers   = config?.tiers ?? [];
  const minSqft = config?.activeRule?.min_sqft ?? 1;
  const model   = item.pricingModel;

  const liveFormula = useMemo(
    () => buildLiveFormula(item, minSqft),
    [item.pricingModel, item.width, item.height, item.quantity, minSqft]  // eslint-disable-line
  );

  // ── Derived display values ─────────────────────────────────
  const categories = (catData?.data  || []).map((c) => ({ value: String(c.id), label: c.name }));
  const products   = (prodData?.data || []).map((p) => ({ value: String(p.id), label: p.name }));

  const lineTotal = parseFloat(item.itemTotal  || 0)
                  + parseFloat(item.designFee  || 0)
                  + parseFloat(item.urgentFee  || 0);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">

      {/* ── Main row ── */}
      <div className="grid grid-cols-12 gap-2 p-3 items-end">

        {/* Row number */}
        <div className="col-span-1 text-center">
          <span className="text-xs font-bold text-gray-400 leading-8">{index + 1}</span>
        </div>

        {/* Category */}
        <div className="col-span-2">
          <Select
            label={index === 0 ? 'Category' : undefined}
            placeholder="Category"
            options={categories}
            value={item.categoryId}
            onChange={(e) => onUpdate(item.id, {
              categoryId: e.target.value,
              productId: '', pricingModel: '', itemTotal: 0, breakdown: '',
            })}
          />
        </div>

        {/* Product */}
        <div className="col-span-3">
          <Select
            label={index === 0 ? 'Product' : undefined}
            placeholder={item.categoryId ? 'Select product' : 'Pick category first'}
            options={products}
            value={item.productId}
            disabled={!item.categoryId}
            onChange={(e) => onUpdate(item.id, {
              productId: e.target.value,
              pricingModel: '', width: '', height: '', quantity: 1, unitPrice: '',
              itemTotal: 0, sqft: null, breakdown: '',
            })}
          />
        </div>

        {/* ── Dynamic inputs per pricing model ── */}

        {model === 'area_based' && (
          <>
            <div className="col-span-1">
              <Input
                label={index === 0 ? 'W (ft)' : undefined}
                type="number" min="0.1" step="0.1" placeholder="5"
                value={item.width}
                onChange={(e) => u('width', e.target.value)}
              />
            </div>
            <div className="col-span-1">
              <Input
                label={index === 0 ? 'H (ft)' : undefined}
                type="number" min="0.1" step="0.1" placeholder="3"
                value={item.height}
                onChange={(e) => u('height', e.target.value)}
              />
            </div>
            <div className="col-span-1">
              <Input
                label={index === 0 ? 'Qty' : undefined}
                type="number" min="1" step="1" placeholder="1"
                value={item.quantity}
                onChange={(e) => u('quantity', e.target.value)}
              />
            </div>
          </>
        )}

        {model === 'quantity_based' && (
          <div className="col-span-3">
            <Input
              label={index === 0 ? 'Quantity (pcs)' : undefined}
              type="number" min="1" step="1" placeholder="500"
              value={item.quantity}
              onChange={(e) => u('quantity', e.target.value)}
            />
          </div>
        )}

        {model === 'fixed_charge' && (
          <div className="col-span-3">
            <Input
              label={index === 0 ? 'Quantity' : undefined}
              type="number" min="1" step="1" placeholder="1"
              value={item.quantity}
              onChange={(e) => u('quantity', e.target.value)}
            />
          </div>
        )}

        {model === 'custom' && (
          <>
            <div className="col-span-2">
              <Input
                label={index === 0 ? 'Unit Price' : undefined}
                type="number" min="0" step="1" prefix="₨" placeholder="0"
                value={item.unitPrice}
                onChange={(e) => u('unitPrice', e.target.value)}
              />
            </div>
            <div className="col-span-1">
              <Input
                label={index === 0 ? 'Qty' : undefined}
                type="number" min="1" step="1" placeholder="1"
                value={item.quantity}
                onChange={(e) => u('quantity', e.target.value)}
              />
            </div>
          </>
        )}

        {!model && (
          <div className="col-span-3 text-xs text-gray-300 italic leading-8 px-1">
            Select a product
          </div>
        )}

        {/* ── Price display ── */}
        <div className="col-span-2 text-right">
          {index === 0 && (
            <p className="text-xs font-semibold text-gray-500 mb-1">Amount</p>
          )}

          {calculating ? (
            <div className="h-6 bg-gray-100 rounded animate-pulse w-20 ml-auto" />
          ) : (
            <p className={`text-base font-bold ${lineTotal > 0 ? 'text-indigo-700' : 'text-gray-300'}`}>
              {lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
            </p>
          )}

          {/* Live sqft hint — shows immediately as user types */}
          {liveFormula && !item.breakdown && (
            <p className="text-xs text-gray-400 font-mono mt-0.5">{liveFormula}</p>
          )}

          {/* Confirmed sqft from server (after API resolves) */}
          {item.sqft && item.breakdown && (
            <p className="text-xs text-indigo-400 font-medium mt-0.5">
              {item.sqft} sqft total
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-1 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Tier reference (quantity_based) ── */}
      {model === 'quantity_based' && tiers.length > 0 && (
        <div className="px-3 pb-2 -mt-1">
          <div className="flex flex-wrap gap-1.5 items-center">
            <Info size={11} className="text-gray-400" />
            {tiers.map((t) => {
              const label     = t.max_qty ? `${t.min_qty}–${t.max_qty} pcs` : `${t.min_qty}+ pcs`;
              const qty       = parseInt(item.quantity, 10);
              const isCurrent = qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty);
              return (
                <span
                  key={t.id}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    isCurrent
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-semibold'
                      : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
                >
                  {label} → {formatCurrency(t.price)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Confirmed breakdown from server ── */}
      {item.breakdown && (
        <div className="px-3 pb-2 -mt-1">
          <p className="text-xs text-gray-400 font-mono">{item.breakdown}</p>
        </div>
      )}

      {/* ── Expanded: extra fees + description ── */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 grid grid-cols-3 gap-3">
          <Input
            label="Description (optional)"
            placeholder="Override product name on invoice"
            value={item.description}
            onChange={(e) => u('description', e.target.value)}
          />
          <Input
            label="Design Fee (PKR)"
            type="number" min="0" prefix="₨"
            value={item.designFee}
            onChange={(e) => u('designFee', e.target.value)}
          />
          <Input
            label="Urgent Fee (PKR)"
            type="number" min="0" prefix="₨"
            value={item.urgentFee}
            onChange={(e) => u('urgentFee', e.target.value)}
          />
        </div>
      )}

    </div>
  );
};

export default BillItemRow;
