import { formatCurrency } from '../../utils/format.js';
import { Input, Select } from '../../components/ui/index.js';

const Row = ({ label, value, bold, color = 'text-slate-600', borderTop, large }) => (
  <div className={`flex justify-between items-center py-2 ${borderTop ? 'border-t border-slate-200 mt-2 pt-3' : ''}`}>
    <span className={`${large ? 'text-sm' : 'text-xs'} ${bold ? 'font-bold text-slate-900' : 'font-medium text-slate-500'}`}>
      {label}
    </span>
    <span className={`${large ? 'text-base' : 'text-sm'} font-bold ${color}`}>
      {value}
    </span>
  </div>
);

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'online',        label: 'Online / JazzCash / EasyPaisa' },
];

const BillTotals = ({
  subtotal       = 0,
  extraCharges   = [],
  discountType,
  discountValue,
  advance        = 0,
  onDiscountTypeChange,
  onDiscountValueChange,
  onAdvanceChange,
  onPaymentMethodChange,
  paymentMethod  = 'cash',
  readonly       = false,
}) => {
  const extraTotal = extraCharges.reduce((s, ec) => s + parseFloat(ec.amount || 0), 0);

  const discountAmount =
    discountType === 'percentage'
      ? parseFloat(((subtotal * parseFloat(discountValue || 0)) / 100).toFixed(2))
      : parseFloat(discountValue || 0);

  const total     = Math.max(0, subtotal + extraTotal - discountAmount);
  const remaining = Math.max(0, total - parseFloat(advance || 0));

  return (
    <div className="space-y-3">
      {/* Discount controls */}
      {!readonly && (
        <div className="flex gap-3 items-end p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <Select
            label="Discount Type"
            options={[
              { value: 'fixed',      label: 'Fixed Amount (PKR)' },
              { value: 'percentage', label: 'Percentage (%)' },
            ]}
            value={discountType}
            onChange={(e) => onDiscountTypeChange?.(e.target.value)}
            wrapperClassName="w-52"
          />
          <Input
            label="Discount Value"
            type="number" min="0" step="1"
            placeholder="0"
            suffix={discountType === 'percentage' ? '%' : undefined}
            prefix={discountType === 'fixed' ? '₨' : undefined}
            value={discountValue}
            onChange={(e) => onDiscountValueChange?.(e.target.value)}
            wrapperClassName="flex-1"
          />
        </div>
      )}

      {/* Advance payment controls */}
      {!readonly && (
        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <Input
            label="Advance Payment (PKR)"
            type="number" min="0" step="1"
            placeholder="0"
            prefix="₨"
            value={advance}
            onChange={(e) => onAdvanceChange?.(e.target.value)}
          />
          <Select
            label="Payment Method"
            options={PAYMENT_METHODS}
            value={paymentMethod}
            onChange={(e) => onPaymentMethodChange?.(e.target.value)}
          />
        </div>
      )}

      {/* Summary breakdown */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
        <Row label="Subtotal" value={formatCurrency(subtotal)} />

        {extraTotal > 0 && (
          <Row
            label={`Extra Charges (${extraCharges.length} item${extraCharges.length !== 1 ? 's' : ''})`}
            value={`+ ${formatCurrency(extraTotal)}`}
            color="text-amber-600"
          />
        )}

        {discountAmount > 0 && (
          <Row
            label={`Discount (${discountType === 'percentage' ? `${discountValue}%` : 'fixed'})`}
            value={`− ${formatCurrency(discountAmount)}`}
            color="text-emerald-600"
          />
        )}

        <Row
          label="Total"
          value={formatCurrency(total)}
          bold
          large
          borderTop
          color="text-slate-900"
        />

        {parseFloat(advance || 0) > 0 && (
          <Row
            label="Advance Paid"
            value={`− ${formatCurrency(parseFloat(advance))}`}
            color="text-emerald-600"
          />
        )}

        <Row
          label="Remaining Balance"
          value={formatCurrency(remaining)}
          bold
          large
          borderTop
          color={remaining > 0 ? 'text-red-600' : 'text-emerald-600'}
        />
      </div>

      {remaining === 0 && total > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <p className="text-xs font-semibold text-emerald-700">Fully paid — no balance remaining</p>
        </div>
      )}
    </div>
  );
};

export default BillTotals;
