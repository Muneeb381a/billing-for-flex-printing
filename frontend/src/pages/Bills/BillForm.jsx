import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus, Save, ArrowLeft, Trash2, UserPlus, FileText,
  Hash, CheckCircle, XCircle, Loader, ChevronDown, Zap,
  Package, Layers, Maximize2, Receipt,
} from 'lucide-react';
import {
  Input, Select, Textarea, Button, Card, PageHeader, Modal,
} from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import * as custApi from '../../api/customers.js';
import * as billApi from '../../api/bills.js';
import BillItemRow  from './BillItemRow.jsx';
import BillTotals   from './BillTotals.jsx';
import CustomerForm from '../Customers/CustomerForm.jsx';
import cn from '../../utils/cn.js';

// ── Predefined charges (quick-add from dropdown) ──────────────
const PREDEFINED_CHARGES = [
  { label: 'Designing Fee',      amount: 500  },
  { label: 'Installation Fee',   amount: 1000 },
  { label: 'Urgent Charges',     amount: 500  },
  { label: 'Delivery Charges',   amount: 300  },
  { label: 'Lamination Charges', amount: 200  },
  { label: 'Mounting Charges',   amount: 800  },
  { label: 'Packaging Charges',  amount: 150  },
  { label: 'Welding / Fitting',  amount: 600  },
  { label: 'Transport Charges',  amount: 400  },
];

const newItem = () => ({
  id: crypto.randomUUID(),
  categoryId: '',
  description: '', width: '', height: '',
  quantity: 1, sqft: null,
  amount: '', designFee: 0, urgentFee: 0,
});

const BillNumberStatus = ({ status }) => {
  if (status === 'checking')  return <Loader size={14} className="animate-spin text-slate-400" />;
  if (status === 'available') return <CheckCircle size={14} className="text-emerald-500" />;
  if (status === 'taken')     return <XCircle size={14} className="text-red-500" />;
  return null;
};

const BillForm = () => {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [items,            setItems]            = useState([newItem()]);
  const [extraCharges,     setExtraCharges]     = useState([]);
  const [discountType,     setDiscountType]     = useState('fixed');
  const [discountValue,    setDiscountValue]    = useState('');
  const [isAutoDiscount,   setIsAutoDiscount]   = useState(false);
  const [advance,          setAdvance]          = useState('');
  const [payMethod,        setPayMethod]        = useState('cash');
  const [quickCustOpen,    setQuickCustOpen]    = useState(false);

  // Custom bill number
  const [useCustomBillNo, setUseCustomBillNo] = useState(false);
  const [customBillNo,    setCustomBillNo]    = useState('');
  const [billNoStatus,    setBillNoStatus]    = useState('idle');
  const debounceRef = useRef(null);

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
      } catch { setBillNoStatus('idle'); }
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

  const updateItem   = (id, patch) => setItems((p) => p.map((it) => it.id === id ? { ...it, ...patch } : it));
  const removeItem   = (id)        => setItems((p) => p.filter((it) => it.id !== id));
  const addItem      = ()          => setItems((p) => [...p, newItem()]);

  const addExtraCharge = (preset = null) =>
    setExtraCharges((p) => [
      ...p,
      { id: crypto.randomUUID(), label: preset?.label || '', amount: preset?.amount?.toString() || '' },
    ]);
  const updateCharge = (id, field, val) =>
    setExtraCharges((p) => p.map((ec) => ec.id === id ? { ...ec, [field]: val } : ec));
  const removeCharge = (id) =>
    setExtraCharges((p) => p.filter((ec) => ec.id !== id));

  // ── Live totals ───────────────────────────────────────────────
  const subtotal = useMemo(
    () => items.reduce((s, it) =>
      s + (parseFloat(it.amount || 0)) + (parseFloat(it.designFee || 0)) + (parseFloat(it.urgentFee || 0)), 0),
    [items],
  );

  // Summary card values
  const totalItems    = items.length;
  const totalQuantity = useMemo(
    () => items.reduce((s, it) => s + (parseInt(it.quantity, 10) || 0), 0),
    [items],
  );
  const totalSqft = useMemo(
    () => parseFloat(items.reduce((s, it) => s + (parseFloat(it.sqft || 0)), 0).toFixed(3)),
    [items],
  );
  const totalBillAmount = useMemo(
    () => items.reduce((s, it) => s + (parseFloat(it.amount || 0)), 0),
    [items],
  );

  const extraTotal = useMemo(
    () => extraCharges.reduce((s, ec) => s + parseFloat(ec.amount || 0), 0),
    [extraCharges],
  );

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue || 0);
    return discountType === 'percentage'
      ? parseFloat(((subtotal * val) / 100).toFixed(2))
      : val;
  }, [subtotal, discountType, discountValue]);

  const grandTotal = Math.max(0, subtotal + extraTotal - discountAmount);
  const remaining  = Math.max(0, grandTotal - parseFloat(advance || 0));

  const selectedCustomer = (custData?.data || []).find((c) => String(c.id) === selectedCustomerId);

  // Auto-apply (or clear) customer discount whenever the selected customer changes
  useEffect(() => {
    const pct = parseFloat(selectedCustomer?.discount_percentage || 0);
    const isRegular = selectedCustomer?.discount_type === 'regular' && pct > 0;

    if (isRegular) {
      setDiscountType('percentage');
      setDiscountValue(String(pct));
      setIsAutoDiscount(true);
    } else {
      setDiscountType('fixed');
      setDiscountValue('');
      setIsAutoDiscount(false);
    }
  }, [selectedCustomerId]); // eslint-disable-line

  // ── Validation ────────────────────────────────────────────────
  const validateItems = () => {
    if (useCustomBillNo) {
      const t = customBillNo.trim();
      if (!t)                          return 'Bill number cannot be empty';
      if (billNoStatus === 'taken')    return `Bill number "${t}" already exists`;
      if (billNoStatus === 'checking') return 'Wait — checking bill number availability…';
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.categoryId)                    return `Row ${i + 1}: select an item`;
      if (parseFloat(it.amount || 0) <= 0)   return `Row ${i + 1}: enter an amount`;
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
        billDate:      formData.billDate || undefined,
        billNumber:    useCustomBillNo ? customBillNo.trim().toUpperCase() : undefined,
        discountType,
        discountValue: parseFloat(discountValue || 0),
        advance:       parseFloat(advance || 0),
        paymentMethod: payMethod,
        items: items.map((it) => ({
          categoryId:  Number(it.categoryId),
          description: it.description || undefined,
          width:       it.width  ? parseFloat(it.width)  : undefined,
          height:      it.height ? parseFloat(it.height) : undefined,
          quantity:    parseInt(it.quantity, 10) || 1,
          amount:      parseFloat(it.amount || 0),
          designFee:   parseFloat(it.designFee || 0),
          urgentFee:   parseFloat(it.urgentFee || 0),
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
      toast.success(`Bill ${res.data.bill.bill_number} created!`);
      navigate(`/bills/${res.data.bill.id}`);
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message),
  });

  const isSaving = mutation.isPending;

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="New Bill"
        subtitle="Enter dimensions → sqft is auto-calculated · set amount manually"
        action={
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={() => navigate('/bills')}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
        <div className="flex flex-col xl:flex-row gap-6 items-start">

          {/* ════════════════════════════════════════════════════ */}
          {/* LEFT COLUMN                                          */}
          {/* ════════════════════════════════════════════════════ */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ── Customer + Dates + Bill# ── */}
            <Card>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <FileText size={15} className="text-brand-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Bill Information</h3>
                  <p className="text-xs text-slate-400">Customer, dates, and optional notes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {selectedCustomer && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <p className="text-xs font-medium text-emerald-700 flex-1">
                    {selectedCustomer.name} · {selectedCustomer.phone}
                    {selectedCustomer.address && ` · ${selectedCustomer.address}`}
                  </p>
                  {isAutoDiscount && (
                    <span className="shrink-0 px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold whitespace-nowrap">
                      {parseFloat(selectedCustomer.discount_percentage)}% auto-discount
                    </span>
                  )}
                </div>
              )}

              {/* Custom bill number */}
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
                        className={cn(
                          'w-full max-w-xs px-4 py-2.5 pe-10 rounded-xl border text-sm font-mono font-semibold tracking-wide',
                          'placeholder-slate-300 focus:outline-none focus:ring-2 focus:border-transparent transition-all',
                          billNoStatus === 'taken'
                            ? 'border-red-400 focus:ring-red-400 bg-red-50 text-red-700'
                            : billNoStatus === 'available'
                            ? 'border-emerald-400 focus:ring-emerald-400 bg-emerald-50 text-emerald-800'
                            : 'border-slate-300 hover:border-slate-400 focus:ring-brand-500 bg-white text-slate-900',
                        )}
                      />
                      <div className="absolute end-3 top-1/2 -translate-y-1/2">
                        <BillNumberStatus status={billNoStatus} />
                      </div>
                    </div>
                    <p className={cn('text-xs mt-1.5 font-medium', {
                      'text-red-500':     billNoStatus === 'taken',
                      'text-emerald-600': billNoStatus === 'available',
                      'text-slate-400':   billNoStatus === 'idle' || billNoStatus === 'checking',
                    })}>
                      {billNoStatus === 'taken'     && `"${customBillNo}" is already used`}
                      {billNoStatus === 'available' && `"${customBillNo}" is available ✓`}
                      {billNoStatus === 'checking'  && 'Checking availability…'}
                      {billNoStatus === 'idle'      && 'e.g. AK-2024-55 or INV-001'}
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
                  <p className="text-xs text-slate-400 mt-0.5">
                    {items.length} row{items.length !== 1 ? 's' : ''}
                    {subtotal > 0 && (
                      <span className="text-brand-600 font-semibold"> · {formatCurrency(subtotal)}</span>
                    )}
                  </p>
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
                  <div className="text-center py-12 text-slate-300 text-sm border-2 border-dashed border-slate-100 rounded-2xl">
                    No items yet — click "Add Row" to start
                  </div>
                )}
              </div>
            </Card>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  icon: Layers,
                  label: 'Total Items',
                  value: totalItems,
                  unit: totalItems === 1 ? 'row' : 'rows',
                  color: 'text-indigo-600',
                  bg: 'bg-indigo-50',
                },
                {
                  icon: Package,
                  label: 'Total Quantity',
                  value: totalQuantity,
                  unit: 'pcs',
                  color: 'text-emerald-600',
                  bg: 'bg-emerald-50',
                },
                {
                  icon: Maximize2,
                  label: 'Total Sqft',
                  value: totalSqft || '—',
                  unit: totalSqft ? 'sqft' : '',
                  color: 'text-amber-600',
                  bg: 'bg-amber-50',
                },
                {
                  icon: Receipt,
                  label: 'Total Bill',
                  value: formatCurrency(totalBillAmount),
                  unit: '',
                  color: 'text-brand-700',
                  bg: 'bg-brand-50',
                },
              ].map(({ icon: Icon, label, value, unit, color, bg }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon size={15} className={color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">{label}</p>
                    <p className="text-base font-black text-slate-900 leading-tight mt-0.5 tabular-nums">
                      {value}
                      {unit && <span className="text-xs font-medium text-slate-400 ml-1">{unit}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Extra Charges ── */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Extra Charges</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Lamination, installation, delivery…</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Quick-add predefined charges */}
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const preset = PREDEFINED_CHARGES.find((c) => c.label === e.target.value);
                        if (preset) addExtraCharge(preset);
                        e.target.value = '';
                      }}
                      className="appearance-none ps-3 pe-8 py-1.5 text-xs font-semibold text-brand-600 border border-brand-200 rounded-xl hover:bg-brand-50 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    >
                      <option value="">⚡ Quick Add</option>
                      {PREDEFINED_CHARGES.map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.label} — ₨{c.amount.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<Plus size={13} />}
                    onClick={() => addExtraCharge()}
                  >
                    Custom
                  </Button>
                </div>
              </div>

              {extraCharges.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                  <Zap size={20} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-300">Use Quick Add or Custom to add charges</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {extraCharges.map((ec, idx) => (
                    <div key={ec.id} className="flex gap-2 items-end">
                      <Input
                        label={idx === 0 ? 'Charge Label' : undefined}
                        placeholder="e.g. Designing Fee"
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
              )}
            </Card>
          </div>

          {/* ════════════════════════════════════════════════════ */}
          {/* RIGHT COLUMN — STICKY SUMMARY PANEL                 */}
          {/* ════════════════════════════════════════════════════ */}
          <div className="w-full xl:w-96 shrink-0">
            <div className="xl:sticky xl:top-6 space-y-4">

              {/* Order Total Hero */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl shadow-slate-900/25">
                {/* Dot grid texture */}
                <div
                  className="absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize:  '20px 20px',
                  }}
                />
                <div className="relative">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    Order Total
                  </p>
                  <p className="text-4xl font-black text-white mt-1.5 leading-none tabular-nums">
                    {formatCurrency(grandTotal)}
                  </p>

                  {subtotal > 0 && (
                    <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Items subtotal</span>
                        <span className="text-slate-300 font-medium">{formatCurrency(subtotal)}</span>
                      </div>
                      {extraTotal > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Extra charges</span>
                          <span className="text-amber-400 font-medium">+ {formatCurrency(extraTotal)}</span>
                        </div>
                      )}
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Discount</span>
                          <span className="text-emerald-400 font-medium">− {formatCurrency(discountAmount)}</span>
                        </div>
                      )}
                      {parseFloat(advance || 0) > 0 && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Advance paid</span>
                            <span className="text-emerald-400 font-medium">− {formatCurrency(parseFloat(advance))}</span>
                          </div>
                          <div className="flex justify-between text-xs border-t border-white/10 pt-1.5 mt-1">
                            <span className="text-slate-300 font-semibold">Remaining</span>
                            <span className={cn(
                              'font-bold text-sm',
                              remaining > 0 ? 'text-red-400' : 'text-emerald-400',
                            )}>
                              {remaining > 0 ? formatCurrency(remaining) : '✓ Fully Paid'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {remaining === 0 && grandTotal > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                      <CheckCircle size={12} />
                      Fully paid — no balance remaining
                    </div>
                  )}
                </div>
              </div>

              {/* Discount + Advance + Payment controls */}
              <Card>
                <BillTotals
                  subtotal={subtotal}
                  extraCharges={extraCharges}
                  discountType={discountType}
                  discountValue={discountValue}
                  isAutoDiscount={isAutoDiscount}
                  customerName={isAutoDiscount ? selectedCustomer?.name : undefined}
                  advance={advance}
                  paymentMethod={payMethod}
                  onDiscountTypeChange={(v) => { setDiscountType(v); setIsAutoDiscount(false); }}
                  onDiscountValueChange={(v) => { setDiscountValue(v); setIsAutoDiscount(false); }}
                  onAdvanceChange={setAdvance}
                  onPaymentMethodChange={setPayMethod}
                />
              </Card>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  size="lg"
                  icon={isSaving ? null : <Save size={16} />}
                  loading={isSaving}
                  disabled={isSaving || (useCustomBillNo && billNoStatus === 'taken')}
                  className="w-full"
                >
                  {isSaving ? 'Saving Bill…' : 'Create Bill'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/bills')}
                  className="w-full"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>

            </div>
          </div>

        </div>
      </form>

      <Modal isOpen={quickCustOpen} onClose={() => setQuickCustOpen(false)} title="Add New Customer" size="sm">
        <CustomerForm onSuccess={handleCustomerCreated} />
      </Modal>
    </div>
  );
};

export default BillForm;
