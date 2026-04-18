import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, ChevronDown, ChevronUp, Info, Loader2 } from 'lucide-react';
import { Input, Select } from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import useDebounce from '../../hooks/useDebounce.js';
import * as catApi     from '../../api/categories.js';
import * as prodApi    from '../../api/products.js';
import * as pricingApi from '../../api/pricing.js';
import cn from '../../utils/cn.js';

// ─────────────────────────────────────────────────────────────
// Pure helpers  (unchanged logic)
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

const buildLiveFormula = (item, minSqft = 1) => {
  if (item.pricingModel !== 'area_based') return null;
  const w = parseFloat(item.width);
  const h = parseFloat(item.height);
  const q = parseInt(item.quantity, 10);
  if (!w || !h || !q || w <= 0 || h <= 0 || q < 1) return null;
  const rawSqft   = parseFloat((w * h).toFixed(3));
  const unitSqft  = Math.max(rawSqft, parseFloat(minSqft));
  const totalSqft = parseFloat((unitSqft * q).toFixed(3));
  const minNote   = rawSqft < parseFloat(minSqft) ? ` (min ${unitSqft} sqft/pc)` : '';
  return `${w} × ${h} × ${q} = ${totalSqft} sqft${minNote}`;
};

// Left border color by pricing model
const MODEL_STRIP = {
  area_based:     'border-l-brand-500',
  quantity_based: 'border-l-emerald-500',
  fixed_charge:   'border-l-amber-500',
  custom:         'border-l-violet-500',
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const BillItemRow = ({ item, index, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  const u = (field, val) => onUpdate(item.id, { [field]: val });

  const dWidth     = useDebounce(item.width,     400);
  const dHeight    = useDebounce(item.height,    400);
  const dQty       = useDebounce(item.quantity,  400);
  const dUnitPrice = useDebounce(item.unitPrice, 400);

  // ── Queries (unchanged) ───────────────────────────────────
  const { data: catData } = useQuery({
    queryKey:  ['categories'],
    queryFn:   catApi.getCategories,
    staleTime: Infinity,
  });

  const { data: prodData } = useQuery({
    queryKey:  ['products', item.categoryId],
    queryFn:   () => prodApi.getProducts({ category_id: item.categoryId, active_only: 'true' }),
    enabled:   !!item.categoryId,
    staleTime: 30_000,
  });

  const { data: configData } = useQuery({
    queryKey:  ['pricing-config', item.productId],
    queryFn:   () => pricingApi.getProductPricingConfig(item.productId),
    enabled:   !!item.productId,
    staleTime: 30_000,
  });

  useEffect(() => {
    const model = configData?.data?.product?.pricingModel;
    if (model && model !== item.pricingModel) {
      onUpdate(item.id, {
        pricingModel: model,
        width: '', height: '', quantity: 1, unitPrice: '',
        sqft: null, itemTotal: 0, breakdown: '',
      });
    }
  }, [configData]); // eslint-disable-line

  const calcReady = canCalculate(item.pricingModel, {
    ...item, width: dWidth, height: dHeight, quantity: dQty, unitPrice: dUnitPrice,
  });

  const { data: priceData, isFetching: calculating } = useQuery({
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

  useEffect(() => {
    if (!priceData?.data) return;
    const d = priceData.data;
    onUpdate(item.id, {
      itemTotal: d.itemTotal,
      unitPrice: d.unitPrice,
      sqft:      d.sqft ?? null,
      breakdown: d.breakdown,
    });
  }, [priceData]); // eslint-disable-line

  // ── Derived display values ────────────────────────────────
  const config     = configData?.data;
  const tiers      = config?.tiers ?? [];
  const minSqft    = config?.activeRule?.min_sqft ?? 1;
  const model      = item.pricingModel;

  const liveFormula = useMemo(
    () => buildLiveFormula(item, minSqft),
    [item.pricingModel, item.width, item.height, item.quantity, minSqft], // eslint-disable-line
  );

  const categories = (catData?.data  || []).map((c) => ({ value: String(c.id), label: c.name }));
  const products   = (prodData?.data || []).map((p) => ({ value: String(p.id), label: p.name }));

  const lineTotal = parseFloat(item.itemTotal  || 0)
                  + parseFloat(item.designFee  || 0)
                  + parseFloat(item.urgentFee  || 0);

  const stripClass = MODEL_STRIP[model] || 'border-l-slate-200';

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={cn(
      'border border-slate-200 border-l-4 rounded-xl bg-white shadow-sm overflow-hidden',
      'hover:border-slate-300 hover:shadow-md transition-all duration-150',
      stripClass,
    )}>

      {/* ── Main row ── */}
      <div className="grid grid-cols-12 gap-2 px-3 pt-3 pb-2.5 items-end">

        {/* Row number badge */}
        <div className="col-span-1 flex items-end justify-center pb-1">
          <span className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
            lineTotal > 0
              ? 'bg-brand-100 text-brand-700'
              : 'bg-slate-100 text-slate-400',
          )}>
            {index + 1}
          </span>
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

        {/* Dynamic inputs by pricing model */}
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

        {(model === 'quantity_based' || model === 'fixed_charge') && (
          <div className="col-span-3">
            <Input
              label={index === 0 ? (model === 'quantity_based' ? 'Quantity (pcs)' : 'Quantity') : undefined}
              type="number" min="1" step="1"
              placeholder={model === 'quantity_based' ? '500' : '1'}
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
          <div className="col-span-3 text-xs text-slate-300 italic leading-9 px-1">
            Select a product first
          </div>
        )}

        {/* Amount */}
        <div className="col-span-2 text-end">
          {index === 0 && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount</p>
          )}

          {calculating ? (
            <div className="flex items-center justify-end gap-1.5 text-slate-400">
              <Loader2 size={13} className="animate-spin" />
              <span className="text-xs font-medium">calc…</span>
            </div>
          ) : (
            <p className={cn(
              'text-base font-black leading-tight',
              lineTotal > 0 ? 'text-brand-700' : 'text-slate-200',
            )}>
              {lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
            </p>
          )}

          {/* Live sqft hint */}
          {liveFormula && !item.breakdown && (
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-tight">{liveFormula}</p>
          )}
          {item.sqft && item.breakdown && (
            <p className="text-[10px] text-brand-400 font-semibold mt-0.5">{item.sqft} sqft</p>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-1 flex items-end justify-end gap-0.5 pb-0.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse' : 'Design / urgent fees'}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Tier pills (quantity_based) ── */}
      {model === 'quantity_based' && tiers.length > 0 && (
        <div className="px-3 pb-2.5 -mt-0.5">
          <div className="flex flex-wrap gap-1.5 items-center">
            <Info size={10} className="text-slate-300" />
            {tiers.map((t) => {
              const label     = t.max_qty ? `${t.min_qty}–${t.max_qty} pcs` : `${t.min_qty}+ pcs`;
              const qty       = parseInt(item.quantity, 10);
              const isCurrent = qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty);
              return (
                <span
                  key={t.id}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                    isCurrent
                      ? 'bg-brand-50 border-brand-200 text-brand-700 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-400',
                  )}
                >
                  {label} → {formatCurrency(t.price)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Breakdown hint ── */}
      {item.breakdown && (
        <div className="px-3 pb-2 -mt-0.5">
          <p className="text-[10px] text-slate-400 font-mono">{item.breakdown}</p>
        </div>
      )}

      {/* ── Expanded: design fee, urgent fee, description ── */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-3 grid grid-cols-3 gap-3">
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
