import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  ArrowLeft, AlertTriangle, CheckCircle, Clock, CreditCard,
  ChevronDown, ChevronUp, Plus, ExternalLink, Calendar,
  Phone, MapPin, TrendingDown,
} from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { formatCurrency, formatDate } from '../../utils/format.js';
import * as ledgerAPI from '../../api/ledger.js';

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub, color = 'text-gray-900', bg = 'bg-white' }) => (
  <div className={`${bg} rounded-2xl border border-gray-100 shadow-sm px-5 py-4`}>
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

// ── Payment status pill ───────────────────────────────────────
const PaymentBadge = ({ status }) => {
  const map = {
    paid:    { label: 'Paid',    cls: 'bg-green-50  text-green-700  border-green-200'  },
    partial: { label: 'Partial', cls: 'bg-amber-50  text-amber-700  border-amber-200'  },
    unpaid:  { label: 'Unpaid',  cls: 'bg-red-50    text-red-700    border-red-200'    },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
};

// ── Record Payment modal ──────────────────────────────────────
const RecordPaymentModal = ({ bill, customerId, onClose, onSuccess }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { paymentMethod: 'cash' },
  });

  const mutation = useMutation({
    mutationFn: (data) => ledgerAPI.recordPayment({
      billId:          bill.id,
      customerId:      Number(customerId),
      amount:          parseFloat(data.amount),
      paymentMethod:   data.paymentMethod,
      referenceNumber: data.referenceNumber || undefined,
      notes:           data.notes || undefined,
    }),
    onSuccess: (res) => {
      toast.success('Payment recorded');
      onSuccess(res.data);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to record payment'),
  });

  const remaining = parseFloat(bill.remaining_balance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Record Payment</h3>
              <p className="text-xs text-gray-400 mt-0.5">Bill {bill.bill_number}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
        </div>

        {/* Bill snapshot */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex justify-between text-sm">
          <span className="text-gray-500">Products</span>
          <span className="font-medium text-gray-800 text-right max-w-48 truncate">{bill.product_summary}</span>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex justify-between text-sm">
          <span className="text-gray-500">Remaining balance</span>
          <span className="font-bold text-red-600">{formatCurrency(remaining)}</span>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              {...register('amount', {
                required: 'Amount is required',
                min: { value: 1, message: 'Must be greater than 0' },
                max: { value: remaining, message: `Cannot exceed balance (${formatCurrency(remaining)})` },
              })}
              type="number" step="any" min="1" max={remaining}
              placeholder={remaining.toFixed(0)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              {...register('paymentMethod')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference # (optional)</label>
            <input
              {...register('referenceNumber')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Cheque no. / transaction ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              {...register('notes')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Any remarks"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
              {mutation.isPending ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Expandable payment history row ────────────────────────────
const BillRow = ({ bill, customerId, onPaymentAdded }) => {
  const [expanded,       setExpanded]       = useState(false);
  const [paymentModal,   setPaymentModal]   = useState(false);

  const remaining    = parseFloat(bill.remaining_balance);
  const totalAmount  = parseFloat(bill.total_amount);
  const totalPaid    = parseFloat(bill.total_paid);
  const payments     = bill.payments ?? [];

  return (
    <>
      <tr
        className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
          bill.is_overdue ? 'bg-red-50/40' : ''
        }`}
      >
        {/* Bill # */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {bill.is_overdue && (
              <AlertTriangle size={13} className="text-red-500 shrink-0" title="Overdue" />
            )}
            <Link
              to={`/bills/${bill.id}`}
              className="font-mono text-sm font-semibold text-indigo-600 hover:underline flex items-center gap-1"
            >
              {bill.bill_number}
              <ExternalLink size={10} />
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(bill.created_at)}</p>
        </td>

        {/* Products */}
        <td className="px-4 py-3">
          <p className="text-sm text-gray-700 max-w-40 truncate" title={bill.product_summary}>
            {bill.product_summary}
          </p>
          <StatusBadge status={bill.status} className="mt-0.5" />
        </td>

        {/* Total */}
        <td className="px-4 py-3 text-right">
          <p className="text-sm font-medium text-gray-800">{formatCurrency(totalAmount)}</p>
          {bill.due_date && (
            <p className={`text-xs mt-0.5 flex items-center justify-end gap-1 ${
              bill.is_overdue ? 'text-red-500 font-medium' : 'text-gray-400'
            }`}>
              <Calendar size={10} />
              {formatDate(bill.due_date)}
            </p>
          )}
        </td>

        {/* Paid */}
        <td className="px-4 py-3 text-right">
          <p className="text-sm font-medium text-green-600">{formatCurrency(totalPaid)}</p>
        </td>

        {/* Remaining */}
        <td className="px-4 py-3 text-right">
          <p className={`text-sm font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {remaining > 0 ? formatCurrency(remaining) : '✓ Paid'}
          </p>
          {bill.days_outstanding > 0 && (
            <p className="text-xs text-red-400 mt-0.5">{bill.days_outstanding}d old</p>
          )}
        </td>

        {/* Payment status */}
        <td className="px-4 py-3 text-center">
          <PaymentBadge status={bill.payment_status} />
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            {remaining > 0 && (
              <button
                onClick={() => setPaymentModal(true)}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={11} /> Pay
              </button>
            )}
            {payments.length > 0 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title={expanded ? 'Collapse payments' : `${payments.length} payment(s)`}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded payment history */}
      {expanded && payments.length > 0 && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={7} className="px-8 py-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Payment History
              </p>
              {payments.map((pmt) => (
                <div key={pmt.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 text-gray-600">
                    <CreditCard size={12} className="text-gray-400" />
                    <span className="capitalize">{pmt.payment_method.replace('_', ' ')}</span>
                    {pmt.reference_number && (
                      <span className="text-gray-400 font-mono">#{pmt.reference_number}</span>
                    )}
                    {pmt.notes && <span className="text-gray-400 italic">{pmt.notes}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400">{formatDate(pmt.payment_date)}</span>
                    <span className="font-semibold text-green-600">{formatCurrency(pmt.amount)}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <span className="text-xs font-bold text-gray-600">
                  Total paid: {formatCurrency(totalPaid)}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Payment modal */}
      {paymentModal && (
        <RecordPaymentModal
          bill={bill}
          customerId={customerId}
          onClose={() => setPaymentModal(false)}
          onSuccess={() => { setPaymentModal(false); onPaymentAdded(); }}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

const CustomerLedger = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const qc         = useQueryClient();

  // ── Filters ───────────────────────────────────────────────
  const [paymentStatus, setPaymentStatus] = useState('');
  const [from,          setFrom]          = useState('');
  const [to,            setTo]            = useState('');
  const [overdueOnly,   setOverdueOnly]   = useState(false);

  // ── Data ──────────────────────────────────────────────────
  const params = {
    ...(paymentStatus && { paymentStatus }),
    ...(from          && { from }),
    ...(to            && { to }),
    ...(overdueOnly   && { overdueOnly: 'true' }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['customer-ledger-page', id, params],
    queryFn:  () => ledgerAPI.getCustomerLedger(id, params),
  });

  const ledger   = data?.data;
  const customer = ledger?.customer;
  const summary  = ledger?.summary;
  const bills    = ledger?.bills ?? [];

  // ── Derived stats for tab counts ─────────────────────────
  const statusCounts = useMemo(() => {
    const all = bills;
    return {
      all:     all.length,
      unpaid:  all.filter((b) => b.payment_status === 'unpaid').length,
      partial: all.filter((b) => b.payment_status === 'partial').length,
      paid:    all.filter((b) => b.payment_status === 'paid').length,
    };
  }, [bills]);

  const overdueCount = useMemo(() => bills.filter((b) => b.is_overdue).length, [bills]);

  const onPaymentAdded = () => {
    qc.invalidateQueries({ queryKey: ['customer-ledger-page', id] });
    qc.invalidateQueries({ queryKey: ['ledger'] });
    qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  // ── Loading skeleton ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-16 bg-gray-100 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-medium">Customer not found</p>
        <button onClick={() => navigate('/customers')} className="mt-4 text-indigo-600 text-sm hover:underline">
          ← Back to Customers
        </button>
      </div>
    );
  }

  const outstanding = parseFloat(summary?.outstanding_balance ?? 0);

  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Back + Customer Header ── */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/customers')}
          className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
          <div className="flex flex-wrap gap-3 mt-1">
            {customer.phone && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Phone size={11} /> {customer.phone}
              </span>
            )}
            {customer.address && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin size={11} /> {customer.address}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} /> Customer since {formatDate(customer.created_at)}
            </span>
          </div>
        </div>
        <Link
          to={`/bills/new`}
          state={{ customerId: customer.id }}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> New Bill
        </Link>
      </div>

      {/* ── Overdue alert banner ── */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{overdueCount} overdue bill{overdueCount > 1 ? 's' : ''}</span>
            {' '}— {formatCurrency(
              bills.filter((b) => b.is_overdue).reduce((s, b) => s + parseFloat(b.remaining_balance), 0)
            )} past due
          </p>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Orders"
          value={summary?.total_bills ?? 0}
          sub={`${statusCounts.unpaid} unpaid · ${statusCounts.partial} partial`}
        />
        <SummaryCard
          label="Total Billed"
          value={formatCurrency(summary?.total_billed ?? 0)}
          sub="All time"
        />
        <SummaryCard
          label="Total Paid"
          value={formatCurrency(summary?.total_paid ?? 0)}
          color="text-green-600"
          sub="Across all bills"
        />
        <SummaryCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          color={outstanding > 0 ? 'text-red-600' : 'text-green-600'}
          sub={outstanding > 0 ? `${overdueCount} overdue` : 'Fully cleared'}
          bg={outstanding > 0 ? 'bg-red-50' : 'bg-white'}
        />
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center">

        {/* Payment status tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[
            ['', 'All'],
            ['unpaid',  'Unpaid'],
            ['partial', 'Partial'],
            ['paid',    'Paid'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPaymentStatus(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                paymentStatus === val
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar size={13} />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span>to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Overdue toggle */}
        <button
          onClick={() => setOverdueOnly((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
            overdueOnly
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          <AlertTriangle size={12} />
          Overdue only
        </button>

        {/* Clear filters */}
        {(paymentStatus || from || to || overdueOnly) && (
          <button
            onClick={() => { setPaymentStatus(''); setFrom(''); setTo(''); setOverdueOnly(false); }}
            className="text-xs text-indigo-600 hover:underline ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Bills table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {bills.length === 0 ? (
          <div className="py-16 text-center">
            {paymentStatus || from || to || overdueOnly ? (
              <>
                <CheckCircle size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No bills match the current filters</p>
                <button
                  onClick={() => { setPaymentStatus(''); setFrom(''); setTo(''); setOverdueOnly(false); }}
                  className="mt-2 text-xs text-indigo-600 hover:underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <TrendingDown size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No bills yet for this customer</p>
              </>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bill</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Products</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Paid</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <BillRow
                  key={bill.id}
                  bill={bill}
                  customerId={id}
                  onPaymentAdded={onPaymentAdded}
                />
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-500">
                  {bills.length} bill{bills.length !== 1 ? 's' : ''} shown
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-800">
                  {formatCurrency(bills.reduce((s, b) => s + parseFloat(b.total_amount), 0))}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                  {formatCurrency(bills.reduce((s, b) => s + parseFloat(b.total_paid), 0))}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                  {formatCurrency(bills.reduce((s, b) => s + parseFloat(b.remaining_balance), 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

    </div>
  );
};

export default CustomerLedger;
