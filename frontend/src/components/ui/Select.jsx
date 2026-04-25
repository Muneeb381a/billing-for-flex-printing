import { forwardRef } from 'react';
import cn from '../../utils/cn.js';

const SIZE = {
  sm: 'py-1.5 text-xs',
  md: 'py-2.5 text-sm',
  lg: 'py-3 text-sm',
};

const Select = forwardRef(({
  label,
  error,
  hint,
  options = [],
  placeholder,
  className,
  wrapperClassName,
  required,
  size = 'md',
  ...props
}, ref) => (
  <div className={cn('flex flex-col gap-1', wrapperClassName)}>
    {label && (
      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
    )}
    <select
      ref={ref}
      className={cn(
        'w-full rounded-xl border bg-white text-slate-900',
        'px-3',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
        'transition-all duration-150',
        SIZE[size] ?? SIZE.md,
        error ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 hover:border-slate-400',
        className
      )}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    {hint  && !error && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
  </div>
));

Select.displayName = 'Select';
export default Select;
