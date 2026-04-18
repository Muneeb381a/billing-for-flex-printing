import { forwardRef } from 'react';
import cn from '../../utils/cn.js';
import Spinner from './Spinner.jsx';

const variants = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-200/60 focus:ring-brand-500',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 focus:ring-brand-500',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-200/60 focus:ring-red-500',
  ghost:     'text-slate-600 hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200 focus:ring-slate-400',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm shadow-emerald-200/60 focus:ring-emerald-500',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

const Button = forwardRef(({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  disabled = false,
  icon,
  children,
  className,
  ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center gap-2 font-semibold',
      'cursor-pointer select-none',
      'focus:outline-none focus:ring-2 focus:ring-offset-1',
      'transition-all duration-150',
      'active:scale-[0.97]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
      variants[variant],
      sizes[size],
      className
    )}
    {...props}
  >
    {loading ? <Spinner size="sm" className="text-current" /> : icon}
    {children}
  </button>
));

Button.displayName = 'Button';
export default Button;
