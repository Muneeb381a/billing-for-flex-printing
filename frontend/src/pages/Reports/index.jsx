import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, TrendingUp, Package, Calendar, Users, TrendingDown,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  PageHeader, Card, CardHeader, Table,
} from '../../components/ui/index.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import * as api from '../../api/reports.js';

// ── Date range helpers ─────────────────────────────────────────
const today     = () => new Date().toISOString().split('T')[0];
const daysAgo   = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };
const yearStart  = () => `${new Date().getFullYear()}-01-01`;

const PRESETS = [
  { label: 'Today',      from: today,             to: today },
  { label: 'Last 7d',   from: () => daysAgo(6),  to: today },
  { label: 'Last 30d',  from: () => daysAgo(29), to: today },
  { label: 'This Month', from: monthStart,        to: today },
  { label: 'This Year',  from: yearStart,         to: today },
];

// ── Shared bar chart ───────────────────────────────────────────
const BarChart = ({ data, valueKey, labelKey, color = 'bg-indigo-500', formatVal = (v) => v }) => {
  const max = Math.max(...data.map((d) => parseFloat(d[valueKey] || 0)), 1);
  return (
    <div className="space-y-1.5">
      {data.map((row, i) => {
        const val = parseFloat(row[valueKey] || 0);
        const pct = Math.round((val / max) * 100);
        return (
          <div key={i} className="flex items-center gap-2 group">
            <span className="w-24 text-right text-xs text-gray-400 shrink-0 tabular-nums truncate" title={row[labelKey]}>
              {row[labelKey]}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className={`${color} h-5 rounded-full transition-all duration-300 flex items-center justify-end pr-2`}
                style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
              >
                {pct > 20 && (
                  <span className="text-white text-xs font-medium truncate">{formatVal(val)}</span>
                )}
              </div>
            </div>
            {pct <= 20 && val > 0 && (
              <span className="text-xs text-gray-500 tabular-nums shrink-0">{formatVal(val)}</span>
            )}
          </div>
        );
      })}
      {data.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-6">No data for this period</p>
      )}
    </div>
  );
};

// ── Tab button ─────────────────────────────────────────────────
const Tab = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
    }`}
  >
    <Icon size={15} />
    {label}
  </button>
);

// ── Dual bar: revenue vs expenses ──────────────────────────────
const DualBar = ({ data }) => {
  const maxVal = Math.max(
    ...data.map((d) => Math.max(parseFloat(d.revenue || 0), parseFloat(d.expenses || 0))),
    1
  );
  return (
    <div className="space-y-2">
      {data.map((row, i) => {
        const rev = parseFloat(row.revenue  || 0);
        const exp = parseFloat(row.expenses || 0);
        const pR  = Math.round((rev / maxVal) * 100);
        const pE  = Math.round((exp / maxVal) * 100);
        const label = new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        return (
          <div key={i} className="grid grid-cols-[80px_1fr_1fr_90px] gap-2 items-center">
            <span className="text-xs text-gray-400 text-right tabular-nums">{label}</span>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-4 rounded-full" style={{ width: `${pR}%` }} />
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="bg-red-400 h-4 rounded-full" style={{ width: `${pE}%` }} />
            </div>
            <span className={`text-xs font-semibold text-right tabular-nums ${parseFloat(row.profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {parseFloat(row.profit) >= 0 ? '+' : ''}{formatCurrency(row.profit)}
            </span>
          </div>
        );
      })}
      {data.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-6">No data for this period</p>
      )}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────
const Reports = () => {
  const navigate = useNavigate();

  const [preset, setPreset] = useState(2);
  const [from,   setFrom]   = useState(() => PRESETS[2].from());
  const [to,     setTo]     = useState(() => today());
  const [tab,    setTab]    = useState('daily');
  const [months, setMonths] = useState(12);

  const rangeParams = { from, to };

  const { data: summaryData } = useQuery({
    queryKey: ['reports-summary', from, to],
    queryFn:  () => api.getSummary(rangeParams),
  });

  const { data: dailyData,    isLoading: loadingDaily    } = useQuery({
    queryKey: ['reports-daily', from, to],
    queryFn:  () => api.getDaily(rangeParams),
    enabled:  tab === 'daily',
  });

  const { data: monthlyData,  isLoading: loadingMonthly  } = useQuery({
    queryKey: ['reports-monthly', months],
    queryFn:  () => api.getMonthly({ months }),
    enabled:  tab === 'monthly',
  });

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['reports-products', from, to],
    queryFn:  () => api.getTopProducts({ ...rangeParams, limit: 15 }),
    enabled:  tab === 'products',
  });

  const { data: customersData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['reports-customers', from, to],
    queryFn:  () => api.getTopCustomers({ ...rangeParams, limit: 15 }),
    enabled:  tab === 'customers',
  });

  const { data: plData, isLoading: loadingPL } = useQuery({
    queryKey: ['reports-pl', from, to],
    queryFn:  () => api.getProfitLoss(rangeParams),
    enabled:  tab === 'pl',
  });

  const summary   = summaryData?.data  || {};
  const daily     = useMemo(() => (dailyData?.data || []).map((r) => ({
    ...r,
    label: new Date(r.sale_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  })), [dailyData]);
  const monthly   = monthlyData?.data  || [];
  const products  = productsData?.data || [];
  const customers = customersData?.data || [];
  const pl        = plData?.data || {};

  const applyPreset = (i) => {
    setPreset(i);
    setFrom(PRESETS[i].from());
    setTo(PRESETS[i].to());
  };

  const monthlyMax = useMemo(() =>
    Math.max(...monthly.map((r) => parseFloat(r.total_sales || 0)), 1),
  [monthly]);

  const productCols = [
    { key: 'name',          header: 'Product',  render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'category_name', header: 'Category', render: (r) => <span className="text-gray-500">{r.category_name}</span> },
    { key: 'order_count',   header: 'Orders',   headerClassName: 'text-right', render: (r) => <span className="block text-right">{r.order_count}</span> },
    { key: 'total_qty',     header: 'Qty',      headerClassName: 'text-right', render: (r) => <span className="block text-right">{Number(r.total_qty).toLocaleString()}</span> },
    { key: 'total_revenue', header: 'Revenue',  headerClassName: 'text-right',
      render: (r) => <span className="block text-right font-semibold text-indigo-700">{formatCurrency(r.total_revenue)}</span> },
  ];

  const customerCols = [
    {
      key: 'customer_name', header: 'Customer',
      render: (r) => (
        <button
          onClick={() => navigate(`/customers/${r.id}/ledger`)}
          className="font-medium text-indigo-600 hover:underline text-left"
        >
          {r.customer_name}
        </button>
      ),
    },
    { key: 'customer_phone', header: 'Phone', render: (r) => <span className="text-gray-500 font-mono text-xs">{r.customer_phone}</span> },
    { key: 'bill_count',     header: 'Bills',  headerClassName: 'text-right', render: (r) => <span className="block text-right">{r.bill_count}</span> },
    { key: 'total_billed',   header: 'Total Billed', headerClassName: 'text-right',
      render: (r) => <span className="block text-right font-semibold">{formatCurrency(r.total_billed)}</span> },
    { key: 'total_paid',     header: 'Paid', headerClassName: 'text-right',
      render: (r) => <span className="block text-right text-emerald-600 font-medium">{formatCurrency(r.total_paid)}</span> },
    { key: 'total_outstanding', header: 'Outstanding', headerClassName: 'text-right',
      render: (r) => {
        const amt = parseFloat(r.total_outstanding);
        return <span className={`block text-right font-semibold ${amt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {amt > 0 ? formatCurrency(amt) : 'Cleared ✓'}
        </span>;
      },
    },
    { key: 'avg_bill', header: 'Avg Bill', headerClassName: 'text-right',
      render: (r) => <span className="block text-right text-gray-500">{formatCurrency(r.avg_bill)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Sales analytics and performance overview" />

      {/* Date range controls */}
      <Card>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => applyPreset(i)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                preset === i
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date" value={from} max={to}
              onChange={(e) => { setFrom(e.target.value); setPreset(-1); }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date" value={to} min={from}
              onChange={(e) => { setTo(e.target.value); setPreset(-1); }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales',    value: formatCurrency(summary.total_sales),     color: 'text-indigo-700' },
          { label: 'Bills Created',  value: Number(summary.bill_count || 0).toString(), color: 'text-gray-900' },
          { label: 'Avg Bill Value', value: formatCurrency(summary.avg_bill),        color: 'text-gray-900' },
          { label: 'Outstanding',    value: formatCurrency(summary.total_outstanding), color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="text-center py-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending',     value: summary.pending_count     || 0, color: 'bg-yellow-100 text-yellow-700' },
          { label: 'In Progress', value: summary.in_progress_count || 0, color: 'bg-blue-100 text-blue-700' },
          { label: 'Delivered',   value: summary.delivered_count   || 0, color: 'bg-green-100 text-green-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl px-4 py-3 text-center ${color}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
            <p className="text-3xl font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-50 rounded-xl p-1 w-fit border border-gray-100">
        <Tab active={tab === 'daily'}     onClick={() => setTab('daily')}     icon={BarChart2}    label="Daily Sales" />
        <Tab active={tab === 'monthly'}   onClick={() => setTab('monthly')}   icon={Calendar}     label="Monthly" />
        <Tab active={tab === 'products'}  onClick={() => setTab('products')}  icon={Package}      label="Top Products" />
        <Tab active={tab === 'customers'} onClick={() => setTab('customers')} icon={Users}        label="Top Customers" />
        <Tab active={tab === 'pl'}        onClick={() => setTab('pl')}        icon={TrendingDown} label="Profit & Loss" />
      </div>

      {/* ── Daily tab ── */}
      {tab === 'daily' && (
        <Card>
          <CardHeader
            title="Daily Sales"
            subtitle={`${from} → ${to} · ${daily.length} days with activity`}
          />
          {loadingDaily ? (
            <div className="py-10 text-center text-gray-400">Loading…</div>
          ) : (
            <BarChart data={daily} valueKey="total_sales" labelKey="label" color="bg-indigo-500" formatVal={formatCurrency} />
          )}
        </Card>
      )}

      {/* ── Monthly tab ── */}
      {tab === 'monthly' && (
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <CardHeader title="Monthly Breakdown" subtitle="Last N months" />
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none"
            >
              {[3, 6, 12, 24].map((m) => (
                <option key={m} value={m}>Last {m} months</option>
              ))}
            </select>
          </div>
          {loadingMonthly ? (
            <div className="py-10 text-center text-gray-400">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Month', 'Bills', 'Revenue', 'Collected', 'Outstanding', ''].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthly.map((row) => {
                    const pct = Math.round((parseFloat(row.total_sales) / monthlyMax) * 100);
                    return (
                      <tr key={row.month} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">
                          {new Date(row.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{row.bill_count}</td>
                        <td className="px-5 py-3 font-semibold text-gray-900">{formatCurrency(row.total_sales)}</td>
                        <td className="px-5 py-3 text-green-600">{formatCurrency(row.total_collected)}</td>
                        <td className="px-5 py-3 text-red-500">{formatCurrency(row.total_outstanding)}</td>
                        <td className="px-5 py-3 w-28">
                          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {monthly.length === 0 && (
                <div className="py-10 text-center text-gray-400 text-sm">No data</div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Top Products tab ── */}
      {tab === 'products' && (
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3">
            <CardHeader title="Top Products" subtitle={`By revenue · ${from} → ${to}`} />
          </div>
          {loadingProducts ? (
            <div className="py-10 text-center text-gray-400">Loading…</div>
          ) : (
            <>
              {products.length > 0 && (
                <div className="px-5 pb-4">
                  <BarChart
                    data={products.slice(0, 10)}
                    valueKey="total_revenue"
                    labelKey="name"
                    color="bg-violet-500"
                    formatVal={formatCurrency}
                  />
                </div>
              )}
              <Table columns={productCols} data={products} emptyMessage="No product data for this period" />
            </>
          )}
        </Card>
      )}

      {/* ── Top Customers tab ── */}
      {tab === 'customers' && (
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3">
            <CardHeader
              title="Top Customers"
              subtitle={`By revenue · ${from} → ${to} · click a name to open ledger`}
            />
          </div>
          {loadingCustomers ? (
            <div className="py-10 text-center text-gray-400">Loading…</div>
          ) : (
            <>
              {customers.length > 0 && (
                <div className="px-5 pb-4">
                  <BarChart
                    data={customers.slice(0, 10).map((c) => ({ ...c, label: c.customer_name.split(' ')[0] }))}
                    valueKey="total_billed"
                    labelKey="label"
                    color="bg-emerald-500"
                    formatVal={formatCurrency}
                  />
                </div>
              )}
              <Table columns={customerCols} data={customers} emptyMessage="No customer data for this period" />
            </>
          )}
        </Card>
      )}

      {/* ── Profit & Loss tab ── */}
      {tab === 'pl' && (
        <div className="space-y-4">
          {loadingPL ? (
            <Card><div className="py-10 text-center text-gray-400">Loading…</div></Card>
          ) : (
            <>
              {/* P&L summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="text-center py-4">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp size={13} className="text-indigo-500" />
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Revenue</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-700">{formatCurrency(pl.total_revenue)}</p>
                  <p className="text-xs text-gray-400 mt-1">{pl.bill_count} bills</p>
                </Card>
                <Card className="text-center py-4">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingDown size={13} className="text-red-500" />
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Expenses</p>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(pl.total_expenses)}</p>
                  <p className="text-xs text-gray-400 mt-1">{pl.expense_count} entries</p>
                </Card>
                <Card className={`text-center py-4 ${parseFloat(pl.gross_profit) >= 0 ? 'ring-2 ring-emerald-200' : 'ring-2 ring-red-200'}`}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {parseFloat(pl.gross_profit) >= 0
                      ? <ArrowUpRight size={13} className="text-emerald-500" />
                      : <ArrowDownRight size={13} className="text-red-500" />}
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Net Profit</p>
                  </div>
                  <p className={`text-2xl font-bold ${parseFloat(pl.gross_profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {parseFloat(pl.gross_profit) >= 0 ? '+' : ''}{formatCurrency(pl.gross_profit)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {pl.profit_margin}% margin
                  </p>
                </Card>
                <Card className="text-center py-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Collected</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(pl.total_collected)}</p>
                  <p className="text-xs text-red-400 mt-1">
                    {formatCurrency(pl.total_outstanding)} outstanding
                  </p>
                </Card>
              </div>

              {/* Daily P&L chart */}
              {(pl.daily || []).length > 0 && (
                <Card>
                  <CardHeader
                    title="Daily Revenue vs Expenses"
                    subtitle="Blue = revenue · Red = expenses · Right = net profit"
                  />
                  <div className="mt-1">
                    <DualBar data={pl.daily || []} />
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Revenue
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Expenses
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Net Profit
                    </span>
                  </div>
                </Card>
              )}

              {/* P&L detail table */}
              {(pl.daily || []).length > 0 && (
                <Card padding={false}>
                  <div className="px-5 pt-5 pb-3">
                    <CardHeader title="Daily Breakdown" subtitle="Day-by-day profit & loss" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {['Date', 'Revenue', 'Expenses', 'Net Profit'].map((h) => (
                            <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(pl.daily || []).map((row) => {
                          const profit = parseFloat(row.profit);
                          return (
                            <tr key={row.date} className="hover:bg-gray-50">
                              <td className="px-5 py-3 text-gray-600">{formatDate(row.date)}</td>
                              <td className="px-5 py-3 text-indigo-700 font-medium">{formatCurrency(row.revenue)}</td>
                              <td className="px-5 py-3 text-red-500">{formatCurrency(row.expenses)}</td>
                              <td className={`px-5 py-3 font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {(pl.daily || []).length === 0 && (
                <Card>
                  <p className="text-center text-gray-400 py-8 text-sm">No activity in this period</p>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
