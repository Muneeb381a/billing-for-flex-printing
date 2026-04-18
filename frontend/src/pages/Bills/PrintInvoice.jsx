import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { formatCurrency, formatDate, PRICING_MODEL_LABELS } from '../../utils/format.js';
import * as billApi from '../../api/bills.js';

const PrintInvoice = () => {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['bill', id],
    queryFn:  () => billApi.getBill(id),
  });

  useEffect(() => {
    if (data) {
      document.title = `Invoice ${data.data.bill.bill_number}`;
    }
  }, [data]);

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>
  );

  if (!data?.data?.bill) return (
    <div className="flex items-center justify-center h-screen text-gray-400">Bill not found.</div>
  );

  const { bill, items = [], extraCharges = [], payments = [] } = data.data;
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount), 0);

  return (
    <>
      {/* Print-trigger styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow hover:bg-indigo-700"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg shadow hover:bg-gray-300"
        >
          Close
        </button>
      </div>

      {/* Invoice page */}
      <div className="max-w-3xl mx-auto my-8 bg-white shadow-lg print:shadow-none print:my-0 print:max-w-none">

        {/* Header */}
        <div className="bg-indigo-700 text-white px-8 py-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PRINTING PRESS</h1>
            <p className="text-indigo-200 text-sm mt-1">Professional Printing Services</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold">{bill.bill_number}</p>
            <p className="text-indigo-200 text-sm mt-1">INVOICE</p>
          </div>
        </div>

        {/* Bill meta */}
        <div className="px-8 py-5 grid grid-cols-2 gap-6 border-b border-gray-200">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Bill To</p>
            <p className="font-semibold text-gray-900 text-base">{bill.customer_name}</p>
            {bill.customer_phone && <p className="text-gray-500 text-sm">{bill.customer_phone}</p>}
            {bill.customer_address && <p className="text-gray-500 text-sm">{bill.customer_address}</p>}
          </div>
          <div className="text-right">
            <div className="space-y-1">
              {[
                { label: 'Date',   value: formatDate(bill.created_at) },
                ...(bill.due_date ? [{ label: 'Due Date', value: formatDate(bill.due_date) }] : []),
                { label: 'Status', value: bill.status.replace('_', ' ').toUpperCase() },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-end gap-4 text-sm">
                  <span className="text-gray-400 w-20 text-right">{label}</span>
                  <span className="font-medium text-gray-800 w-28 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="px-8 py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold w-6">#</th>
                <th className="text-left py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold">Item</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold">Qty</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold">Rate</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider text-gray-400 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) => {
                const lineTotal = parseFloat(item.item_total)
                  + parseFloat(item.design_fee || 0)
                  + parseFloat(item.urgent_fee || 0);
                return (
                  <tr key={item.id}>
                    <td className="py-3 text-gray-400">{i + 1}</td>
                    <td className="py-3">
                      <p className="font-medium text-gray-900">{item.description || item.product_name}</p>
                      <p className="text-xs text-gray-400">{PRICING_MODEL_LABELS[item.pricing_model]}</p>
                      {item.width && item.height && (
                        <p className="text-xs text-gray-400">{item.width} × {item.height} ft{item.sqft ? ` = ${item.sqft} sqft` : ''}</p>
                      )}
                      {(parseFloat(item.design_fee) > 0 || parseFloat(item.urgent_fee) > 0) && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          {parseFloat(item.design_fee) > 0 && `Design: ${formatCurrency(item.design_fee)}`}
                          {parseFloat(item.design_fee) > 0 && parseFloat(item.urgent_fee) > 0 && ' · '}
                          {parseFloat(item.urgent_fee) > 0 && `Urgent: ${formatCurrency(item.urgent_fee)}`}
                        </p>
                      )}
                    </td>
                    <td className="py-3 text-right text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Extra charges + totals */}
        <div className="px-8 pb-5 flex justify-end">
          <div className="w-72 space-y-1.5">
            {extraCharges.length > 0 && (
              <>
                <div className="flex justify-between text-sm text-gray-500 pb-1">
                  <span>Subtotal</span>
                  <span>{formatCurrency(bill.subtotal)}</span>
                </div>
                {extraCharges.map((ec) => (
                  <div key={ec.id} className="flex justify-between text-sm text-amber-700">
                    <span>{ec.label}</span>
                    <span>+ {formatCurrency(ec.amount)}</span>
                  </div>
                ))}
              </>
            )}

            {parseFloat(bill.discount_amount) > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>
                  Discount
                  {bill.discount_type === 'percentage' ? ` (${bill.discount_value}%)` : ''}
                </span>
                <span>- {formatCurrency(bill.discount_amount)}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold text-gray-900 border-t-2 border-gray-200 pt-2 mt-1">
              <span>Total</span>
              <span>{formatCurrency(bill.total_amount)}</span>
            </div>

            {totalPaid > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Paid</span>
                <span>- {formatCurrency(totalPaid)}</span>
              </div>
            )}

            <div className={`flex justify-between text-sm font-bold pt-1 ${
              parseFloat(bill.remaining_balance) > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              <span>Balance Due</span>
              <span>{formatCurrency(bill.remaining_balance)}</span>
            </div>
          </div>
        </div>

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="px-8 pb-5 border-t border-gray-100">
            <p className="text-xs uppercase tracking-widest text-gray-400 mt-4 mb-2">Payment History</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left py-1 font-medium">Date</th>
                  <th className="text-left py-1 font-medium">Method</th>
                  <th className="text-left py-1 font-medium">Reference</th>
                  <th className="text-right py-1 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-600">{formatDate(p.payment_date)}</td>
                    <td className="py-1.5 text-gray-600">{p.payment_method.replace('_', ' ').toUpperCase()}</td>
                    <td className="py-1.5 text-gray-400">{p.reference_number || '—'}</td>
                    <td className="py-1.5 text-right font-medium text-green-600">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {bill.notes && (
          <div className="px-8 pb-5 border-t border-gray-100">
            <p className="text-xs uppercase tracking-widest text-gray-400 mt-4 mb-1">Notes</p>
            <p className="text-sm text-gray-600">{bill.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Thank you for your business!</p>
        </div>
      </div>
    </>
  );
};

export default PrintInvoice;
