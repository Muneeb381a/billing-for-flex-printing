import { useState, useEffect } from 'react';
import { X, MessageCircle, Copy, Phone, FileText, ExternalLink, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/format.js';
import cn from '../../utils/cn.js';

// ── Phone normaliser → 923XXXXXXXXX ──────────────────────────
const formatPhone = (raw = '') => {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92'))  return digits;
  if (digits.startsWith('0'))   return '92' + digits.slice(1);
  if (digits.startsWith('3'))   return '92' + digits;
  return '92' + digits;
};

const buildWaLink = (phone, message) =>
  `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(message)}`;

const defaultMessage = (name, billNo, amount) =>
  `Dear ${name},\n\nYour bill *#${billNo}* of *Rs. ${amount}* is ready. ✅\n\nKindly review the attached invoice and confirm your order. Feel free to contact us for any queries.\n\nThank you for your business! 🙏`;

// ── Small copy button ─────────────────────────────────────────
const CopyBtn = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold',
        'transition-all duration-150 cursor-pointer',
        copied
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 border border-transparent',
      )}
    >
      {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  );
};

// ── Main modal ────────────────────────────────────────────────
const WhatsAppModal = ({ isOpen, onClose, bill, billId }) => {
  const [message, setMessage] = useState('');

  const hasPhone = !!(bill?.customer_phone?.trim());
  const phone    = bill?.customer_phone ?? '';
  const name     = bill?.customer_name  ?? 'Customer';
  const billNo   = bill?.bill_number    ?? '';
  const amount   = bill?.total_amount
    ? formatCurrency(bill.total_amount).replace('Rs.', '').trim()
    : '0';

  useEffect(() => {
    if (isOpen) setMessage(defaultMessage(name, billNo, amount));
  }, [isOpen, name, billNo, amount]);

  if (!isOpen) return null;

  const openWhatsApp = () => {
    if (!hasPhone) {
      toast.error('No phone number on this bill');
      return;
    }
    window.open(buildWaLink(phone, message), '_blank', 'noopener,noreferrer');
    toast.success('WhatsApp opened — please attach the PDF');
    onClose();
  };

  const openPdf = () =>
    window.open(`/bills/${billId}/print`, '_blank', 'noopener,noreferrer');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl shadow-black/15 animate-fade-in overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
                <MessageCircle size={18} className="text-[#25D366]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Send via WhatsApp</h2>
                <p className="text-xs text-slate-400">Review and send the bill message</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="px-5 py-4 space-y-4">

            {/* Customer info */}
            <div className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Customer</p>
                <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
                {hasPhone ? (
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{phone}</p>
                ) : (
                  <p className="text-xs text-red-500 font-medium mt-0.5">⚠ No phone number</p>
                )}
              </div>
              {hasPhone && (
                <CopyBtn text={phone} label="Copy" />
              )}
            </div>

            {/* Message editor */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Message Preview
                </label>
                <CopyBtn text={message} label="Copy Message" />
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className={cn(
                  'w-full text-sm text-slate-800 bg-white rounded-xl border border-slate-200',
                  'px-3 py-2.5 resize-none leading-relaxed',
                  'focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 focus:border-[#25D366]',
                  'transition-all duration-150 placeholder-slate-300',
                )}
                placeholder="Type your message…"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-right">
                {message.length} chars
              </p>
            </div>

            {/* PDF helper note */}
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <FileText size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">PDF must be attached manually</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Open the PDF below, then attach it in WhatsApp after the chat opens.
                </p>
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="px-5 pb-5 flex flex-col gap-2">

            {/* Primary: Open WhatsApp */}
            <button
              type="button"
              onClick={openWhatsApp}
              disabled={!hasPhone}
              className={cn(
                'w-full flex items-center justify-center gap-2.5 py-3 rounded-xl',
                'text-sm font-bold tracking-wide transition-all duration-150 cursor-pointer',
                hasPhone
                  ? 'bg-[#25D366] hover:bg-[#1ebe5d] active:bg-[#17a852] text-white shadow-lg shadow-[#25D366]/25 hover:shadow-xl hover:shadow-[#25D366]/30'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed',
              )}
            >
              <MessageCircle size={16} />
              Open WhatsApp
            </button>

            {/* Secondary: Open PDF */}
            <button
              type="button"
              onClick={openPdf}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 cursor-pointer"
            >
              <ExternalLink size={14} />
              Open PDF / Print Invoice
            </button>

            {/* Tertiary: Cancel */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default WhatsAppModal;
