import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign, TrendingUp, Clock, AlertCircle,
  Plus, Users, BarChart2, Boxes,
  CheckCircle, AlertTriangle, ChevronRight,
  ArrowUpRight, FileText, TrendingDown,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format.js';
import { StatusBadge } from '../components/ui/Badge.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Banner from '../components/Banner.jsx';
import * as dashAPI     from '../api/dashboard.js';
import * as settingsAPI from '../api/settings.js';
import * as invAPI      from '../api/inventory.js';
import * as expAPI      from '../api/expenses.js';
import cn from '../utils/cn.js';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const greeting = (t) => {
  const h = new Date().getHours();
  if (h < 12) return t('good_morning');
  if (h < 17) return t('good_afternoon');
  return t('good_evening');
};

const todayLabel = (lang) =>
  new Date().toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-PK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

// ─────────────────────────────────────────────────────────────
// Stat Card — large number, colored top strip, hover lift
// ─────────────────────────────────────────────────────────────

const STAT_PALETTES = {
  emerald: { strip: 'border-t-emerald-500', icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
  brand:   { strip: 'border-t-brand-500',   icon: 'bg-brand-50   text-brand-600',   value: 'text-brand-700'   },
  amber:   { strip: 'border-t-amber-500',   icon: 'bg-amber-50   text-amber-600',   value: 'text-amber-700'   },
  red:     { strip: 'border-t-red-500',     icon: 'bg-red-50     text-red-600',     value: 'text-red-700'     },
  violet:  { strip: 'border-t-violet-500',  icon: 'bg-violet-50  text-violet-600',  value: 'text-violet-700'  },
};

const DStat = ({ title, value, sub, icon: Icon, palette, loading, onClick }) => {
  const p = STAT_PALETTES[palette] || STAT_PALETTES.brand;
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-start bg-white rounded-2xl border border-slate-200 border-t-2 p-5',
        'shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
        'transition-all duration-200 cursor-pointer',
        p.strip
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none pt-0.5">
          {title}
        </p>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', p.icon)}>
          <Icon size={17} strokeWidth={2} />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-32 bg-slate-100 rounded-lg animate-pulse" />
      ) : (
        <p className={cn('text-2xl font-black tracking-tight leading-none', p.value)}>{value}</p>
      )}
      <p className="text-xs text-slate-400 mt-2.5 leading-snug">{sub}</p>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────
// Quick Action Button
// ─────────────────────────────────────────────────────────────

const QAction = ({ icon: Icon, label, sub, iconClass, onClick, primary }) => (
  <button
    onClick={onClick}
    className={cn(
      'group flex items-center gap-3 w-full text-start rounded-xl px-3.5 py-3',
      'transition-all duration-150 cursor-pointer',
      primary
        ? 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-sm shadow-brand-200'
        : 'bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 hover:border-slate-300'
    )}
  >
    <div className={cn(
      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
      primary ? 'bg-white/20' : iconClass
    )}>
      <Icon size={16} className={primary ? 'text-white' : ''} strokeWidth={2} />
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn('text-sm font-semibold leading-tight', primary ? 'text-white' : 'text-slate-800')}>
        {label}
      </p>
      {sub && (
        <p className={cn('text-xs mt-0.5 leading-none', primary ? 'text-white/70' : 'text-slate-400')}>
          {sub}
        </p>
      )}
    </div>
    <ChevronRight size={14} className={cn('shrink-0 transition-transform duration-150 group-hover:translate-x-0.5', primary ? 'text-white/60' : 'text-slate-300')} />
  </button>
);

// ─────────────────────────────────────────────────────────────
// Mini section header
// ─────────────────────────────────────────────────────────────

const SectionHead = ({ title, action, onAction }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
    {action && (
      <button
        onClick={onAction}
        className="text-xs font-semibold text-brand-600 hover:text-brand-800 cursor-pointer transition-colors flex items-center gap-0.5"
      >
        {action} <ArrowUpRight size={11} />
      </button>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const { data: settingsData } = useQuery({
    queryKey:  ['shop-settings'],
    queryFn:   settingsAPI.getSettings,
    staleTime: 5 * 60 * 1000,
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn:  dashAPI.getSummary,
  });

  const { data: pending, isLoading: loadingPending } = useQuery({
    queryKey: ['pending-orders'],
    queryFn:  () => dashAPI.getPendingOrders(10),
  });

  const { data: topProducts, isLoading: loadingTop } = useQuery({
    queryKey: ['top-products'],
    queryFn:  () => dashAPI.getTopProducts(5),
  });

  const { data: stockAlerts } = useQuery({
    queryKey:        ['stock-alerts'],
    queryFn:         invAPI.getAlerts,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: expSummary } = useQuery({
    queryKey: ['expense-summary-dash'],
    queryFn:  () => expAPI.getSummary({ from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0] }),
    staleTime: 2 * 60 * 1000,
  });

  const shop     = settingsData?.data     ?? {};
  const s        = summary?.data          ?? {};
  const alerts   = stockAlerts?.data ?? [];
  const critical  = alerts.filter((a) => a.alert_level === 'critical');
  const billsToday    = Number(s.today_bill_count)   || 0;
  const billsThisMonth = Number(s.month_bill_count)  || 0;
  const pendingCount  = Number(s.pending_count)      || 0;
  const inProgCount   = Number(s.in_progress_count)  || 0;

  const monthExpenses  = parseFloat(expSummary?.data?.this_month || 0);
  const monthRevenue   = parseFloat(s.month_sales || 0);
  const monthNetProfit = monthRevenue - monthExpenses;

  const orders = pending?.data || [];
  const products = topProducts?.data || [];

  // Max revenue for relative bar widths in top products
  const maxRevenue = products.length ? parseFloat(products[0]?.total_revenue || 0) : 1;

  return (
    <div className="space-y-5">

      {/* ── Critical Stock Banner ─────────────────────────────── */}
      {critical.length > 0 && (
        <div
          onClick={() => navigate('/inventory')}
          className="flex items-center gap-3 px-5 py-3.5 bg-red-600 rounded-2xl cursor-pointer hover:bg-red-700 active:bg-red-800 transition-colors group"
        >
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">
              {critical.length} item{critical.length > 1 ? 's' : ''} at critical stock level
            </p>
            <p className="text-xs text-red-200 mt-0.5">
              {critical.map((c) => c.name).join(', ')} — immediate restock needed
            </p>
          </div>
          <span className="text-xs font-bold text-white/70 group-hover:text-white flex items-center gap-1 shrink-0 transition-colors">
            Manage <ChevronRight size={13} />
          </span>
        </div>
      )}

      {/* ── Hero Banner ───────────────────────────────────────── */}
      <Banner
        shopName={shop.shop_name || 'My Print Shop'}
        tagline={shop.tagline}
        greeting={greeting(t)}
      />

      {/* ── Stat Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <DStat
          title={t('today_revenue')}
          value={formatCurrency(s.today_sales)}
          sub={`${billsToday} ${billsToday === 1 ? t('bills_today') : t('bills_today_pl')}`}
          icon={DollarSign}
          palette="emerald"
          loading={loadingSummary}
          onClick={() => navigate('/reports')}
        />
        <DStat
          title={t('this_month')}
          value={formatCurrency(s.month_sales)}
          sub={`${billsThisMonth} ${t('bills_month')}`}
          icon={TrendingUp}
          palette="brand"
          loading={loadingSummary}
          onClick={() => navigate('/reports')}
        />
        <DStat
          title="Net Profit (Month)"
          value={formatCurrency(monthNetProfit)}
          sub={`${formatCurrency(monthExpenses)} expenses`}
          icon={monthNetProfit >= 0 ? TrendingUp : TrendingDown}
          palette={monthNetProfit >= 0 ? 'emerald' : 'red'}
          loading={loadingSummary}
          onClick={() => navigate('/reports')}
        />
        <DStat
          title={t('active_orders_stat')}
          value={pendingCount + inProgCount}
          sub={`${pendingCount} ${t('pending_label')} · ${inProgCount} ${t('in_progress_label')}`}
          icon={Clock}
          palette="amber"
          loading={loadingSummary}
          onClick={() => navigate('/bills')}
        />
        <DStat
          title={t('outstanding')}
          value={formatCurrency(s.total_outstanding)}
          sub={t('unpaid_all')}
          icon={AlertCircle}
          palette="red"
          loading={loadingSummary}
          onClick={() => navigate('/ledger')}
        />
      </div>

      {/* ── Main content grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── LEFT: Active Orders ─────────────────────────────── */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                <FileText size={14} className="text-brand-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 leading-tight">{t('active_orders')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t('active_orders_sub')}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/bills')}
              className="text-xs font-bold text-brand-600 hover:text-brand-800 cursor-pointer transition-colors flex items-center gap-1"
            >
              {t('view_all')} <ArrowUpRight size={11} />
            </button>
          </div>

          {/* Orders list */}
          {loadingPending ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <CheckCircle size={36} strokeWidth={1.5} className="mb-3 text-emerald-300" />
              <p className="text-sm font-semibold text-slate-500">{t('no_active_orders')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {orders.map((row) => {
                const rem     = parseFloat(row.remaining_balance);
                const overdue = row.due_date && new Date(row.due_date) < new Date();
                return (
                  <button
                    key={row.id}
                    onClick={() => navigate(`/bills/${row.id}`)}
                    className="group w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer text-start"
                  >
                    {/* Bill number chip */}
                    <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg shrink-0 group-hover:bg-brand-100 transition-colors">
                      {row.bill_number}
                    </span>

                    {/* Customer */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
                        {row.customer_name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{row.customer_phone}</p>
                    </div>

                    {/* Status */}
                    <StatusBadge status={row.status} />

                    {/* Amount */}
                    <div className="text-end shrink-0 hidden sm:block">
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(row.total_amount)}</p>
                      <p className={cn('text-xs mt-0.5 font-semibold', rem > 0 ? 'text-red-500' : 'text-emerald-500')}>
                        {rem > 0 ? `−${formatCurrency(rem)}` : `✓ ${t('paid')}`}
                      </p>
                    </div>

                    {/* Due date */}
                    {row.due_date ? (
                      <span className={cn(
                        'text-xs font-semibold shrink-0 hidden md:block',
                        overdue ? 'text-red-500' : 'text-slate-400'
                      )}>
                        {overdue ? '⚠ ' : ''}{formatDate(row.due_date)}
                      </span>
                    ) : (
                      <span className="text-slate-200 text-xs shrink-0 hidden md:block">—</span>
                    )}

                    <ChevronRight size={14} className="text-slate-200 group-hover:text-brand-400 shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Quick Actions — TOP PRIORITY */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <SectionHead title={t('quick_actions')} />
            <div className="space-y-2">
              <QAction
                icon={Plus}
                label={shop.cta_text || t('new_bill')}
                sub={t('create_order')}
                onClick={() => navigate(shop.cta_route || '/bills/new')}
                primary
              />
              <QAction
                icon={Users}
                label={t('add_customer')}
                sub={t('register_client')}
                iconClass="bg-emerald-50 text-emerald-600"
                onClick={() => navigate('/customers')}
              />
              <QAction
                icon={BarChart2}
                label={t('view_reports')}
                sub={t('sales_analytics')}
                iconClass="bg-violet-50 text-violet-600"
                onClick={() => navigate('/reports')}
              />
              <QAction
                icon={Boxes}
                label={t('inventory')}
                sub={t('prices_categories')}
                iconClass="bg-amber-50 text-amber-600"
                onClick={() => navigate('/inventory')}
              />
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <SectionHead
              title={t('top_products')}
              action={t('view_all')}
              onAction={() => navigate('/products')}
            />

            {loadingTop ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-9 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-5">{t('no_sales_yet')}</p>
            ) : (
              <div className="space-y-3">
                {products.map((p, i) => {
                  const pct = maxRevenue > 0
                    ? Math.round((parseFloat(p.total_revenue) / maxRevenue) * 100)
                    : 0;
                  const medals = ['text-amber-400', 'text-slate-400', 'text-amber-600'];
                  return (
                    <div key={p.id}>
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className={cn('text-xs font-black w-4 text-center shrink-0', medals[i] ?? 'text-slate-300')}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate leading-tight">{p.name}</p>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-xs font-black text-emerald-600">{formatCurrency(p.total_revenue)}</p>
                          <p className="text-[10px] text-slate-400">{p.order_count} {t('orders')}</p>
                        </div>
                      </div>
                      {/* Revenue bar */}
                      <div className="ms-6 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', i === 0 ? 'bg-brand-500' : 'bg-slate-300')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stock Alerts */}
          {alerts.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <SectionHead
                title={t('stock_alerts')}
                action={t('manage')}
                onAction={() => navigate('/inventory')}
              />
              <div className="space-y-2.5">
                {alerts.map((item) => {
                  const isCritical = item.alert_level === 'critical';
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                        isCritical
                          ? 'bg-red-50 border-red-100'
                          : 'bg-amber-50 border-amber-100'
                      )}
                    >
                      <div className={cn('w-2 h-2 rounded-full shrink-0', isCritical ? 'bg-red-500' : 'bg-amber-500')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-bold truncate', isCritical ? 'text-red-800' : 'text-amber-800')}>
                          {item.name}
                        </p>
                        <p className={cn('text-[10px] mt-0.5', isCritical ? 'text-red-500' : 'text-amber-600')}>
                          {parseFloat(item.current_stock).toLocaleString()} {item.unit} remaining
                        </p>
                      </div>
                      <span className={cn(
                        'text-[10px] font-black uppercase tracking-wide shrink-0',
                        isCritical ? 'text-red-600' : 'text-amber-600'
                      )}>
                        {isCritical ? t('critical') : t('low')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
