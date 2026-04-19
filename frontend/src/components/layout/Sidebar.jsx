import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, FileText,
  BookOpen, BarChart2, Printer, Settings, Boxes, X, TrendingDown,
} from 'lucide-react';
import cn from '../../utils/cn.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const NAV_GROUPS = [
  {
    key: 'nav_main',
    items: [
      { to: '/',          key: 'dashboard', icon: LayoutDashboard, end: true },
      { to: '/customers', key: 'customers', icon: Users },
      { to: '/products',  key: 'products',  icon: Package },
      { to: '/bills',     key: 'bills',     icon: FileText },
    ],
  },
  {
    key: 'nav_finance',
    items: [
      { to: '/ledger',   key: 'ledger',   icon: BookOpen },
      { to: '/reports',  key: 'reports',  icon: BarChart2 },
      { to: '/expenses', key: 'expenses', icon: TrendingDown },
    ],
  },
  {
    key: 'nav_system',
    items: [
      { to: '/inventory', key: 'inventory', icon: Boxes },
      { to: '/settings',  key: 'settings',  icon: Settings },
    ],
  },
];

const NavItem = ({ to, icon: Icon, label, end, onClose }) => (
  <NavLink
    to={to}
    end={end}
    onClick={() => window.innerWidth < 1024 && onClose()}
    className={({ isActive }) => cn(
      'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
      'transition-all duration-150',
      isActive
        ? 'bg-brand-600 text-white shadow-sm shadow-brand-900/30'
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
    )}
  >
    {({ isActive }) => (
      <>
        <Icon
          size={17}
          className={cn(
            'shrink-0 transition-transform duration-150',
            isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
          )}
        />
        <span className="truncate">{label}</span>
        {isActive && (
          <span className="ms-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
        )}
      </>
    )}
  </NavLink>
);

const Sidebar = ({ open, onClose }) => {
  const { t } = useLanguage();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed inset-y-0 start-0 z-40 w-64 flex flex-col',
        'bg-sidebar-900',
        'transition-transform duration-300 ease-in-out',
        'lg:translate-x-0 lg:static lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full',
        '[dir=rtl]_&:not(.lg\\:static):not(.lg\\:translate-x-0):data-[open=false]:translate-x-full'
      )}>

        {/* ── Brand ── */}
        <div className="flex items-center justify-between h-16 px-5 shrink-0 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/40">
              <Printer size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none tracking-tight">Press ERP</p>
              <p className="text-slate-500 text-xs mt-0.5">Management System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.key}>
              <p className="px-3 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-widest">
                {t(group.key)}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ to, key, icon, end }) => (
                  <NavItem
                    key={to}
                    to={to}
                    icon={icon}
                    label={t(key)}
                    end={end}
                    onClose={onClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-white/5 shrink-0">
          <p className="text-xs text-slate-600">{t('erp_version')}</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
