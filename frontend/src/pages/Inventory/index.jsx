import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Package, Plus, TrendingUp, TrendingDown, AlertTriangle,
  AlertCircle, CheckCircle, RefreshCw, Settings, X, ChevronRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as invAPI from '../../api/inventory.js';
import { formatDate } from '../../utils/format.js';

// ── Alert badge ───────────────────────────────────────────────
const AlertBadge = ({ level }) => {
  if (level === 'critical') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <AlertCircle size={11} /> Critical
    </span>
  );
  if (level === 'warning') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <AlertTriangle size={11} /> Warning
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      <CheckCircle size={11} /> OK
    </span>
  );
};

// ── Stock progress bar ────────────────────────────────────────
const StockBar = ({ current, warning, critical }) => {
  const max   = warning * 2;
  const pct   = Math.min(100, (current / max) * 100);
  const color = current <= critical ? 'bg-red-500' : current <= warning ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">
            {mode === 'restock' ? 'Add Stock' : 'Adjust Stock'} — {item.name}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Current: <span className="font-semibold text-gray-800">{item.current_stock} {item.unit}</span>
        </p>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {mode === 'restock' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to add</label>
              <input
                {...register('quantity', { required: true, min: 0.001 })}
                type="number" step="any" min="0.001"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={`Amount in ${item.unit}`}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New stock level</label>
              <input
                {...register('newStock', { required: true, min: 0 })}
                type="number" step="any" min="0"
                defaultValue={item.current_stock}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              {...register('notes')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Supplier, reason..."
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : mode === 'restock' ? 'Add Stock' : 'Set Stock'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Add Item modal ────────────────────────────────────────────
const AddItemModal = ({ onClose }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { unit: 'pcs', warningThreshold: 150, criticalThreshold: 50, reorderPoint: 0 }
  });

  const mutation = useMutation({
    mutationFn: invAPI.createItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Item created!');
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-900">New Inventory Item</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input {...register('name', { required: true })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Art Card 350gsm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select {...register('unit')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {['pcs','sqft','sheet','roll','kg','set','litre'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock</label>
              <input {...register('currentStock')} type="number" step="any" min="0"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warning at</label>
              <input {...register('warningThreshold')} type="number" min="0"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Critical at</label>
              <input {...register('criticalThreshold')} type="number" min="0"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost/unit (PKR)</label>
              <input {...register('costPerUnit')} type="number" step="any" min="0"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input {...register('supplierName')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional" />
            </div>
          </div>

          <button type="submit" disabled={mutation.isPending}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {mutation.isPending ? 'Creating…' : 'Create Item'}
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
    queryFn: () => invAPI.getMovements(item.id, { limit: 100 }),
  });

  const movements = data?.data?.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">{item.name}</h3>
            <p className="text-xs text-gray-400">Stock movement history</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : movements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No movements yet</p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    m.movement_type === 'IN'     ? 'bg-green-100 text-green-600' :
                    m.movement_type === 'OUT'    ? 'bg-red-100 text-red-600' :
                                                   'bg-gray-100 text-gray-500'
                  }`}>
                    {m.movement_type === 'IN' ? <TrendingUp size={13} /> : m.movement_type === 'OUT' ? <TrendingDown size={13} /> : <RefreshCw size={13} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${
                        m.movement_type === 'IN' ? 'text-green-700' : m.movement_type === 'OUT' ? 'text-red-700' : 'text-gray-700'
                      }`}>
                        {m.movement_type === 'IN' ? '+' : m.movement_type === 'OUT' ? '−' : '±'}{m.quantity} {item.unit}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(m.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {m.reference_type && <span className="font-medium">{m.reference_type}</span>}
                      {m.notes && ` — ${m.notes}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────
const Inventory = () => {
  const [modal, setModal]         = useState(null); // { type: 'restock'|'adjust'|'movements'|'add', item? }
  const [filter, setFilter]       = useState('all'); // all | warning | critical

  const { data, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => invAPI.getItems(),
    refetchInterval: 60_000,
  });

  const items = data?.data?.data || [];

  const displayed = items.filter(item => {
    if (filter === 'critical') return item.alert_level === 'critical';
    if (filter === 'warning')  return item.alert_level !== 'ok';
    return true;
  });

  const criticalCount = items.filter(i => i.alert_level === 'critical').length;
  const warningCount  = items.filter(i => i.alert_level === 'warning').length;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={() => setModal({ type: 'add' })}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> Add Item
        </button>
      </div>

      {/* Alert summary */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className="flex gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-2.5 rounded-xl">
              <AlertCircle size={15} />
              {criticalCount} item{criticalCount > 1 ? 's' : ''} critically low — restock now
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2.5 rounded-xl">
              <AlertTriangle size={15} />
              {warningCount} item{warningCount > 1 ? 's' : ''} below warning level
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['all','All Items'],['warning','Low Stock'],['critical','Critical']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Items table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {filter === 'all' ? 'No inventory items yet — add one to get started' : 'No items in this category'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Item</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Stock</th>
                <th className="hidden sm:table-cell text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Thresholds</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800">{item.name}</p>
                    {item.supplier_name && <p className="text-xs text-gray-400 mt-0.5">{item.supplier_name}</p>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-bold text-gray-900">{parseFloat(item.current_stock).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{item.unit}</p>
                    <div className="mt-1.5 w-24 ml-auto">
                      <StockBar
                        current={parseFloat(item.current_stock)}
                        warning={parseFloat(item.warning_threshold)}
                        critical={parseFloat(item.critical_threshold)}
                      />
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-4 text-right">
                    <p className="text-xs text-gray-500">Warn: {item.warning_threshold}</p>
                    <p className="text-xs text-gray-500">Crit: {item.critical_threshold}</p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <AlertBadge level={item.alert_level} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModal({ type: 'restock', item })}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Add stock"
                      >
                        <TrendingUp size={15} />
                      </button>
                      <button
                        onClick={() => setModal({ type: 'adjust', item })}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Adjust stock"
                      >
                        <Settings size={15} />
                      </button>
                      <button
                        onClick={() => setModal({ type: 'movements', item })}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Movement history"
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

      {/* Modals */}
      {modal?.type === 'add' && <AddItemModal onClose={() => setModal(null)} />}
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
