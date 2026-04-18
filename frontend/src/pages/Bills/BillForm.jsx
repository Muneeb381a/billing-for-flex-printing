import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Save, ArrowLeft, Trash2, UserPlus, FileText, Hash, CheckCircle, XCircle, Loader } from 'lucide-react';
import {
  Input, Select, Textarea, Button, Card, PageHeader, Modal,
} from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import * as custApi from '../../api/customers.js';
import * as billApi from '../../api/bills.js';
import BillItemRow    from './BillItemRow.jsx';
import BillTotals     from './BillTotals.jsx';
import CustomerForm   from '../Customers/CustomerForm.jsx';

const newItem = () => ({
  id:           crypto.randomUUID(),
  categoryId:   '',
  productId:    '',
  pricingModel: '',
  description:  '',
  width:        '',
  height:       '',
  quantity:     1,
  unitPrice:    '',
  sqft:         null,
  itemTotal:    0,
  designFee:    0,
  urgentFee:    0,
  breakdown:    '',
});

// ── Bill Number Status Indicator ─────────────────────────────
const BillNumberStatus = ({ status }) => {
  if (status === 'checking') return <Loader size={14} className="animate-spin text-slate-400" />;
  if (status === 'available') return <CheckCircle size={14} className="text-emerald-500" />;
  if (status === 'taken')     return <XCircle size={14} className="text-red-500" />;
  return null;
};

const BillForm = () => {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [items,         setItems]         = useState([newItem()]);
  const [extraCharges,  setExtraCharges]  = useState([]);
  const [discountType,  setDiscountType]  = useState('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [advance,       setAdvance]       = useState('');
  const [payMethod,     setPayMethod]     = useState('cash');
  const [quickCustOpen, setQuickCustOpen] = useState(false);

  // ── Custom bill number state ────────────────────────────────
  const [useCustomBillNo,  setUseCustomBillNo]  = useState(false);
  const [customBillNo,     setCustomBillNo]     = useState('');
  const [billNoStatus,     setBillNoStatus]     = useState('idle'); // idle | checking | available | taken
  const debounceRef = useRef(null);

  // Debounced uniqueness check
  useEffect(() => {
    if (!useCustomBillNo) { setBillNoStatus('idle'); return; }
    const trimmed = customBillNo.trim();
    if (!trimmed) { setBillNoStatus('idle'); return; }

    setBillNoStatus('checking');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await billApi.checkBillNumber(trimmed);
        setBillNoStatus(res.available ? 'available' : 'taken');
      } catch {
        setBillNoStatus('idle');
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [customBillNo, useCustomBillNo]);

  const today = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: { billDate: today },
  });
  const selectedCustomerId = watch('customerId');

  const { data: custData } = useQuery({
    queryKey: ['customers'],
    queryFn:  () => custApi.getCustomers({ limit: 500 }),
  });

  const customers = (custData?.data || []).map((c) => ({
    value: String(c.id),
    label: `${c.name} — ${c.phone}`,
  }));

  const handleCustomerCreated = (customer) => {
    qc.invalidateQueries({ queryKey: ['customers'] }).then(() => {
      setValue('customerId', String(customer.id), { shouldValidate: true });
    });
    setQuickCustOpen(false);
    toast.success(`${customer.name} added and selected`);
  };

  const updateItem = (id, patch) =>
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));

  const removeItem = (id) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const addItem = () => setItems((prev) => [...prev, newItem()]);

  const addExtraCharge = () =>
    setExtraCharges((prev) => [...prev, { id: crypto.randomUUID(), label: '', amount: '' }]);

  const updateCharge = (id, field, val) =>
    setExtraCharges((prev) => prev.map((ec) => ec.id === id ? { ...ec, [field]: val } : ec));

  const removeCharge = (id) =>
    setExtraCharges((prev) => prev.filter((ec) => ec.id !== id));

  const subtotal = useMemo(
    () => items.reduce((s, it) =>
      s + parseFloat(it.itemTotal || 0) + parseFloat(it.designFee || 0) + parseFloat(it.urgentFee || 0), 0),
    [items]
  );

  const validateItems = () => {
    if (useCustomBillNo) {
      const trimmed = customBillNo.trim();
      if (!trimmed)               return 'Bill number cannot be empty';
      if (billNoStatus === 'taken')    return `Bill number "${trimmed}" already exists`;
      if (billNoStatus === 'checking') return 'Wait — checking bill number availability…';
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId)     return `Row ${i + 1}: select a product`;
      if (it.itemTotal <= 0) return `Row ${i + 1}: price hasn't calculated yet — check your inputs`;
    }
    for (const ec of extraCharges) {
      if (!ec.label)  return 'Extra charge label is required';
      if (!ec.amount || parseFloat(ec.amount) <= 0) return 'Extra charge amount must be > 0';
    }
    return null;
  };

  const mutation = useMutation({
    mutationFn: (formData) => {
      const err = validateItems();
      if (err) throw new Error(err);

      return billApi.completeBill({
        customerId:    Number(formData.customerId),
        notes:         formData.notes    || undefined,
        dueDate:       formData.dueDate  || undefined,
        billDate:      formData.billDate || undefined,
        // Only send billNumber when custom mode is active
        billNumber:    useCustomBillNo ? customBillNo.trim().toUpperCase() : undefined,
        discountType,
        discountValue: parseFloat(discountValue || 0),
        advance:       parseFloat(advance       || 0),
        paymentMethod: payMethod,
        items: items.map((it) => ({
          productId:    Number(it.productId),
          pricingModel: it.pricingModel,
          description:  it.description || undefined,
          width:        it.width       ? parseFloat(it.width)  : undefined,
          height:       it.height      ? parseFloat(it.height) : undefined,
          quantity:     parseInt(it.quantity, 10),
          unitPrice:    parseFloat(it.unitPrice || 0),
          designFee:    parseFloat(it.designFee || 0),
          urgentFee:    parseFloat(it.urgentFee || 0),
        })),
        extraCharges: extraCharges.map((ec) => ({
          label:  ec.label,
          amount: parseFloat(ec.amount),
        })),
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success(`Bill ${res.data.bill.bill_number} created successfully!`);
      navigate(`/bills/${res.data.bill.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || err.message);
    },
  });

  const isSaving = mutation.isPending;
  const selectedCustomer = (custData?.data || []).find((c) => String(c.id) === selectedCustomerId);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="New Bill"
        subtitle="Fill items below — prices calculate automatically as you type"
        action={
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate('/bills')}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">

        {/* ── Bill Information ── */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <FileText size={15} className="text-brand-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bill Information</h3>
              <p className="text-xs text-slate-400">Customer, dates, and notes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex gap-2 items-end">
              <Select
                label="Customer"
                required
                placeholder="Select customer…"
                options={customers}
                error={errors.customerId?.message}
                {...register('customerId', { required: 'Customer is required' })}
                wrapperClassName="flex-1"
              />
              <button
                type="button"
                onClick={() => setQuickCustOpen(true)}
                title="Add new customer"
                className="mb-1 inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-brand-600 border border-brand-200 rounded-xl hover:bg-brand-50 active:bg-brand-100 transition-all cursor-pointer shrink-0"
              >
                <UserPlus size={14} />
                <span className="hidden sm:inline">New</span>
              </button>
            </div>

            <Input label="Bill Date" type="date" {...register('billDate')} />
            <Input label="Due Date (optional)" type="date" {...register('dueDate')} />
          </div>

          {selectedCustomer && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-xs font-medium text-emerald-700">
                {selectedCustomer.name} · {selectedCustomer.phone}
                {selectedCustomer.address && ` · ${selectedCustomer.address}`}
              </p>
            </div>
          )}

          {/* ── Custom Bill Number Toggle ── */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={useCustomBillNo}
                  onChange={(e) => {
                    setUseCustomBillNo(e.target.checked);
                    setCustomBillNo('');
                    setBillNoStatus('idle');
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full bg-slate-200 peer-checked:bg-brand-600 transition-colors duration-150" />
                <div className="absolute top-0.5 start-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-150 peer-checked:translate-x-4" />
              </div>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                Enter custom bill number
              </span>
              <Hash size={13} className="text-slate-400" />
            </label>

            {useCustomBillNo && (
              <div className="mt-3">
                <div className="relative">
                  <input
                    type="text"
                    value={customBillNo}
                    onChange={(e) => setCustomBillNo(e.target.value.toUpperCase())}
                    placeholder="e.g. AK-2024-55"
                    maxLength={50}
                    autoFocus
                    className={`w-full max-w-xs px-4 py-2.5 pe-10 rounded-xl border text-sm font-mono font-semibold tracking-wide
                      placeholder-slate-300 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-150
                      ${billNoStatus === 'taken'
                        ? 'border-red-400 focus:ring-red-400 bg-red-50 text-red-700'
                        : billNoStatus === 'available'
                        ? 'border-emerald-400 focus:ring-emerald-400 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 hover:border-slate-400 focus:ring-brand-500 bg-white text-slate-900'
                      }`}
                  />
                  <div className="absolute end-3 top-1/2 -translate-y-1/2">
                    <BillNumberStatus status={billNoStatus} />
                  </div>
                </div>

                <p className={`text-xs mt-1.5 font-medium ${
                  billNoStatus === 'taken'     ? 'text-red-500' :
                  billNoStatus === 'available' ? 'text-emerald-600' :
                  'text-slate-400'
                }`}>
                  {billNoStatus === 'taken'     && `"${customBillNo}" is already used — choose a different number`}
                  {billNoStatus === 'available' && `"${customBillNo}" is available`}
                  {billNoStatus === 'checking'  && 'Checking availability…'}
                  {billNoStatus === 'idle'      && 'Letters, numbers and dashes allowed (e.g. AK-2024-55)'}
                </p>
              </div>
            )}
          </div>

          <Textarea
            label="Notes (optional)"
            placeholder="Special instructions, delivery details, design requirements…"
            rows={2}
            wrapperClassName="mt-4"
            {...register('notes')}
          />
        </Card>

        {/* ── Bill Items ── */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bill Items</h3>
              <p className="text-xs text-slate-400 mt-0.5">Prices calculate automatically as you type</p>
            </div>
            <Button type="button" size="sm" variant="secondary" icon={<Plus size={13} />} onClick={addItem}>
              Add Row
            </Button>
          </div>

          <div className="px-3 py-3 space-y-2">
            {items.map((item, i) => (
              <BillItemRow
                key={item.id}
                item={item}
                index={i}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            ))}

            {items.length === 0 && (
              <div className="text-center py-10 text-slate-300 text-sm border-2 border-dashed border-slate-100 rounded-2xl">
                No items yet — click "Add Row" to start
              </div>
            )}
          </div>

          {items.length > 0 && subtotal > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items Subtotal</span>
              <span className="text-base font-bold text-brand-700">{formatCurrency(subtotal)}</span>
            </div>
          )}
        </Card>

        {/* ── Extra Charges ── */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Extra Charges</h3>
              <p className="text-xs text-slate-400 mt-0.5">Lamination, mounting, rush delivery…</p>
            </div>
            <Button type="button" size="sm" variant="secondary" icon={<Plus size={13} />} onClick={addExtraCharge}>
              Add Charge
            </Button>
          </div>

          {extraCharges.length === 0 && (
            <p className="text-xs text-slate-300 text-center py-4 border-2 border-dashed border-slate-100 rounded-xl">
              No extra charges
            </p>
          )}

          <div className="space-y-2">
            {extraCharges.map((ec, idx) => (
              <div key={ec.id} className="flex gap-2 items-end">
                <Input
                  label={idx === 0 ? 'Label' : undefined}
                  placeholder="e.g. Design Fee"
                  value={ec.label}
                  onChange={(e) => updateCharge(ec.id, 'label', e.target.value)}
                  wrapperClassName="flex-1"
                />
                <Input
                  label={idx === 0 ? 'Amount (PKR)' : undefined}
                  type="number" min="0" step="1"
                  prefix="₨"
                  placeholder="0"
                  value={ec.amount}
                  onChange={(e) => updateCharge(ec.id, 'amount', e.target.value)}
                  wrapperClassName="w-44"
                />
                <button
                  type="button"
                  onClick={() => removeCharge(ec.id)}
                  className="mb-1 p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 rounded-xl transition-all cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Totals & Payment ── */}
        <Card>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Payment & Discount</h3>
            <p className="text-xs text-slate-400 mt-0.5">Apply discounts and record advance payment</p>
          </div>
          <BillTotals
            subtotal={subtotal}
            extraCharges={extraCharges}
            discountType={discountType}
            discountValue={discountValue}
            advance={advance}
            paymentMethod={payMethod}
            onDiscountTypeChange={setDiscountType}
            onDiscountValueChange={setDiscountValue}
            onAdvanceChange={setAdvance}
            onPaymentMethodChange={setPayMethod}
          />
        </Card>

        {/* ── Submit ── */}
        <div className="flex gap-3 pb-8">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/bills')}
            className="sm:w-32"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            icon={isSaving ? null : <Save size={15} />}
            loading={isSaving}
            disabled={isSaving || (useCustomBillNo && billNoStatus === 'taken')}
            className="flex-1"
          >
            {isSaving ? 'Saving Bill…' : 'Create Bill'}
          </Button>
        </div>
      </form>

      <Modal isOpen={quickCustOpen} onClose={() => setQuickCustOpen(false)} title="Add New Customer" size="sm">
        <CustomerForm onSuccess={handleCustomerCreated} />
      </Modal>
    </div>
  );
};

export default BillForm;
