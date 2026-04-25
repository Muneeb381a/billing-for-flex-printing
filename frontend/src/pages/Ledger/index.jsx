import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Calendar, AlertTriangle, ChevronRight,
  TrendingDown, FileText,
} from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Modal, PageHeader } from '../../components/ui/index.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import * as api from '../../api/dashboard.js';
import cn from '../../utils/cn.js';

// ── Payment status pill ───────────────────────────────────────
const PAYMENT_STATUS = {
  paid:    { label: 'Paid',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial: { label: 'Partial', cls: 'bg-amber-50   text-amber-700   border-amber-200'  },
  unpaid:  { label: 'Unpaid',  cls: 'bg-red-50     text-red-700     border-red-200'    },
};

const PayBadge = ({ status }) => {
  const { label, cls } = PAYMENT_STATUS[status] ?? { label: status, cls: 'bg-slate-50 text-slate-500 border-slate-200' };
  return (
    <span className={cn('inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap', cls)}>
      {label}
    </span>
  );
};

// ── Summary stat card ─────────────────────────────────────────
const StatCard = ({ label, value, color = 'text-slate-900', bg = 'bg-white' }) => (
  <div className={cn('rounded-2xl border border-slate-200 shadow-sm px-5 py-4', bg)}>
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
    <p className={cn('text-2xl font-black tabular-nums leading-none', color)}>{value}</p>
  </div>
);

// ── Avatar initials ───────────────────────────────────────────
const Avatar = ({ name = '?' }) => {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-black shrink-0 select-none">
      {initials}
    </div>
  );
};

// ── Derive customer-level payment status from aggregated data ─
const custPayStatus = (cust) => {
  if (cust.total_remaining <= 0) return 'paid';
  if (cust.total_paid > 0)       return 'partial';
  return 'unpaid';
};

const custAccent = (cust) => {
  const s = custPayStatus(cust);
  if (s === 'paid')    return 'border-l-emerald-400';
  if (s === 'partial') return 'border-l-amber-400';
  return 'border-l-red-300';
};

// ── Pure grouping function — called once via useMemo ──────────
const groupByCustomer = (bills) => {
  const map = new Map();
  for (const bill of bills) {
    const key = bill.customer_id;
    if (!map.has(key)) {
      map.set(key, {
        customer_id:     key,
        customer_name:   bill.customer_name,
        phone:           bill.phone,
        bills:           [],
        total_bills:     0,
        total_amount:    0,
        total_paid:      0,
        total_remaining: 0,
      });
    }
    const g = map.get(key);
    g.bills.push(bill);
    g.total_bills++;
    g.total_amount    += parseFloat(bill.total_amount      || 0);
    g.total_paid      += parseFloat(bill.advance_paid      || 0);
    g.total_remaining += parseFloat(bill.remaining_balance || 0);
  }
  // Outstanding customers first, then alphabetical
  return Array.from(map.values()).sort(
    (a, b) => b.total_remaining - a.total_remaining || a.customer_name.localeCompare(b.customer_name),
  );
};

// ── Bill accent by payment state ──────────────────────────────
const billAccent = (bill) => {
  if (bill.payment_status === 'paid')    return 'border-l-emerald-400';
  if (bill.is_overdue)                   return 'border-l-red-500';
  if (bill.payment_status === 'partial') return 'border-l-amber-400';
  return 'border-l-red-300';
};

// ── Customer Bills Modal ──────────────────────────────────────
const CustomerBillsModal = ({ customer, onClose }) => {
  const navigate = useNavigate();

  if (!customer) return null;

  return (
    <Modal isOpen={!!customer} onClose={onClose} title={customer.customer_name} size="xl">
      {/* Mini summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total Bills',  value: customer.total_bills,                       color: 'text-slate-800' },
          { label: 'Total Amount', value: formatCurrency(customer.total_amount),       color: 'text-slate-800' },
          { label: 'Total Paid',   value: formatCurrency(customer.total_paid),         color: 'text-emerald-600' },
          {
            label: 'Outstanding',
            value: formatCurrency(customer.total_remaining),
            color: customer.total_remaining > 0 ? 'text-red-600' : 'text-emerald-600',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={cn('text-base font-black tabular-nums leading-tight', color)}>{value}</p>
          </div>
        ))}
      </div>

      {customer.phone && (
        <p className="text-xs text-slate-400 font-mono -mt-1 mb-4">{customer.phone}</p>
      )}

      {/* Bills table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50/80 border-b border-slate-100">
          <p className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bill No</p>
          <p className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
          <p className="col-span-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items</p>
          <p className="col-span-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Total</p>
          <p className="col-span-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Paid</p>
          <p className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</p>
        </div>

        <div className="divide-y divide-slate-50">
          {customer.bills.map((bill) => {
            const paid = parseFloat(bill.advance_paid || 0);

            return (
              <button
                key={bill.id}
                onClick={() => { onClose(); navigate(`/bills/${bill.id}`); }}
                className={cn(
                  'w-full grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-2 px-4 py-3',
                  'border-l-4 text-start cursor-pointer',
                  'hover:bg-slate-50 active:bg-slate-100 transition-colors group',
                  bill.is_overdue ? 'bg-red-50/20' : '',
                  billAccent(bill),
                )}
              >
                {/* Bill No */}
                <div className="sm:col-span-2 flex items-center gap-1.5">
                  {bill.is_overdue && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
                  <span className="font-mono text-sm font-bold text-brand-600 group-hover:text-brand-800 transition-colors">
                    {bill.bill_number}
                  </span>
                </div>

                {/* Date */}
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">{formatDate(bill.created_at)}</p>
                  {bill.days_outstanding > 0 && (
                    <p className="text-[10px] text-red-400 font-medium">{bill.days_outstanding}d overdue</p>
                  )}
                </div>

                {/* Items — category names from server-computed category_summary */}
                <div className="sm:col-span-4">
                  <p className="text-xs text-slate-600 truncate leading-snug" title={bill.category_summary}>
                    {bill.category_summary}
                  </p>
                  <div className="mt-0.5">
                    <StatusBadge status={bill.status} />
                  </div>
                </div>

                {/* Total */}
                <div className="sm:col-span-1 sm:text-right">
                  <p className="text-sm font-semibold text-slate-800 tabular-nums">
                    {formatCurrency(bill.total_amount)}
                  </p>
                </div>

                {/* Paid */}
                <div className="sm:col-span-1 sm:text-right">
                  <p className="text-sm font-medium text-emerald-600 tabular-nums">
                    {formatCurrency(paid)}
                  </p>
                </div>

                {/* Status + arrow */}
                <div className="sm:col-span-2 flex items-center justify-between sm:justify-center gap-2">
                  <PayBadge status={bill.payment_status} />
                  <ChevronRight size={13} className="text-slate-300 group-hover:text-brand-500 transition-colors shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
const Ledger = () => {
  const [search,           setSearch]           = useState('');
  const [statusFilter,     setStatusFilter]     = useState('');
  const [from,             setFrom]             = useState('');
  const [to,               setTo]               = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const params = {
    ...(search.trim() && { search: search.trim() }),
    ...(statusFilter  && { paymentStatus: statusFilter }),
    ...(from          && { from }),
    ...(to            && { to }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', params],
    queryFn:  () => api.getLedger(params),
    staleTime: 30_000,
  });

  const summary = data?.summary ?? {};
  const bills   = data?.data    ?? [];

  // Group bills by customer — only recomputes when bills array changes
  const customers = useMemo(() => groupByCustomer(bills), [bills]);

  const totalOutstanding = parseFloat(summary.total_outstanding || 0);
  const hasFilters = !!(search || statusFilter || from || to);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setFrom('');
    setTo('');
  };

  // Footer totals across all visible customer groups
  const footerTotal     = customers.reduce((s, c) => s + c.total_amount,    0);
  const footerPaid      = customers.reduce((s, c) => s + c.total_paid,      0);
  const footerRemaining = customers.reduce((s, c) => s + c.total_remaining, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bill Ledger"
        subtitle="Outstanding balances grouped by customer"
      />

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Billed"      value={formatCurrency(summary.total_billed)} />
        <StatCard label="Total Collected"   value={formatCurrency(summary.total_paid)}   color="text-emerald-600" />
        <StatCard
          label="Total Outstanding"
          value={formatCurrency(totalOutstanding)}
          color={totalOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'}
          bg={totalOutstanding > 0 ? 'bg-red-50' : 'bg-white'}
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill no., customer, phone…"
            className="w-full ps-9 pe-3 py-2.5 text-sm border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          {[
            ['',        'All'],
            ['unpaid',  'Unpaid'],
            ['partial', 'Partial'],
            ['paid',    'Paid'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                statusFilter === val
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
          <Calendar size={13} />
          <input
            type="date" value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
          <span className="text-slate-300">—</span>
          <input
            type="date" value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors ms-auto">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Customer list ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Column headers */}
        {!isLoading && customers.length > 0 && (
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50/80">
            <p className="col-span-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customer</p>
            <p className="col-span-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Bills</p>
            <p className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Total Amount</p>
            <p className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Paid</p>
            <p className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Outstanding</p>
            <p className="col-span-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider" />
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>

        /* Empty state */
        ) : customers.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-slate-300">
            {hasFilters ? (
              <>
                <Search size={40} strokeWidth={1.5} />
                <p className="text-sm font-semibold text-slate-400">No bills match your filters</p>
                <button onClick={clearFilters} className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <TrendingDown size={40} strokeWidth={1.5} />
                <p className="text-sm font-semibold text-slate-400">No bills found</p>
              </>
            )}
          </div>

        /* Customer rows */
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {customers.map((cust) => {
                const hasBalance = cust.total_remaining > 0;

                return (
                  <div
                    key={cust.customer_id}
                    className={cn(
                      'grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-5 py-4',
                      'border-l-4 transition-colors',
                      custAccent(cust),
                      hasBalance ? 'hover:bg-red-50/10' : 'hover:bg-slate-50',
                    )}
                  >
                    {/* Name + phone */}
                    <div className="md:col-span-3 flex items-center gap-3">
                      <Avatar name={cust.customer_name} />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 leading-tight truncate">{cust.customer_name}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{cust.phone}</p>
                      </div>
                    </div>

                    {/* Bills count badge */}
                    <div className="md:col-span-1 flex md:justify-center items-center">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                        <FileText size={10} />
                        {cust.total_bills}
                      </span>
                    </div>

                    {/* Total amount */}
                    <div className="md:col-span-2 flex md:justify-end items-center">
                      <p className="text-sm font-semibold text-slate-700 tabular-nums">
                        {formatCurrency(cust.total_amount)}
                      </p>
                    </div>

                    {/* Paid */}
                    <div className="md:col-span-2 flex md:justify-end items-center">
                      <p className="text-sm font-medium text-emerald-600 tabular-nums">
                        {formatCurrency(cust.total_paid)}
                      </p>
                    </div>

                    {/* Outstanding badge */}
                    <div className="md:col-span-2 flex md:justify-end items-center">
                      {hasBalance ? (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 tabular-nums">
                          {formatCurrency(cust.total_remaining)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Cleared
                        </span>
                      )}
                    </div>

                    {/* View Bills button */}
                    <div className="md:col-span-2 flex items-center justify-end">
                      <button
                        onClick={() => setSelectedCustomer(cust)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View Bills <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer totals */}
            <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3.5 border-t-2 border-slate-200 bg-slate-50">
              <p className="col-span-4 text-xs font-semibold text-slate-500">
                {customers.length} customer{customers.length !== 1 ? 's' : ''} shown
                {hasFilters && ' (filtered)'}
              </p>
              <p className="col-span-2 text-right text-sm font-bold text-slate-800 tabular-nums">
                {formatCurrency(footerTotal)}
              </p>
              <p className="col-span-2 text-right text-sm font-bold text-emerald-600 tabular-nums">
                {formatCurrency(footerPaid)}
              </p>
              <p className="col-span-2 text-right text-sm font-bold text-red-600 tabular-nums">
                {formatCurrency(footerRemaining)}
              </p>
              <p className="col-span-2" />
            </div>
          </>
        )}
      </div>

      {/* ── Customer Bills Modal ── */}
      <CustomerBillsModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
    </div>
  );
};

export default Ledger;
