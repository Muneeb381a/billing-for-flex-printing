import cn from '../../utils/cn.js';

const colorMap = {
  indigo: {
    icon:   'bg-brand-50 text-brand-600',
    value:  'text-brand-700',
    glow:   'shadow-brand-100',
  },
  green: {
    icon:   'bg-emerald-50 text-emerald-600',
    value:  'text-emerald-700',
    glow:   'shadow-emerald-100',
  },
  amber: {
    icon:   'bg-amber-50 text-amber-600',
    value:  'text-amber-700',
    glow:   'shadow-amber-100',
  },
  red: {
    icon:   'bg-red-50 text-red-600',
    value:  'text-red-700',
    glow:   'shadow-red-100',
  },
  blue: {
    icon:   'bg-blue-50 text-blue-600',
    value:  'text-blue-700',
    glow:   'shadow-blue-100',
  },
};

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'indigo', loading = false }) => {
  const c = colorMap[color] || colorMap.indigo;
  return (
    <div className={cn(
      'bg-white rounded-2xl border border-slate-200 p-5',
      'flex items-center gap-4',
      'shadow-sm hover:shadow-md transition-shadow duration-200',
    )}>
      <div className={cn(
        'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
        c.icon
      )}>
        {Icon && <Icon size={22} strokeWidth={1.75} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-none">
          {title}
        </p>
        {loading ? (
          <div className="h-7 w-28 bg-slate-100 rounded-lg animate-pulse mt-2" />
        ) : (
          <p className={cn('text-2xl font-bold truncate mt-1.5 leading-none', c.value)}>
            {value}
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-slate-400 mt-1.5 leading-snug">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default StatCard;
