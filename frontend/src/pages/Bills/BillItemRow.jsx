import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Input, Select } from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import * as catApi from '../../api/categories.js';
import cn from '../../utils/cn.js';

const TYPE_MAP = {
  area_based:     'area',
  quantity_based: 'quantity',
  fixed_charge:   'fixed',
  custom:         'fixed',
};

const STRIP = {
  area:     'border-l-indigo-500',
  quantity: 'border-l-emerald-500',
  fixed:    'border-l-amber-500',
};

const calcSqft = (width, height, quantity) => {
  const w = Number(width)  || 0;
  const h = Number(height) || 0;
  const q = parseInt(quantity, 10) || 1;
  if (!w || !h) return null;
  return parseFloat((w * h * q).toFixed(3));
};

const ReadBox = ({ label, value, highlight }) => (
  <div className="flex flex-col gap-1">
    <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{label}</p>
    <div className={cn(
      'min-h-11.5 px-3 rounded-xl border flex items-center justify-center font-mono tabular-nums text-sm',
      highlight
        ? 'border-brand-200 bg-brand-50 text-brand-700 font-bold border-2'
        : 'border-slate-200 bg-slate-50 text-slate-400',
    )}>
      {value}
    </div>
  </div>
);

const BillItemRow = ({ item, index, onUpdate, onRemove, onQuickCreate }) => {
  const [expanded, setExpanded] = useState(false);

  const { data: catData } = useQuery({
    queryKey:  ['categories'],
    queryFn:   catApi.getCategories,
    staleTime: Infinity,
  });

  const allCats     = catData?.data || [];
  const categories  = allCats.map((c) => ({ value: String(c.id), label: c.name }));
  const selectedCat = allCats.find((c) => String(c.id) === String(item.categoryId));

  const type        = TYPE_MAP[selectedCat?.pricing_type] ?? null;
  const pricingMode = selectedCat?.pricing_mode ?? 'total';

  const qty  = parseInt(item.quantity, 10) || 1;
  const rate = Number(item.rate) || 0;
  const sqft = Number(item.sqft) || 0;

  const finalAmount = (() => {
    if (!type) return 0;
    if (type === 'area') return parseFloat((sqft * rate).toFixed(2));
    if (type === 'quantity') {
      return pricingMode === 'per_unit'
        ? parseFloat((qty * rate).toFixed(2))
        : rate;
    }
    return rate;
  })();

  const designFee = Number(item.designFee) || 0;
  const urgentFee = Number(item.urgentFee) || 0;
  const lineTotal = finalAmount + designFee + urgentFee;

  const stripClass = STRIP[type] ?? 'border-l-slate-200';

  const handleCategoryChange = (e) => {
    const cat            = allCats.find((c) => String(c.id) === e.target.value);
    const newType        = TYPE_MAP[cat?.pricing_type] ?? 'fixed';
    const newPricingMode = cat?.pricing_mode ?? 'total';
    onUpdate(item.id, {
      categoryId:  e.target.value,
      catType:     newType,
      pricingMode: newPricingMode,
      width: '', height: '', quantity: 1, sqft: null, rate: '',
    });
  };

  return (
    <div className={cn(
      'border border-slate-200 border-l-4 rounded-xl bg-white shadow-sm overflow-hidden',
      'hover:border-slate-300 hover:shadow-md transition-all duration-150',
      stripClass,
    )}>

      {/* ── Category selector row ─────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex gap-2 items-end">
          <span className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mb-1.5',
            finalAmount > 0 ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400',
          )}>
            {index + 1}
          </span>

          <Select
            label="Product / Service"
            placeholder="Select product…"
            options={categories}
            value={item.categoryId}
            onChange={handleCategoryChange}
            size="lg"
            wrapperClassName="flex-1"
          />

          <div className="flex items-end gap-1 mb-0.5">
            <button
              type="button"
              onClick={() => onQuickCreate?.(item.id)}
              title="Add new product"
              className="p-2 text-brand-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Area: W × H × Qty → Sqft → Rate → Total ─────────── */}
      {type === 'area' && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Input
              label="Width (ft)"
              type="number" min="0" step="0.1" placeholder="0"
              size="lg"
              value={item.width}
              onChange={(e) => {
                const w = e.target.value;
                onUpdate(item.id, { width: w, sqft: calcSqft(w, item.height, item.quantity) });
              }}
            />
            <Input
              label="Height (ft)"
              type="number" min="0" step="0.1" placeholder="0"
              size="lg"
              value={item.height}
              onChange={(e) => {
                const h = e.target.value;
                onUpdate(item.id, { height: h, sqft: calcSqft(item.width, h, item.quantity) });
              }}
            />
            <Input
              label="Quantity"
              type="number" min="1" step="1" placeholder="1"
              size="lg"
              value={item.quantity}
              onChange={(e) => {
                const q = e.target.value;
                onUpdate(item.id, { quantity: q, sqft: calcSqft(item.width, item.height, q) });
              }}
            />
            <ReadBox
              label="Sqft"
              value={item.sqft != null ? item.sqft : '—'}
              highlight={false}
            />
            <Input
              label="Rate / sqft"
              type="number" min="0" step="1" prefix="₨" placeholder="0"
              size="lg"
              value={item.rate}
              onChange={(e) => onUpdate(item.id, { rate: e.target.value })}
            />
            <ReadBox
              label="Total Amount"
              value={finalAmount > 0 ? formatCurrency(finalAmount) : '—'}
              highlight={finalAmount > 0}
            />
          </div>
          {item.sqft != null && rate > 0 && (
            <p className="text-xs text-slate-400 font-mono mt-2.5">
              {item.sqft} sqft × ₨{rate.toLocaleString('en-PK')} ={' '}
              <span className="text-indigo-600 font-semibold">{formatCurrency(finalAmount)}</span>
              {(designFee > 0 || urgentFee > 0) && (
                <span className="text-slate-500 ml-2">
                  · Line total: <span className="font-bold">{formatCurrency(lineTotal)}</span>
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* ── Quantity ──────────────────────────────────────────── */}
      {type === 'quantity' && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input
              label="Quantity"
              type="number" min="1" step="1" placeholder="1"
              size="lg"
              value={item.quantity}
              onChange={(e) => onUpdate(item.id, { quantity: e.target.value })}
            />
            <Input
              label={pricingMode === 'per_unit' ? 'Rate / item' : 'Total Amount'}
              type="number" min="0" step="1" prefix="₨" placeholder="0"
              size="lg"
              value={item.rate}
              onChange={(e) => onUpdate(item.id, { rate: e.target.value })}
            />
            {pricingMode === 'per_unit' && (
              <ReadBox
                label="Total Amount"
                value={finalAmount > 0 ? formatCurrency(finalAmount) : '—'}
                highlight={finalAmount > 0}
              />
            )}
          </div>
          {qty > 0 && rate > 0 && (
            <p className="text-xs text-slate-400 font-mono mt-2.5">
              {pricingMode === 'per_unit'
                ? <>{qty} pcs × ₨{rate.toLocaleString('en-PK')} = <span className="text-emerald-600 font-semibold">{formatCurrency(finalAmount)}</span></>
                : <>{qty} pcs · Total: <span className="text-emerald-600 font-semibold">{formatCurrency(finalAmount)}</span></>
              }
              {(designFee > 0 || urgentFee > 0) && (
                <span className="text-slate-500 ml-2">
                  · Line total: <span className="font-bold">{formatCurrency(lineTotal)}</span>
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* ── Fixed — Amount is the total ───────────────────────── */}
      {type === 'fixed' && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Amount (PKR)"
              type="number" min="0" step="1" prefix="₨" placeholder="0"
              size="lg"
              value={item.rate}
              onChange={(e) => onUpdate(item.id, { rate: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* ── Expand/collapse for description & surcharges ─────── */}
      <div className="border-t border-slate-100">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="font-medium">
            {expanded ? 'Hide' : 'Add'} description &amp; extra fees
            {(designFee > 0 || urgentFee > 0) && (
              <span className="ml-2 text-amber-600 font-semibold">
                +{formatCurrency(designFee + urgentFee)}
              </span>
            )}
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 pb-4 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Description (optional)"
              placeholder="Overrides item name on invoice"
              size="lg"
              value={item.description}
              onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            />
            <Input
              label="Design Fee"
              type="number" min="0" prefix="₨" placeholder="0"
              size="lg"
              value={item.designFee}
              onChange={(e) => onUpdate(item.id, { designFee: e.target.value })}
            />
            <Input
              label="Urgent Fee"
              type="number" min="0" prefix="₨" placeholder="0"
              size="lg"
              value={item.urgentFee}
              onChange={(e) => onUpdate(item.id, { urgentFee: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BillItemRow;
