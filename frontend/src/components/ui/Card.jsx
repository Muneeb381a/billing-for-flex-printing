import cn from '../../utils/cn.js';

const Card = ({ children, className, padding = true }) => (
  <div className={cn(
    'bg-white rounded-2xl border border-slate-200 shadow-sm',
    padding && 'p-5',
    className
  )}>
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, action, className }) => (
  <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
    <div>
      <h3 className="text-sm font-bold text-slate-900 leading-tight">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardDivider = () => (
  <hr className="-mx-5 my-4 border-slate-100" />
);

export default Card;
