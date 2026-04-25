import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input, Select } from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import * as catApi from '../../api/categories.js';
import cn from '../../utils/cn.js';

const calcSqft = (width, height, quantity) => {
  const w = Number(width)  || 0;
  const h = Number(height) || 0;
  const q = parseInt(quantity, 10) || 1;
  if (!w || !h) return null;
  return parseFloat((w * h * q).toFixed(3));
};

const ReadBox = ({ label, value, highlight, showLabel }) => (
  <div className="shrink-0">
    {showLabel && <p className="text-xs font-medium text-slate-600 mb-1">{label}</p>}
    <div className={cn(
      'h-9.5 px-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono flex items-center justify-center tabular-nums',
      highlight ? 'text-indigo-700 font-semibold' : 'text-slate-300',
    )}>
      {value}
    </div>
  </div>
);

const BillItemRow = ({ item, index, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  const { data: catData } = useQuery({
    queryKey:  ['categories'],
    queryFn:   catApi.getCategories,
    staleTime: Infinity,
  });

  const categories = (catData?.data || []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  // Derived values — never NaN
  const sqft        = item.sqft != null ? item.sqft : 0;
  const rate        = Number(item.rate) || 0;
  const finalAmount = parseFloat((sqft * rate).toFixed(2));
  const designFee   = Number(item.designFee) || 0;
  const urgentFee   = Number(item.urgentFee) || 0;
  const lineTotal   = finalAmount + designFee + urgentFee;

  const showLabel = index === 0;

  return (
    <div className={cn(
      'border border-slate-200 border-l-4 border-l-brand-500 rounded-xl bg-white shadow-sm overflow-hidden',
      'hover:border-slate-300 hover:shadow-md transition-all duration-150',
    )}>

      {/* ── Category row ──────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2">
        <div className="grid grid-cols-12 gap-2 items-end">
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
              onChange={(e) => onUpdate(item.id, {
                categoryId: e.target.value,
                width: '', height: '', quantity: 1,
                sqft: null, rate: '',
              })}
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

      {/* ── Inputs row — flex so all 7 fields fit cleanly ─── */}
      <div className="flex gap-2 items-end px-3 pb-2.5 ml-7">

        {/* Width */}
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

        {/* Height */}
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

        {/* Quantity */}
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

        {/* Sqft — read-only, auto */}
        <ReadBox
          label="Sqft"
          value={item.sqft != null ? item.sqft : '—'}
          highlight={item.sqft != null}
          showLabel={showLabel}
        />

        {/* Rate per sqft — user input */}
        <div className="w-22.5 shrink-0">
          <Input
            label={showLabel ? 'Rate/sqft' : undefined}
            type="number" min="0" step="1" prefix="₨" placeholder="0"
            value={item.rate}
            onChange={(e) => onUpdate(item.id, { rate: e.target.value })}
          />
        </div>

        {/* Total Amount — read-only, auto = sqft × rate */}
        <div className="flex-1 min-w-25">
          {showLabel && <p className="text-xs font-medium text-slate-600 mb-1">Total Amount</p>}
          <div className={cn(
            'h-9.5 px-3 rounded-xl border-2 flex items-center justify-center font-bold tabular-nums text-sm',
            finalAmount > 0
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-slate-200 bg-slate-50 text-slate-300',
          )}>
            {finalAmount > 0 ? formatCurrency(finalAmount) : '—'}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="pb-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Formula hint + surcharge total */}
      {(item.sqft != null && rate > 0) && (
        <div className="px-3 pb-2.5 ml-7 flex items-center justify-between">
          <p className="text-[11px] text-slate-400 font-mono">
            {item.sqft} sqft × ₨{rate.toLocaleString('en-PK')} = <span className="text-brand-600 font-semibold">{formatCurrency(finalAmount)}</span>
          </p>
          {(designFee > 0 || urgentFee > 0) && (
            <p className="text-[11px] text-slate-500">
              Line total: <span className="font-bold">{formatCurrency(lineTotal)}</span>
              {designFee > 0 && <span className="text-amber-600 ml-1">(+{formatCurrency(designFee)} design)</span>}
              {urgentFee > 0 && <span className="text-amber-600 ml-1">(+{formatCurrency(urgentFee)} urgent)</span>}
            </p>
          )}
        </div>
      )}

      {/* ── Expanded: description + surcharges ── */}
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
