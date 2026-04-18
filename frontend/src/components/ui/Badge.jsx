import cn from '../../utils/cn.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const colorMap = {
  pending:     'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  in_progress: 'bg-blue-50   text-blue-700   ring-1 ring-blue-200',
  completed:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  delivered:   'bg-brand-50  text-brand-700  ring-1 ring-brand-200',
  cancelled:   'bg-red-50    text-red-700    ring-1 ring-red-200',
  paid:        'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  partial:     'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  unpaid:      'bg-red-50    text-red-700    ring-1 ring-red-200',
  green:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  red:         'bg-red-50    text-red-700    ring-1 ring-red-200',
  blue:        'bg-blue-50   text-blue-700   ring-1 ring-blue-200',
  amber:       'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  indigo:      'bg-brand-50  text-brand-700  ring-1 ring-brand-200',
  gray:        'bg-slate-50  text-slate-600  ring-1 ring-slate-200',
  purple:      'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
};

const dotMap = {
  pending:     'bg-amber-500',
  in_progress: 'bg-blue-500',
  completed:   'bg-emerald-500',
  delivered:   'bg-brand-500',
  cancelled:   'bg-red-500',
  paid:        'bg-emerald-500',
  partial:     'bg-amber-500',
  unpaid:      'bg-red-500',
};

const Badge = ({ variant = 'gray', children, className, dot = false }) => (
  <span className={cn(
    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
    colorMap[variant] || colorMap.gray,
    className
  )}>
    {dot && dotMap[variant] && (
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotMap[variant])} />
    )}
    {children}
  </span>
);

const STATUS_KEYS = {
  pending:     'pending',
  in_progress: 'in_progress',
  completed:   'completed',
  delivered:   'delivered',
  cancelled:   'cancelled',
};

export const StatusBadge = ({ status }) => {
  const { t } = useLanguage();
  return (
    <Badge variant={status} dot>
      {t(STATUS_KEYS[status] || status) || status}
    </Badge>
  );
};

export const PaymentBadge = ({ status }) => {
  const { t } = useLanguage();
  return (
    <Badge variant={status} dot>
      {t(status) || status}
    </Badge>
  );
};

export default Badge;
