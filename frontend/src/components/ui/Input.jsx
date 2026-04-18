import { forwardRef } from 'react';
import cn from '../../utils/cn.js';

const Input = forwardRef(({
  label,
  error,
  hint,
  prefix,
  suffix,
  className,
  wrapperClassName,
  required,
  ...props
}, ref) => (
  <div className={cn('flex flex-col gap-1', wrapperClassName)}>
    {label && (
      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
    )}
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute start-3 text-slate-400 text-sm select-none z-10">{prefix}</span>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full rounded-xl border bg-white text-sm text-slate-900',
          'px-3 py-2.5 placeholder-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          'transition-all duration-150',
          error  ? 'border-red-400 focus:ring-red-400' : 'border-slate-300 hover:border-slate-400',
          prefix ? 'ps-8'  : '',
          suffix ? 'pe-10' : '',
          className
        )}
        {...props}
      />
      {suffix && (
        <span className="absolute end-3 text-slate-400 text-sm select-none">{suffix}</span>
      )}
    </div>
    {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    {hint  && !error && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
  </div>
));

Input.displayName = 'Input';
export default Input;
