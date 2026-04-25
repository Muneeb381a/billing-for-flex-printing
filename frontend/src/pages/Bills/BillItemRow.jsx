import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input, Select } from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import * as catApi from '../../api/categories.js';
import cn from '../../utils/cn.js';

// ── Maps DB pricing_type → 3 display types ───────────────────
const TYPE_MAP = {
  area_based:     'area',
  quantity_based: 'quantity',
  fixed_charge:   'fixed',
  custom:         'fixed',
};

// ── Left-border accent per type ───────────────────────────────
const STRIP = {
  area:     'border-l-indigo-500',
  quantity: 'border-l-emerald-500',
  fixed:    'border-l-amber-500',
};

// ── sqft calculation ─────────────────────────────────────────
const calcSqft = (width, height, quantity) => {
  const w = Number(width)  || 0;
  const h = Number(height) || 0;
  const q = parseInt(quantity, 10) || 1;
  if (!w || !h) return null;
  return parseFloat((w * h * q).toFixed(3));
};

// ── Shared read-only display box ─────────────────────────────
const ReadBox = ({ label, value, highlight, showLabel, wide }) => (
  <div className={cn('shrink-0', wide ? 'flex-1 min-w-25' : '')}>
    {showLabel && <p className="text-xs font-medium text-slate-600 mb-1">{label}</p>}
    <div className={cn(
      'h-9.5 px-2 rounded-xl border flex items-center justify-center font-mono tabular-nums text-sm',
      highlight
        ? 'border-brand-200 bg-brand-50 text-brand-700 font-bold border-2'
        : 'border-slate-200 bg-slate-50 text-slate-300',
    )}>
      {value}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────
const BillItemRow = ({ item, index, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  const { data: catData } = useQuery({
    queryKey:  ['categories'],
    queryFn:   catApi.getCategories,
    staleTime: Infinity,
  });

  const allCats    = catData?.data || [];
  const categories = allCats.map((c) => ({ value: String(c.id), label: c.name }));
  const selectedCat = allCats.find((c) => String(c.id) === String(item.categoryId));

  // Derive type and pricing_mode from the selected category
  const type        = TYPE_MAP[selectedCat?.pricing_type] ?? null;
  // pricing_mode only matters for quantity type; default 'total' per spec
  const pricingMode = selectedCat?.pricing_mode ?? 'total';

  // ── Per-type derived values (never NaN) ──────────────────
  const qty  = parseInt(item.quantity, 10) || 1;
  const rate = Number(item.rate) || 0;
  const sqft = Number(item.sqft) || 0;

  const finalAmount = (() => {
    if (!type) return 0;
    if (type === 'area') return parseFloat((sqft * rate).toFixed(2));
    if (type === 'quantity') {
      // per_unit: qty × rate   |   total: rate is the whole job price
      return pricingMode === 'per_unit'
        ? parseFloat((qty * rate).toFixed(2))
        : rate;
    }
    return rate; // fixed — rate IS the amount
  })();

  const designFee = Number(item.designFee) || 0;
  const urgentFee = Number(item.urgentFee) || 0;
  const lineTotal = finalAmount + designFee + urgentFee;

  const showLabel   = index === 0;
  const stripClass  = STRIP[type] ?? 'border-l-slate-200';

  // ── Handle category selection ─────────────────────────────
  const handleCategoryChange = (e) => {
    const cat            = allCats.find((c) => String(c.id) === e.target.value);
    const newType        = TYPE_MAP[cat?.pricing_type] ?? 'fixed';
    const newPricingMode = cat?.pricing_mode ?? 'total';
    onUpdate(item.id, {
      categoryId:  e.target.value,
      catType:     newType,
      pricingMode: newPricingMode,
      // reset all measure fields so stale values don't bleed across types
      width: '', height: '', quantity: 1, sqft: null, rate: '',
    });
  };

  // ── Expand button ─────────────────────────────────────────
  const ExpandBtn = () => (
    <div className="pb-0.5 shrink-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </div>
  );

  return (
    <div className={cn(
      'border border-slate-200 border-l-4 rounded-xl bg-white shadow-sm overflow-hidden',
      'hover:border-slate-300 hover:shadow-md transition-all duration-150',
      stripClass,
    )}>

      {/* ── Category selector row ─────────────────────────── */}
      <div className="px-3 pt-3 pb-2">
        <div className="grid grid-cols-12 gap-2 items-end">

          {/* Row badge */}
          <div className="col-span-1 flex items-end justify-center pb-1">
            <span className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
              finalAmount > 0 ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400',
            )}>
              {index + 1}
            </span>
          </div>

          <div className="col-span-10">
            <Select
              label={showLabel ? 'Item / Category' : undefined}
              placeholder="Select item…"
              options={categories}
              value={item.categoryId}
              onChange={handleCategoryChange}
            />
          </div>

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

      {/* ── TYPE: area — W × H × Qty → Sqft → Rate → Total ── */}
      {type === 'area' && (
        <div className="flex gap-2 items-end px-3 pb-2.5 ml-7">
          <div className="w-18 shrink-0">
            <Input
              label={showLabel ? 'W (ft)' : undefined}
              type="number" min="0" step="0.1" placeholder="—"
              value={item.width}
              onChange={(e) => {
                const w = e.target.value;
                onUpdate(item.id, { width: w, sqft: calcSqft(w, item.height, item.quantity) });
              }}
            />
          </div>
          <div className="w-18 shrink-0">
            <Input
              label={showLabel ? 'H (ft)' : undefined}
              type="number" min="0" step="0.1" placeholder="—"
              value={item.height}
              onChange={(e) => {
                const h = e.target.value;
                onUpdate(item.id, { height: h, sqft: calcSqft(item.width, h, item.quantity) });
              }}
            />
          </div>
          <div className="w-15 shrink-0">
            <Input
              label={showLabel ? 'Qty' : undefined}
              type="number" min="1" step="1" placeholder="1"
              value={item.quantity}
              onChange={(e) => {
                const q = e.target.value;
                onUpdate(item.id, { quantity: q, sqft: calcSqft(item.width, item.height, q) });
              }}
            />
          </div>
          <ReadBox
            label="Sqft"
            value={item.sqft != null ? item.sqft : '—'}
            highlight={false}
            showLabel={showLabel}
          />
          <div className="w-22.5 shrink-0">
            <Input
              label={showLabel ? 'Rate/sqft' : undefined}
              type="number" min="0" step="1" prefix="₨" placeholder="0"
              value={item.rate}
              onChange={(e) => onUpdate(item.id, { rate: e.target.value })}
            />
          </div>
          <ReadBox
            label="Total Amount"
            value={finalAmount > 0 ? formatCurrency(finalAmount) : '—'}
            highlight={finalAmount > 0}
            showLabel={showLabel}
            wide
          />
          <ExpandBtn />
        </div>
      )}

      {/* ── TYPE: quantity ────────────────────────────────── */}
      {type === 'quantity' && (
        <div className="flex gap-2 items-end px-3 pb-2.5 ml-7">
          <div className="w-28 shrink-0">
            <Input
              label={showLabel ? 'Quantity' : undefined}
              type="number" min="1" step="1" placeholder="1"
              value={item.quantity}
              onChange={(e) => onUpdate(item.id, { quantity: e.target.value })}
            />
          </div>
          <div className="w-36 shrink-0">
            <Input
              label={showLabel
                ? (pricingMode === 'per_unit' ? 'Rate / item' : 'Total Amount')
                : undefined}
              type="number" min="0" step="1" prefix="₨" placeholder="0"
              value={item.rate}
              onChange={(e) => onUpdate(item.id, { rate: e.target.value })}
            />
          </div>
          {/* Show computed total only in per_unit mode (in total mode, input IS the total) */}
          {pricingMode === 'per_unit' && (
            <ReadBox
              label="Total Amount"
              value={finalAmount > 0 ? formatCurrency(finalAmount) : '—'}
              highlight={finalAmount > 0}
              showLabel={showLabel}
              wide
            />
          )}
          <ExpandBtn />
        </div>
      )}

      {/* ── TYPE: fixed — Amount is the total ───────────── */}
      {type === 'fixed' && (
        <div className="flex gap-2 items-end px-3 pb-2.5 ml-7">
          <div className="w-52 shrink-0">
            <Input
              label={showLabel ? 'Amount (PKR)' : undefined}
              type="number" min="0" step="1" prefix="₨" placeholder="0"
              value={item.rate}
              onChange={(e) => onUpdate(item.id, { rate: e.target.value })}
            />
          </div>
          <ExpandBtn />
        </div>
      )}

      {/* ── Formula hint ──────────────────────────────────── */}
      {type === 'area' && item.sqft != null && rate > 0 && (
        <div className="px-3 pb-2.5 ml-7 flex items-center justify-between flex-wrap gap-1">
          <p className="text-[11px] text-slate-400 font-mono">
            {item.sqft} sqft × ₨{rate.toLocaleString('en-PK')} ={' '}
            <span className="text-brand-600 font-semibold">{formatCurrency(finalAmount)}</span>
          </p>
          {(designFee > 0 || urgentFee > 0) && (
            <p className="text-[11px] text-slate-500">
              Line: <span className="font-bold">{formatCurrency(lineTotal)}</span>
            </p>
          )}
        </div>
      )}

      {type === 'quantity' && qty > 0 && rate > 0 && (
        <div className="px-3 pb-2.5 ml-7">
          <p className="text-[11px] text-slate-400 font-mono">
            {pricingMode === 'per_unit'
              ? <>
                  {qty} pcs × ₨{rate.toLocaleString('en-PK')} ={' '}
                  <span className="text-emerald-600 font-semibold">{formatCurrency(finalAmount)}</span>
                </>
              : <>
                  {qty} pcs · Total:{' '}
                  <span className="text-emerald-600 font-semibold">{formatCurrency(finalAmount)}</span>
                </>
            }
            {(designFee > 0 || urgentFee > 0) && (
              <span className="text-slate-500 ml-2">
                · Line: <span className="font-bold">{formatCurrency(lineTotal)}</span>
              </span>
            )}
          </p>
        </div>
      )}

      {/* ── Expanded: description + surcharges ───────────── */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-3 grid grid-cols-3 gap-3">
          <Input
            label="Description (optional)"
            placeholder="Overrides item name on invoice"
            value={item.description}
            onChange={(e) => onUpdate(item.id, { description: e.target.value })}
          />
          <Input
            label="Design Fee (PKR)"
            type="number" min="0" prefix="₨"
            value={item.designFee}
            onChange={(e) => onUpdate(item.id, { designFee: e.target.value })}
          />
          <Input
            label="Urgent Fee (PKR)"
            type="number" min="0" prefix="₨"
            value={item.urgentFee}
            onChange={(e) => onUpdate(item.id, { urgentFee: e.target.value })}
          />
        </div>
      )}
    </div>
  );
};

export default BillItemRow;
