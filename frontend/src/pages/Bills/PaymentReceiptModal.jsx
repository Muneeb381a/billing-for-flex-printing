import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, formatDateTime } from '../../utils/format.js';
import * as settingsAPI from '../../api/settings.js';

// ── Print-only styles injected once ───────────────────────────
const PRINT_STYLE = `
  @media print {
    body > *:not(#receipt-print-root) { display: none !important; }
    #receipt-print-root { display: block !important; position: static !important; }
    .no-print { display: none !important; }
  }
`;

const METHOD_LABEL = {
  cash:          'Cash',
  bank_transfer: 'Bank Transfer',
  cheque:        'Cheque',
  online:        'Online',
};

const PaymentReceiptModal = ({ payment, bill, onClose }) => {
  const printRef = useRef(null);

  const { data: settingsData } = useQuery({
    queryKey:  ['shop-settings'],
    queryFn:   settingsAPI.getSettings,
    staleTime: 5 * 60 * 1000,
  });
  const shop = settingsData?.data || {};

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;

    const win = window.open('', '_blank', 'width=420,height=600');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${bill.bill_number}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; }
          .receipt { max-width: 340px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 12px; margin-bottom: 12px; }
          .shop-name { font-size: 18px; font-weight: 800; color: #111; }
          .shop-sub { font-size: 11px; color: #666; margin-top: 2px; }
          .title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; color: #4f46e5; }
          .row { display: flex; justify-content: space-between; padding: 4px 0; }
          .row .label { color: #555; }
          .row .val { font-weight: 600; }
          .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
          .amount-row { font-size: 17px; font-weight: 800; }
          .amount-row .val { color: #16a34a; }
          .footer { text-align: center; margin-top: 14px; font-size: 11px; color: #888; }
          .sig-line { border-top: 1px solid #aaa; margin-top: 32px; padding-top: 4px; text-align: center; font-size: 11px; color: #888; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="receipt">
          <div class="header">
            <div class="shop-name">${shop.shop_name || 'Printing Press'}</div>
            ${shop.address ? `<div class="shop-sub">${shop.address}</div>` : ''}
            ${shop.phone   ? `<div class="shop-sub">${shop.phone}</div>` : ''}
            <div class="title">Payment Receipt</div>
          </div>

          <div class="row"><span class="label">Bill No.</span><span class="val">${bill.bill_number}</span></div>
          <div class="row"><span class="label">Customer</span><span class="val">${bill.customer_name}</span></div>
          <div class="row"><span class="label">Phone</span><span class="val">${bill.customer_phone || '—'}</span></div>
          <div class="row"><span class="label">Date</span><span class="val">${formatDateTime(payment.payment_date)}</span></div>

          <div class="divider"></div>

          <div class="row amount-row">
            <span class="label">Amount Received</span>
            <span class="val">${formatCurrency(payment.amount)}</span>
          </div>

          <div class="divider"></div>

          <div class="row"><span class="label">Method</span><span class="val">${METHOD_LABEL[payment.payment_method] || payment.payment_method}</span></div>
          ${payment.reference_number ? `<div class="row"><span class="label">Reference</span><span class="val">${payment.reference_number}</span></div>` : ''}
          ${payment.notes ? `<div class="row"><span class="label">Notes</span><span class="val">${payment.notes}</span></div>` : ''}

          <div class="divider"></div>

          <div class="row"><span class="label">Bill Total</span><span class="val">${formatCurrency(bill.total_amount)}</span></div>
          <div class="row"><span class="label">Remaining Balance</span><span class="val" style="color:${parseFloat(bill.remaining_balance) > 0 ? '#dc2626' : '#16a34a'}">${formatCurrency(bill.remaining_balance)}</span></div>

          <div class="sig-line">Authorized Signature</div>

          <div class="footer">${shop.tagline || 'Thank you for your business!'}</div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <>
      <style>{PRINT_STYLE}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">Payment Receipt</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Receipt preview */}
          <div ref={printRef} className="px-5 py-4 font-mono text-xs space-y-2">
            {/* Shop header */}
            <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-3">
              <p className="text-base font-black text-gray-900">{shop.shop_name || 'Printing Press'}</p>
              {shop.address && <p className="text-gray-500 text-[11px]">{shop.address}</p>}
              {shop.phone   && <p className="text-gray-500 text-[11px]">{shop.phone}</p>}
              <p className="text-indigo-600 font-bold uppercase tracking-wider text-[11px] mt-1">Payment Receipt</p>
            </div>

            {/* Bill info */}
            <div className="flex justify-between"><span className="text-gray-500">Bill No.</span><span className="font-bold">{bill.bill_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-semibold">{bill.customer_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{bill.customer_phone || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{formatDateTime(payment.payment_date)}</span></div>

            <div className="border-t border-dashed border-gray-300 my-2" />

            {/* Amount highlight */}
            <div className="flex justify-between text-base">
              <span className="text-gray-600 font-semibold">Received</span>
              <span className="text-green-700 font-black">{formatCurrency(payment.amount)}</span>
            </div>

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="flex justify-between">
              <span className="text-gray-500">Method</span>
              <span className="font-semibold">{METHOD_LABEL[payment.payment_method] || payment.payment_method}</span>
            </div>
            {payment.reference_number && (
              <div className="flex justify-between">
                <span className="text-gray-500">Reference</span>
                <span className="font-semibold">{payment.reference_number}</span>
              </div>
            )}
            {payment.notes && (
              <div className="flex justify-between">
                <span className="text-gray-500">Notes</span>
                <span className="max-w-[160px] text-right">{payment.notes}</span>
              </div>
            )}

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="flex justify-between"><span className="text-gray-500">Bill Total</span><span className="font-semibold">{formatCurrency(bill.total_amount)}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-500">Remaining</span>
              <span className={`font-bold ${parseFloat(bill.remaining_balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {parseFloat(bill.remaining_balance) > 0 ? formatCurrency(bill.remaining_balance) : 'Paid in Full ✓'}
              </span>
            </div>

            {/* Signature */}
            <div className="border-t border-gray-300 mt-6 pt-1 text-center text-gray-400 text-[10px]">
              Authorized Signature
            </div>

            {/* Footer */}
            <p className="text-center text-gray-400 text-[10px] mt-2">
              {shop.tagline || 'Thank you for your business!'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="no-print px-5 pb-5 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Printer size={14} />
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PaymentReceiptModal;
