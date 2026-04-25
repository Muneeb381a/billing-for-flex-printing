import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Input, Select } from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import * as catApi from '../../api/categories.js';
import cn from '../../utils/cn.js';

const calcSqft = (width, height, quantity) => {
  const w = parseFloat(width) || 0;
  const h = parseFloat(height) || 0;
  const q = parseInt(quantity, 10) || 1;
  if (!w || !h) return null;
  return parseFloat((w * h * q).toFixed(3));
};

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

  const lineTotal = (parseFloat(item.amount || 0))
    + (parseFloat(item.designFee || 0))
    + (parseFloat(item.urgentFee || 0));

  const showLabel = index === 0;

  return (
    <div className={cn(
      'border border-slate-200 border-l-4 border-l-brand-500 rounded-xl bg-white shadow-sm overflow-hidden',
      'hover:border-slate-300 hover:shadow-md transition-all duration-150',
    )}>

      {/* ── Category row ──────────────────────────────────── */}
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

          {/* Category */}
          <div className="col-span-10">
            <Select
              label={showLabel ? 'Item / Category' : undefined}
              placeholder="Select item…"
              options={categories}
              value={item.categoryId}
              onChange={(e) => onUpdate(item.id, {
                categoryId: e.target.value,
                width: '', height: '', quantity: 1,
                sqft: null, amount: '',
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
      <div className="grid grid-cols-12 gap-2 px-3 pb-2.5 items-end">
        <div className="col-span-1" />

        {/* Width */}
        <div className="col-span-2">
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
        <div className="col-span-2">
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
        <div className="col-span-2">
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

        {/* Sqft — read-only */}
        <div className="col-span-2">
          {showLabel && <p className="text-xs font-medium text-slate-600 mb-1">Sqft</p>}
          <div className={cn(
            'px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-center tabular-nums',
            item.sqft != null ? 'text-indigo-700 font-semibold' : 'text-slate-300',
          )}>
            {item.sqft != null ? item.sqft : '—'}
          </div>
        </div>

        {/* Amount — manual */}
        <div className="col-span-2">
          <Input
            label={showLabel ? 'Amount (PKR)' : undefined}
            type="number" min="0" step="1" prefix="₨" placeholder="0"
            value={item.amount}
            onChange={(e) => u('amount', e.target.value)}
          />
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

      {/* Line total */}
      {lineTotal > 0 && (
        <div className="px-3 pb-2 flex justify-end">
          <span className="text-sm font-black text-brand-700">{formatCurrency(lineTotal)}</span>
        </div>
      )}

      {/* ── Expanded: description + surcharges ── */}
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
