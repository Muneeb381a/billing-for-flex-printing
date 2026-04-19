import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Input, Select } from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import * as catApi from '../../api/categories.js';
import cn from '../../utils/cn.js';

// ── Client-side price calculation (no API calls needed) ───────

const calcPrice = (cat, item) => {
  if (!cat) return { itemTotal: 0, unitPrice: 0, sqft: null };

  const qty = parseInt(item.quantity, 10) || 1;

  switch (cat.pricing_type) {
    case 'area_based': {
      const w = parseFloat(item.width)  || 0;
      const h = parseFloat(item.height) || 0;
      if (!w || !h) return { itemTotal: 0, unitPrice: parseFloat(cat.rate || 0), sqft: null };
      const rawSqft   = w * h;
      const unitSqft  = Math.max(rawSqft, parseFloat(cat.min_sqft || 1));
      const totalSqft = parseFloat((unitSqft * qty).toFixed(3));
      const rate      = parseFloat(cat.rate || 0);
      return {
        sqft:      totalSqft,
        unitPrice: rate,
        itemTotal: parseFloat((totalSqft * rate).toFixed(2)),
      };
    }
    case 'quantity_based': {
      const tiers = (cat.tiers || []).map((t) => ({
        min_qty: Number(t.min_qty),
        max_qty: t.max_qty != null ? Number(t.max_qty) : null,
        price:   parseFloat(t.price),
      }));
      const tier = tiers.find((t) => qty >= t.min_qty && (t.max_qty == null || qty <= t.max_qty));
      if (!tier) return { itemTotal: 0, unitPrice: 0, sqft: null, noTier: true };
      return {
        sqft:      null,
        unitPrice: tier.price,
        itemTotal: parseFloat((tier.price).toFixed(2)),
      };
    }
    case 'fixed_charge': {
      const rate = parseFloat(cat.rate || 0);
      return { sqft: null, unitPrice: rate, itemTotal: parseFloat((rate * qty).toFixed(2)) };
    }
    case 'custom': {
      const up = parseFloat(item.unitPrice) || 0;
      return { sqft: null, unitPrice: up, itemTotal: parseFloat((up * qty).toFixed(2)) };
    }
    default:
      return { itemTotal: 0, unitPrice: 0, sqft: null };
  }
};

const STRIP = {
  area_based:     'border-l-brand-500',
  quantity_based: 'border-l-emerald-500',
  fixed_charge:   'border-l-amber-500',
  custom:         'border-l-violet-500',
};

// ── Component ─────────────────────────────────────────────────

const BillItemRow = ({ item, index, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  const u = (field, val) => onUpdate(item.id, { [field]: val });

  const { data: catData } = useQuery({
    queryKey:  ['categories'],
    queryFn:   catApi.getCategories,
    staleTime: Infinity,
  });

  const categories = (catData?.data || []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const selectedCat = (catData?.data || []).find((c) => String(c.id) === String(item.categoryId));

  // Recalculate price whenever relevant inputs change
  useEffect(() => {
    if (!selectedCat) return;
    if (selectedCat.pricing_type === 'area_based' && (!item.width || !item.height)) return;
    if (selectedCat.pricing_type === 'custom' && !item.unitPrice) return;

    const result = calcPrice(selectedCat, item);
    if (result.itemTotal !== item.itemTotal || result.sqft !== item.sqft) {
      onUpdate(item.id, {
        itemTotal: result.itemTotal,
        unitPrice: result.unitPrice,
        sqft:      result.sqft,
      });
    }
  }, [item.categoryId, item.width, item.height, item.quantity, item.unitPrice]); // eslint-disable-line

  const priceResult = useMemo(() => calcPrice(selectedCat, item), [
    selectedCat, item.width, item.height, item.quantity, item.unitPrice, // eslint-disable-line
  ]);

  const model     = selectedCat?.pricing_type;
  const tiers     = selectedCat?.tiers || [];
  const lineTotal = parseFloat(item.itemTotal || 0)
                  + parseFloat(item.designFee || 0)
                  + parseFloat(item.urgentFee || 0);

  const stripClass = STRIP[model] || 'border-l-slate-200';

  const liveFormula = useMemo(() => {
    if (model !== 'area_based') return null;
    const w = parseFloat(item.width);
    const h = parseFloat(item.height);
    const q = parseInt(item.quantity, 10);
    if (!w || !h || !q) return null;
    const rawSqft  = w * h;
    const unitSqft = Math.max(rawSqft, parseFloat(selectedCat?.min_sqft || 1));
    const total    = parseFloat((unitSqft * q).toFixed(3));
    const note     = rawSqft < unitSqft ? ` (min ${unitSqft} sqft/pc)` : '';
    return `${w} × ${h} × ${q} = ${total} sqft${note}`;
  }, [model, item.width, item.height, item.quantity, selectedCat?.min_sqft]); // eslint-disable-line

  return (
    <div className={cn(
      'border border-slate-200 border-l-4 rounded-xl bg-white shadow-sm overflow-hidden',
      'hover:border-slate-300 hover:shadow-md transition-all duration-150',
      stripClass,
    )}>

      {/* ── Selection row ─────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2">
        <div className="grid grid-cols-12 gap-2 items-end">

          {/* Row number */}
          <div className="col-span-1 flex items-end justify-center pb-1">
            <span className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
              lineTotal > 0 ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400',
            )}>
              {index + 1}
            </span>
          </div>

          {/* Category (item) */}
          <div className="col-span-10">
            <Select
              label={index === 0 ? 'Item / Category' : undefined}
              placeholder="Select item…"
              options={categories}
              value={item.categoryId}
              onChange={(e) => onUpdate(item.id, {
                categoryId:  e.target.value,
                width: '', height: '', quantity: 1, unitPrice: '',
                itemTotal: 0, sqft: null,
              })}
            />
          </div>

          {/* Delete */}
          <div className="col-span-1 flex items-end justify-end pb-0.5">
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Inputs row ────────────────────────────────────── */}
      {selectedCat && (
        <div className="grid grid-cols-12 gap-2 px-3 pb-2.5 items-end">
          <div className="col-span-1" />

          {model === 'area_based' && (
            <>
              <div className="col-span-2">
                <Input label="W (ft)" type="number" min="0.1" step="0.1" placeholder="5"
                  value={item.width} onChange={(e) => u('width', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Input label="H (ft)" type="number" min="0.1" step="0.1" placeholder="3"
                  value={item.height} onChange={(e) => u('height', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Input label="Qty" type="number" min="1" step="1" placeholder="1"
                  value={item.quantity} onChange={(e) => u('quantity', e.target.value)} />
              </div>
              <div className="col-span-1" />
            </>
          )}

          {(model === 'quantity_based' || model === 'fixed_charge') && (
            <>
              <div className="col-span-4">
                <Input
                  label={model === 'quantity_based' ? 'Quantity (pcs)' : 'Quantity'}
                  type="number" min="1" step="1"
                  placeholder={model === 'quantity_based' ? '500' : '1'}
                  value={item.quantity}
                  onChange={(e) => u('quantity', e.target.value)}
                />
              </div>
              <div className="col-span-3" />
            </>
          )}

          {model === 'custom' && (
            <>
              <div className="col-span-3">
                <Input label="Unit Price" type="number" min="0" step="1" prefix="₨" placeholder="0"
                  value={item.unitPrice} onChange={(e) => u('unitPrice', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Input label="Qty" type="number" min="1" step="1" placeholder="1"
                  value={item.quantity} onChange={(e) => u('quantity', e.target.value)} />
              </div>
              <div className="col-span-2" />
            </>
          )}

          {/* Amount */}
          <div className="col-span-3 text-end">
            <p className={cn('text-base font-black leading-tight',
              lineTotal > 0 ? 'text-brand-700' : 'text-slate-200')}>
              {lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
            </p>
            {liveFormula && (
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{liveFormula}</p>
            )}
            {priceResult.noTier && (
              <p className="text-[10px] text-amber-500 mt-0.5">No tier for this qty</p>
            )}
          </div>

          {/* Expand toggle */}
          <div className="col-span-1 flex items-end justify-end pb-0.5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Tier pills (quantity_based) ── */}
      {model === 'quantity_based' && tiers.length > 0 && (
        <div className="px-3 pb-2.5 -mt-0.5">
          <div className="flex flex-wrap gap-1.5 items-center">
            <Info size={10} className="text-slate-300" />
            {tiers.map((t, i) => {
              const label     = t.max_qty ? `${t.min_qty}–${t.max_qty} pcs` : `${t.min_qty}+ pcs`;
              const qty       = parseInt(item.quantity, 10);
              const isCurrent = qty >= Number(t.min_qty) && (t.max_qty == null || qty <= Number(t.max_qty));
              return (
                <span key={i} className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                  isCurrent
                    ? 'bg-brand-50 border-brand-200 text-brand-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-400',
                )}>
                  {label} → {formatCurrency(parseFloat(t.price))}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Expanded: description + fees ── */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-3 grid grid-cols-3 gap-3">
          <Input
            label="Description (optional)"
            placeholder="Overrides item name on invoice"
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
