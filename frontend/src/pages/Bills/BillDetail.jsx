import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Printer, Plus, CreditCard, RefreshCw, Truck, AlertTriangle, MessageCircle,
} from 'lucide-react';
import {
  PageSpinner, Card, CardHeader, Table, Button, Select,
} from '../../components/ui/index.js';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { formatCurrency, formatDate, formatDateTime, PRICING_MODEL_LABELS } from '../../utils/format.js';
import * as billApi from '../../api/bills.js';
import AddPaymentModal  from './AddPaymentModal.jsx';
import WhatsAppModal   from './WhatsAppModal.jsx';

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending'      },
  { value: 'in_progress', label: 'In Progress'  },
  { value: 'completed',   label: 'Completed'    },
  { value: 'delivered',   label: 'Delivered'    },
  { value: 'cancelled',   label: 'Cancelled'    },
];

const BillDetail = () => {
  const { id }   = useParams();
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [payModal, setPayModal] = useState(false);
  const [waModal,  setWaModal]  = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['bill', id],
    queryFn:  () => billApi.getBill(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bill', id] });
    qc.invalidateQueries({ queryKey: ['bills'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status) => billApi.updateStatus(id, status),
    onSuccess:  () => { invalidate(); toast.success('Status updated'); },
  });

  const deliverMutation = useMutation({
    mutationFn: () => billApi.markDelivered(id),
    onSuccess:  () => { invalidate(); toast.success('Marked as delivered'); },
  });

  if (isLoading) return <PageSpinner />;
  if (!data?.data?.bill) return (
    <div className="text-center py-16 text-gray-400">
      <p>Bill not found.</p>
      <Button variant="ghost" className="mt-4" onClick={() => navigate('/bills')}>Go back</Button>
    </div>
  );

  const { bill, items = [], extraCharges = [], payments = [] } = data.data;
  const totalPaid   = payments.reduce((s, p) => s + parseFloat(p.amount), 0);
  const canDeliver  = !['delivered', 'cancelled'].includes(bill.status);
  const canAddPayment = parseFloat(bill.remaining_balance) > 0 && bill.status !== 'cancelled';
  const isOverdue   = bill.due_date
    && new Date(bill.due_date) < new Date()
    && !['delivered', 'cancelled'].includes(bill.status);

  // ── Item columns ──────────────────────────────────────────
  const itemCols = [
    {
      key: 'product_name', header: 'Item',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.description || row.product_name}</p>
          <p className="text-xs text-gray-400">{PRICING_MODEL_LABELS[row.pricing_model]}</p>
          {row.sqft    && <p className="text-xs text-gray-400">{row.sqft} sqft</p>}
          {row.item_notes && (
            <p className="text-xs text-amber-600 mt-0.5 italic">↳ {row.item_notes}</p>
          )}
        </div>
      ),
    },
    {
      key: 'quantity', header: 'Qty',
      render: (row) => (
        <div className="text-sm">
          <span>{row.quantity}</span>
          {row.width && row.height && (
            <p className="text-xs text-gray-400">{row.width} × {row.height} ft</p>
          )}
        </div>
      ),
    },
    {
      key: 'unit_price', header: 'Rate',
      render: (row) => formatCurrency(row.unit_price),
    },
    {
      key: 'item_total', header: 'Item Total',
      render: (row) => <span className="font-semibold">{formatCurrency(row.item_total)}</span>,
    },
    {
      key: 'surcharges', header: 'Surcharges',
      render: (row) => {
        const df = parseFloat(row.design_fee || 0);
        const uf = parseFloat(row.urgent_fee || 0);
        if (!df && !uf) return <span className="text-gray-300">—</span>;
        return (
          <div className="text-xs text-amber-600">
            {df > 0 && <div>Design: {formatCurrency(df)}</div>}
            {uf > 0 && <div>Urgent: {formatCurrency(uf)}</div>}
          </div>
        );
      },
    },
    {
      key: 'line_total', header: 'Line Total',
      render: (row) => {
        const total = parseFloat(row.item_total)
          + parseFloat(row.design_fee || 0)
          + parseFloat(row.urgent_fee || 0);
        return <span className="font-bold text-indigo-700">{formatCurrency(total)}</span>;
      },
    },
  ];

  // ── Payment columns ───────────────────────────────────────
  const payCols = [
    { key: 'payment_date',    header: 'Date',      render: (r) => formatDateTime(r.payment_date) },
    { key: 'amount',          header: 'Amount',    render: (r) => <span className="font-semibold text-green-600">{formatCurrency(r.amount)}</span> },
    { key: 'payment_method',  header: 'Method',    render: (r) => r.payment_method.replace('_', ' ').toUpperCase() },
    { key: 'reference_number',header: 'Reference', render: (r) => r.reference_number || '—' },
    { key: 'notes',           header: 'Notes',     render: (r) => r.notes || '—' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ── Overdue banner ── */}
      {isOverdue && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="text-sm font-medium">
            This bill was due on {formatDate(bill.due_date)} and has not been delivered yet.
          </span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => navigate('/bills')}>
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{bill.bill_number}</h1>
            <StatusBadge status={bill.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {bill.customer_name} · {bill.customer_phone}
            {bill.customer_address && ` · ${bill.customer_address}`}
          </p>
          <div className="flex items-center gap-4 mt-0.5">
            <p className="text-xs text-gray-400">Created {formatDateTime(bill.created_at)}</p>
            {bill.delivered_at && (
              <p className="text-xs text-green-600 font-medium">
                ✓ Delivered {formatDateTime(bill.delivered_at)}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            variant="secondary" size="sm"
            icon={<Printer size={14} />}
            onClick={() => window.open(`/bills/${id}/print`, '_blank')}
          >
            Print
          </Button>
          <button
            type="button"
            onClick={() => setWaModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#1ebe5d] active:bg-[#17a852] shadow-sm hover:shadow-md hover:shadow-[#25D366]/25 transition-all duration-150 cursor-pointer"
          >
            <MessageCircle size={13} />
            WhatsApp
          </button>
          {canAddPayment && (
            <Button size="sm" icon={<CreditCard size={14} />} onClick={() => setPayModal(true)}>
              Add Payment
            </Button>
          )}
          {canDeliver && (
            <Button
              size="sm"
              icon={<Truck size={14} />}
              loading={deliverMutation.isPending}
              onClick={() => deliverMutation.mutate()}
              className="bg-green-600 hover:bg-green-700 text-white border-transparent"
            >
              Mark Delivered
            </Button>
          )}
        </div>
      </div>

      {/* ── Status + due date row ── */}
      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <RefreshCw size={14} />
            <span>Status</span>
          </div>
          <Select
            options={STATUS_OPTIONS}
            value={bill.status}
            onChange={(e) => statusMutation.mutate(e.target.value)}
            className="w-44"
          />
          {statusMutation.isPending && (
            <span className="text-xs text-gray-400">Saving…</span>
          )}
          {bill.due_date && (
            <div className={`ml-auto text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
              Due: <span className="font-medium">{formatDate(bill.due_date)}</span>
              {isOverdue && ' — OVERDUE'}
            </div>
          )}
        </div>

        {bill.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Notes</p>
            <p className="text-sm text-gray-700 mt-1">{bill.notes}</p>
          </div>
        )}
      </Card>

      {/* ── Items ── */}
      <Card padding={false}>
        <div className="px-5 pt-5 pb-3">
          <CardHeader
            title="Bill Items"
            subtitle={`${items.length} item${items.length !== 1 ? 's' : ''}`}
          />
        </div>
        <Table columns={itemCols} data={items} emptyMessage="No items" />
      </Card>

      {/* ── Financials ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Totals */}
        <Card>
          <CardHeader title="Financial Summary" />
          <div className="space-y-2 text-sm">
            {[
              { label: 'Subtotal',     value: formatCurrency(bill.subtotal),          color: '' },
              ...(parseFloat(bill.discount_amount) > 0 ? [{
                label: `Discount (${bill.discount_type === 'percentage' ? `${bill.discount_value}%` : 'fixed'})`,
                value: `- ${formatCurrency(bill.discount_amount)}`,
                color: 'text-green-600',
              }] : []),
              ...(extraCharges.length > 0 ? [{
                label: `Extra Charges (${extraCharges.length})`,
                value: `+ ${formatCurrency(bill.extra_charges)}`,
                color: 'text-amber-600',
              }] : []),
              { label: 'Total Amount', value: formatCurrency(bill.total_amount),      color: 'font-bold' },
              { label: 'Total Paid',   value: formatCurrency(totalPaid),              color: 'text-green-600' },
              {
                label: 'Remaining',
                value: formatCurrency(bill.remaining_balance),
                color: parseFloat(bill.remaining_balance) > 0
                  ? 'text-red-600 font-bold'
                  : 'text-green-600 font-bold',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-500">{label}</span>
                <span className={color}>{value}</span>
              </div>
            ))}
          </div>

          {extraCharges.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Extra Charges</p>
              {extraCharges.map((ec) => (
                <div key={ec.id} className="flex justify-between text-sm text-gray-600 py-0.5">
                  <span>{ec.label}</span>
                  <span className="font-medium">{formatCurrency(ec.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Payments */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <CardHeader
              title="Payment History"
              subtitle={`${payments.length} payment${payments.length !== 1 ? 's' : ''} · ${formatCurrency(totalPaid)} received`}
            />
            {canAddPayment && (
              <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => setPayModal(true)}>
                Pay
              </Button>
            )}
          </div>
          {payments.length > 0 ? (
            <Table columns={payCols} data={payments} />
          ) : (
            <div className="px-5 pb-5 text-center text-gray-400 text-sm py-6">
              {bill.status === 'cancelled'
                ? 'Bill cancelled — no payments'
                : 'No payments recorded yet'}
            </div>
          )}
        </Card>
      </div>

      <AddPaymentModal
        isOpen={payModal}
        onClose={() => setPayModal(false)}
        bill={bill}
      />

      <WhatsAppModal
        isOpen={waModal}
        onClose={() => setWaModal(false)}
        bill={bill}
        billId={id}
      />
    </div>
  );
};

export default BillDetail;
