import { useState, useRef, useEffect } from 'react';
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import cn from '../../utils/cn.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

const PAGE_KEYS = {
  '/':          'dashboard',
  '/customers': 'customers',
  '/products':  'products',
  '/bills':     'bills',
  '/ledger':    'ledger',
  '/reports':   'reports',
  '/inventory': 'inventory',
  '/settings':  'settings',
};

const LanguageToggle = () => {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => setLang('en')}
        className={cn(
          'px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer',
          lang === 'en'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        )}
      >
        EN
      </button>
      <button
        onClick={() => setLang('ur')}
        className={cn(
          'px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer',
          lang === 'ur'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        )}
        style={{ fontFamily: "'Noto Nastaliq Urdu', sans-serif", lineHeight: 1.6 }}
      >
        اردو
      </button>
    </div>
  );
};

const UserMenu = () => {
  const { logout } = useAuth();
  const navigate   = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 cursor-pointer group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-brand-200 group-hover:shadow-md transition-shadow">
          A
        </div>
        <ChevronDown
          size={13}
          className={cn(
            'text-slate-400 transition-transform duration-150',
            open ? 'rotate-180' : ''
          )}
        />
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/60 py-1.5 z-50">
          <div className="px-3.5 py-2 border-b border-slate-100 mb-1">
            <p className="text-xs font-bold text-slate-800">Admin</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Administrator</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

const Topbar = ({ onMenuClick }) => {
  const { pathname } = useLocation();
  const { t } = useLanguage();

  const isDynamicLedger = /^\/customers\/\d+\/ledger$/.test(pathname);
  const isDynamicBill   = /^\/bills\/\d+$/.test(pathname);
  const isDynamicNew    = pathname === '/bills/new';

  const title = isDynamicLedger
    ? t('ledger')
    : isDynamicNew
    ? t('new_bill')
    : isDynamicBill
    ? t('bills')
    : PAGE_KEYS[pathname]
    ? t(PAGE_KEYS[pathname])
    : 'Press ERP';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 gap-4 shrink-0 z-20">

      {/* Mobile menu toggle */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-slate-900 text-base leading-tight truncate">
          {title}
        </h2>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 shrink-0">
        <LanguageToggle />

        <button className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer">
          <Bell size={18} />
        </button>

        <UserMenu />
      </div>
    </header>
  );
};

export default Topbar;
