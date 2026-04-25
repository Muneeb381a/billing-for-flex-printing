import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus, Search, FileText, Pencil, Trash2,
  ChevronRight, Users, AlertCircle,
} from 'lucide-react';
import {
  PageHeader, Modal, ConfirmDialog, Button, Input,
} from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import useDebounce from '../../hooks/useDebounce.js';
import * as api from '../../api/customers.js';
import CustomerForm from './CustomerForm.jsx';
import cn from '../../utils/cn.js';

// ── Avatar initials ───────────────────────────────────────────
const Avatar = ({ name }) => {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-black shrink-0 select-none">
      {initials}
    </div>
  );
};

// ── Outstanding badge ─────────────────────────────────────────
const OutstandingBadge = ({ amount }) => {
  const n = parseFloat(amount || 0);
  if (n <= 0) return (
    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
      Cleared
    </span>
  );
  return (
    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 tabular-nums">
      {formatCurrency(n)}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
const Customers = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter,   setFilter]   = useState(''); // '' | 'outstanding' | 'cleared'

  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch],
    queryFn:  () => api.getCustomers({ search: debouncedSearch, limit: 200 }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCustomer(selected.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
      closeModal();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to delete'),
  });

  const closeModal = () => { setModal(null); setSelected(null); };

  const all = data?.data || [];

  // Client-side outstanding/cleared filter
  const customers = filter === 'outstanding'
    ? all.filter((c) => parseFloat(c.outstanding_balance || 0) > 0)
    : filter === 'cleared'
    ? all.filter((c) => parseFloat(c.outstanding_balance || 0) <= 0)
    : all;

  // Summary totals
  const totalBilled      = all.reduce((s, c) => s + parseFloat(c.total_billed      || 0), 0);
  const totalPaid        = all.reduce((s, c) => s + parseFloat(c.total_paid        || 0), 0);
  const totalOutstanding = all.reduce((s, c) => s + parseFloat(c.outstanding_balance || 0), 0);
  const outstandingCount = all.filter((c) => parseFloat(c.outstanding_balance || 0) > 0).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle={`${all.length} customer${all.length !== 1 ? 's' : ''}`}
        action={
          <Button icon={<Plus size={16} />} onClick={() => setModal('add')}>
            Add Customer
          </Button>
        }
      />

      {/* ── Summary Cards ── */}
      {all.length > 0 && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Customers',
              value: all.length,
              sub:   `${outstandingCount} with balance`,
              icon:  Users,
              color: 'text-brand-700',
              bg:    'bg-brand-50',
              iconColor: 'text-brand-600',
            },
            {
              label: 'Total Business',
              value: formatCurrency(totalBilled),
              sub:   'All time',
              icon:  FileText,
              color: 'text-slate-900',
              bg:    'bg-slate-50',
              iconColor: 'text-slate-500',
            },
            {
              label: 'Total Collected',
              value: formatCurrency(totalPaid),
              sub:   'Payments received',
              icon:  FileText,
              color: 'text-emerald-700',
              bg:    'bg-emerald-50',
              iconColor: 'text-emerald-600',
            },
            {
              label: 'Outstanding',
              value: formatCurrency(totalOutstanding),
              sub:   `${outstandingCount} customer${outstandingCount !== 1 ? 's' : ''} pending`,
              icon:  AlertCircle,
              color: totalOutstanding > 0 ? 'text-red-700' : 'text-emerald-700',
              bg:    totalOutstanding > 0 ? 'bg-red-50'    : 'bg-emerald-50',
              iconColor: totalOutstanding > 0 ? 'text-red-500' : 'text-emerald-500',
            },
          ].map(({ label, value, sub, icon: Icon, color, bg, iconColor }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-4 flex items-start gap-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', bg)}>
                <Icon size={16} className={iconColor} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className={cn('text-xl font-black leading-tight tabular-nums', color)}>{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Search + Filter bar ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full ps-9 pe-3 py-2.5 text-sm border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all bg-white"
          />
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          {[
            ['',            'All'],
            ['outstanding', 'Outstanding'],
            ['cleared',     'Cleared'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                filter === val
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Customer list ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Column headers */}
        {!isLoading && customers.length > 0 && (
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/80">
            <p className="col-span-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customer</p>
            <p className="col-span-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Bills</p>
            <p className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Total Business</p>
            <p className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Paid</p>
            <p className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Outstanding</p>
            <p className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider" />
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>

        /* Empty */
        ) : customers.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-slate-300">
            <Users size={40} strokeWidth={1.5} />
            <p className="text-sm font-semibold text-slate-400">
              {search || filter ? 'No customers match your search' : 'No customers yet — add your first one'}
            </p>
          </div>

        /* Rows */
        ) : (
          <div className="divide-y divide-slate-50">
            {customers.map((c) => {
              const outstanding = parseFloat(c.outstanding_balance || 0);
              const totalBills  = parseInt(c.total_bills || 0, 10);
              const hasBalance  = outstanding > 0;

              return (
                <div
                  key={c.id}
                  className={cn(
                    'grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-5 py-4',
                    'border-l-4 transition-colors',
                    hasBalance ? 'border-l-red-300 hover:bg-red-50/10' : 'border-l-emerald-300 hover:bg-slate-50',
                  )}
                >
                  {/* Customer name + phone */}
                  <div className="md:col-span-3 flex items-center gap-3">
                    <Avatar name={c.name} />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 leading-tight truncate">{c.name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{c.phone}</p>
                    </div>
                  </div>

                  {/* Bills count */}
                  <div className="md:col-span-1 flex md:justify-center items-center">
                    {totalBills > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                        <FileText size={10} />
                        {totalBills}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Total billed */}
                  <div className="md:col-span-2 flex md:justify-end items-center">
                    <p className="text-sm font-semibold text-slate-700 tabular-nums">
                      {totalBills > 0 ? formatCurrency(c.total_billed) : <span className="text-slate-300">—</span>}
                    </p>
                  </div>

                  {/* Paid */}
                  <div className="md:col-span-2 flex md:justify-end items-center">
                    <p className="text-sm font-medium text-emerald-600 tabular-nums">
                      {totalBills > 0 ? formatCurrency(c.total_paid) : <span className="text-slate-300">—</span>}
                    </p>
                  </div>

                  {/* Outstanding */}
                  <div className="md:col-span-2 flex md:justify-end items-center">
                    <OutstandingBadge amount={outstanding} />
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={() => navigate(`/customers/${c.id}/ledger`)}
                      title="View bills & ledger"
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Bills <ChevronRight size={12} />
                    </button>
                    <button
                      onClick={() => { setSelected(c); setModal('edit'); }}
                      title="Edit"
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { setSelected(c); setModal('delete'); }}
                      title="Delete"
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer totals (when filtered) */}
        {!isLoading && customers.length > 0 && filter && (
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-t-2 border-slate-200 bg-slate-50">
            <p className="col-span-4 text-xs font-semibold text-slate-500">
              {customers.length} customer{customers.length !== 1 ? 's' : ''} shown
            </p>
            <p className="col-span-2 text-right text-sm font-bold text-slate-800 tabular-nums">
              {formatCurrency(customers.reduce((s, c) => s + parseFloat(c.total_billed || 0), 0))}
            </p>
            <p className="col-span-2 text-right text-sm font-bold text-emerald-600 tabular-nums">
              {formatCurrency(customers.reduce((s, c) => s + parseFloat(c.total_paid || 0), 0))}
            </p>
            <p className="col-span-2 text-right text-sm font-bold text-red-600 tabular-nums">
              {formatCurrency(customers.reduce((s, c) => s + parseFloat(c.outstanding_balance || 0), 0))}
            </p>
            <p className="col-span-2" />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <Modal isOpen={modal === 'add'} onClose={closeModal} title="Add Customer">
        <CustomerForm onSuccess={(c) => { qc.invalidateQueries({ queryKey: ['customers'] }); closeModal(); toast.success(`${c.name} added`); }} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Customer">
        <CustomerForm customer={selected} onSuccess={() => { qc.invalidateQueries({ queryKey: ['customers'] }); closeModal(); toast.success('Customer updated'); }} />
      </Modal>

      <ConfirmDialog
        isOpen={modal === 'delete'}
        onClose={closeModal}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title={`Delete ${selected?.name}?`}
        message="All bills linked to this customer will be affected. This cannot be undone."
      />
    </div>
  );
};

export default Customers;
