import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Package, Plus, TrendingUp, TrendingDown, AlertTriangle,
  AlertCircle, CheckCircle, RefreshCw, Settings, X, ChevronRight,
  Boxes,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as invAPI from '../../api/inventory.js';
import { formatDate } from '../../utils/format.js';
import cn from '../../utils/cn.js';

// ── Alert badge ───────────────────────────────────────────────
const AlertBadge = ({ level }) => {
  if (level === 'critical') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
      <AlertCircle size={10} /> Critical
    </span>
  );
  if (level === 'warning') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
      <AlertTriangle size={10} /> Warning
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
      <CheckCircle size={10} /> OK
    </span>
  );
};

// ── Stock progress bar ────────────────────────────────────────
const StockBar = ({ current, warning, critical }) => {
  const max   = Math.max(warning * 2, current, 1);
  const pct   = Math.min(100, (current / max) * 100);
  const color = current <= critical ? 'bg-red-500' : current <= warning ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
};

// ── Shared modal input style ──────────────────────────────────
const ModalInput = ({ label, error, ...props }) => (
  <div>
    {label && <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">{label}</label>}
    <input
      className={cn(
        'w-full px-3.5 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all',
        error
          ? 'border-red-400 focus:ring-red-400 bg-red-50'
          : 'border-slate-200 focus:ring-brand-500 hover:border-slate-300 bg-white',
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

// ── Restock / Adjust modal ────────────────────────────────────
const StockModal = ({ item, mode, onClose }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const mutation = useMutation({
    mutationFn: (data) =>
      mode === 'restock'
        ? invAPI.restock(item.id, { quantity: Number(data.quantity), notes: data.notes })
        : invAPI.adjust(item.id, { newStock: Number(data.newStock), notes: data.notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(mode === 'restock' ? 'Stock added!' : 'Stock adjusted!');
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Operation failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-900">
              {mode === 'restock' ? 'Add Stock' : 'Adjust Stock'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{item.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl mb-5">
          <div className="w-2 h-2 rounded-full bg-brand-500" />
          <p className="text-xs font-medium text-slate-600">
            Current stock: <span className="font-bold text-slate-900">{parseFloat(item.current_stock).toLocaleString()} {item.unit}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {mode === 'restock' ? (
            <ModalInput
              label={`Quantity to add (${item.unit})`}
              {...register('quantity', { required: 'Required', min: { value: 0.001, message: 'Must be > 0' } })}
              type="number" step="any" min="0.001"
              placeholder={`Amount in ${item.unit}`}
              error={errors.quantity?.message}
            />
          ) : (
            <ModalInput
              label={`New stock level (${item.unit})`}
              {...register('newStock', { required: 'Required', min: { value: 0, message: 'Cannot be negative' } })}
              type="number" step="any" min="0"
              defaultValue={item.current_stock}
              error={errors.newStock?.message}
            />
          )}
          <ModalInput
            label="Notes (optional)"
            {...register('notes')}
            placeholder="Supplier, reason…"
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {mutation.isPending ? 'Saving…' : mode === 'restock' ? 'Add Stock' : 'Set Stock'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Add Item modal ────────────────────────────────────────────
const COMMON_ITEMS = [
  'Star Flex Roll', 'China Flex Roll', 'Vinyl Sheet', 'One Way Vision',
  'Mesh Flex', 'Backlit Flex', 'Art Card 350gsm', 'Offset Paper 90gsm',
  'Sticker Sheet', 'Lamination Sheet', 'Business Card Stock',
  'Ink Bottle (Black)', 'Ink Bottle (Cyan)', 'Ink Bottle (Magenta)', 'Ink Bottle (Yellow)',
];

const AddItemModal = ({ onClose }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { unit: 'pcs', warningThreshold: 150, criticalThreshold: 50 },
  });

  const mutation = useMutation({
    mutationFn: invAPI.createItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Item added to inventory!');
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create item'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-slate-900">New Inventory Item</h3>
            <p className="text-xs text-slate-400 mt-0.5">Add stock item to track</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Item Name *
            </label>
            <input
              {...register('name', { required: 'Item name is required' })}
              list="common-items"
              placeholder="e.g. Star Flex Roll"
              className={cn(
                'w-full px-3.5 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all',
                errors.name
                  ? 'border-red-400 focus:ring-red-400 bg-red-50'
                  : 'border-slate-200 focus:ring-brand-500 hover:border-slate-300',
              )}
            />
            <datalist id="common-items">
              {COMMON_ITEMS.map((n) => <option key={n} value={n} />)}
            </datalist>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Unit</label>
              <select
                {...register('unit')}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 hover:border-slate-300 bg-white transition-all cursor-pointer"
              >
                {['pcs', 'sqft', 'sheet', 'roll', 'kg', 'litre', 'metre', 'set'].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
            <ModalInput
              label="Opening Stock"
              {...register('currentStock')}
              type="number" step="any" min="0"
              placeholder="0"
            />
            <ModalInput
              label="Warning threshold"
              {...register('warningThreshold')}
              type="number" min="0"
            />
            <ModalInput
              label="Critical threshold"
              {...register('criticalThreshold')}
              type="number" min="0"
            />
            <ModalInput
              label="Cost / unit (PKR)"
              {...register('costPerUnit')}
              type="number" step="any" min="0"
              placeholder="Optional"
            />
            <ModalInput
              label="Supplier (optional)"
              {...register('supplierName')}
              placeholder="Supplier name"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {mutation.isPending ? 'Creating…' : 'Add to Inventory'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Movement history panel ────────────────────────────────────
const MovementsPanel = ({ item, onClose }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', item.id],
    queryFn:  () => invAPI.getMovements(item.id, { limit: 100 }),
  });

  const movements = data?.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">{item.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Stock movement history</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-2">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))
          ) : movements.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw size={24} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No movements recorded yet</p>
            </div>
          ) : movements.map((m) => (
            <div
              key={m.id}
              className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
            >
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                m.movement_type === 'IN'  ? 'bg-emerald-50 text-emerald-600' :
                m.movement_type === 'OUT' ? 'bg-red-50 text-red-600' :
                                            'bg-slate-100 text-slate-500',
              )}>
                {m.movement_type === 'IN'  ? <TrendingUp size={14} /> :
                 m.movement_type === 'OUT' ? <TrendingDown size={14} /> :
                                             <RefreshCw size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-sm font-bold',
                    m.movement_type === 'IN'  ? 'text-emerald-700' :
                    m.movement_type === 'OUT' ? 'text-red-700' :
                                                'text-slate-700',
                  )}>
                    {m.movement_type === 'IN' ? '+' : m.movement_type === 'OUT' ? '−' : '±'}
                    {m.quantity} {item.unit}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatDate(m.created_at)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {m.reference_type && <span className="font-semibold">{m.reference_type}</span>}
                  {m.notes && ` — ${m.notes}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────
const Inventory = () => {
  const [modal,  setModal]  = useState(null);
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey:        ['inventory'],
    queryFn:         () => invAPI.getItems(),
    refetchInterval: 60_000,
  });

  const items    = data?.data || [];
  const displayed = items.filter((item) => {
    if (filter === 'critical') return item.alert_level === 'critical';
    if (filter === 'warning')  return item.alert_level !== 'ok';
    return true;
  });

  const criticalCount = items.filter((i) => i.alert_level === 'critical').length;
  const warningCount  = items.filter((i) => i.alert_level === 'warning').length;
  const okCount       = items.filter((i) => i.alert_level === 'ok').length;

  return (
    <div className="space-y-5">

      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {/* Summary chips */}
          {criticalCount > 0 && (
            <button
              onClick={() => setFilter('critical')}
              className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
            >
              <AlertCircle size={13} />
              {criticalCount} critical
            </button>
          )}
          {warningCount > 0 && (
            <button
              onClick={() => setFilter('warning')}
              className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <AlertTriangle size={13} />
              {warningCount} low stock
            </button>
          )}
          {okCount > 0 && !criticalCount && !warningCount && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-4 py-2.5 rounded-xl">
              <CheckCircle size={13} />
              All stock levels healthy
            </div>
          )}
        </div>

        <button
          onClick={() => setModal({ type: 'add' })}
          className="flex items-center gap-2 bg-brand-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-700 active:bg-brand-800 transition-colors cursor-pointer shadow-sm shadow-brand-200"
        >
          <Plus size={15} />
          Add Item
        </button>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          ['all',      'All Items'],
          ['warning',  'Low Stock'],
          ['critical', 'Critical'],
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer',
              filter === val
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {label}
            {val === 'critical' && criticalCount > 0 && (
              <span className="ms-1.5 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {criticalCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Items table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Boxes size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500 mb-1">
              {filter === 'all' ? 'No inventory items yet' : 'No items in this category'}
            </p>
            <p className="text-xs text-slate-400">
              {filter === 'all' ? 'Click "Add Item" to start tracking your materials' : 'Try switching to "All Items"'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-start px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Item</th>
                <th className="text-end px-4 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock</th>
                <th className="hidden sm:table-cell text-end px-4 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thresholds</th>
                <th className="text-center px-4 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayed.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">

                  {/* Name + supplier */}
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    {item.supplier_name && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.supplier_name}</p>
                    )}
                  </td>

                  {/* Stock + bar */}
                  <td className="px-4 py-4 text-end">
                    <p className="font-black text-slate-900 tabular-nums">
                      {parseFloat(item.current_stock).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">{item.unit}</p>
                    <div className="mt-2 w-24 ms-auto">
                      <StockBar
                        current={parseFloat(item.current_stock)}
                        warning={parseFloat(item.warning_threshold)}
                        critical={parseFloat(item.critical_threshold)}
                      />
                    </div>
                  </td>

                  {/* Thresholds */}
                  <td className="hidden sm:table-cell px-4 py-4 text-end">
                    <p className="text-[11px] text-slate-400">Warn: <span className="text-amber-600 font-semibold">{item.warning_threshold}</span></p>
                    <p className="text-[11px] text-slate-400">Crit: <span className="text-red-600 font-semibold">{item.critical_threshold}</span></p>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4 text-center">
                    <AlertBadge level={item.alert_level} />
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModal({ type: 'restock', item })}
                        title="Add stock"
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <TrendingUp size={15} />
                      </button>
                      <button
                        onClick={() => setModal({ type: 'adjust', item })}
                        title="Adjust stock level"
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      >
                        <Settings size={15} />
                      </button>
                      <button
                        onClick={() => setModal({ type: 'movements', item })}
                        title="View movement history"
                        className="p-2 text-brand-600 hover:bg-brand-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {modal?.type === 'add' && (
        <AddItemModal onClose={() => setModal(null)} />
      )}
      {(modal?.type === 'restock' || modal?.type === 'adjust') && (
        <StockModal item={modal.item} mode={modal.type} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'movements' && (
        <MovementsPanel item={modal.item} onClose={() => setModal(null)} />
      )}
    </div>
  );
};

export default Inventory;
