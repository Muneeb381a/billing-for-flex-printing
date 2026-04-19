// ── Currency ─────────────────────────────────────────────────
export const formatCurrency = (amount, currency = 'PKR') => {
  const n = parseFloat(amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${currency} ${safe.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const formatNumber = (n) => {
  const v = parseFloat(n ?? 0);
  return (Number.isFinite(v) ? v : 0).toLocaleString('en-PK');
};

// ── Dates ─────────────────────────────────────────────────────
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const formatDateInput = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
};

// ── Order Status ──────────────────────────────────────────────
export const STATUS_LABELS = {
  pending:     'Pending',
  in_progress: 'In Progress',
  completed:   'Completed',
  delivered:   'Delivered',
  cancelled:   'Cancelled',
};

export const STATUS_COLORS = {
  pending:     'amber',
  in_progress: 'blue',
  completed:   'green',
  delivered:   'indigo',
  cancelled:   'red',
};

// ── Pricing Model ─────────────────────────────────────────────
export const PRICING_MODEL_LABELS = {
  area_based:     'Area Based (sqft)',
  quantity_based: 'Quantity Based (tiers)',
  fixed_charge:   'Fixed Charge',
  custom:         'Custom Price',
};

// ── Relative time ─────────────────────────────────────────────
export const timeAgo = (dateStr) => {
  if (!dateStr) return '—';
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return formatDate(dateStr);
};
