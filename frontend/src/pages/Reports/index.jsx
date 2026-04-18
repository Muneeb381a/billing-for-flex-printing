import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, Package, Calendar } from 'lucide-react';
import {
  PageHeader, Card, CardHeader, Table,
} from '../../components/ui/index.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import * as api from '../../api/reports.js';

// ── Date range presets ─────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};
const yearStart = () => `${new Date().getFullYear()}-01-01`;

const PRESETS = [
  { label: 'Today',      from: today,      to: today },
  { label: 'Last 7d',    from: () => daysAgo(6),   to: today },
  { label: 'Last 30d',   from: () => daysAgo(29),  to: today },
  { label: 'This Month', from: monthStart, to: today },
  { label: 'This Year',  from: yearStart,  to: today },
];

// ── Tiny CSS bar chart ─────────────────────────────────────────
const BarChart = ({ data, valueKey, labelKey, color = 'bg-indigo-500', formatVal = (v) => v }) => {
  const max = Math.max(...data.map((d) => parseFloat(d[valueKey] || 0)), 1);
  return (
    <div className="space-y-1.5">
      {data.map((row, i) => {
        const val  = parseFloat(row[valueKey] || 0);
        const pct  = Math.round((val / max) * 100);
        return (
          <div key={i} className="flex items-center gap-2 group">
            <span className="w-20 text-right text-xs text-gray-400 shrink-0 tabular-nums">{row[labelKey]}</span>
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

// ── Main page ──────────────────────────────────────────────────
const Reports = () => {
  const [preset, setPreset]   = useState(2);   // default: Last 30d
  const [from,   setFrom]     = useState(() => PRESETS[2].from());
  const [to,     setTo]       = useState(() => today());
  const [tab,    setTab]      = useState('daily');
  const [months, setMonths]   = useState(12);

  const rangeParams = { from, to };

  const { data: summaryData } = useQuery({
    queryKey: ['reports-summary', from, to],
    queryFn:  () => api.getSummary(rangeParams),
  });

  const { data: dailyData, isLoading: loadingDaily } = useQuery({
    queryKey: ['reports-daily', from, to],
    queryFn:  () => api.getDaily(rangeParams),
    enabled:  tab === 'daily',
  });

  const { data: monthlyData, isLoading: loadingMonthly } = useQuery({
    queryKey: ['reports-monthly', months],
    queryFn:  () => api.getMonthly({ months }),
    enabled:  tab === 'monthly',
  });

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['reports-products', from, to],
    queryFn:  () => api.getTopProducts({ ...rangeParams, limit: 15 }),
    enabled:  tab === 'products',
  });

  const summary = summaryData?.data || {};
  const daily   = useMemo(() => (dailyData?.data || []).map((r) => ({
    ...r,
    label: new Date(r.sale_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  })), [dailyData]);
  const monthly = monthlyData?.data || [];
  const products = productsData?.data || [];

  const applyPreset = (i) => {
    setPreset(i);
    setFrom(PRESETS[i].from());
    setTo(PRESETS[i].to());
  };

  const monthlyMax = useMemo(() => Math.max(...monthly.map((r) => parseFloat(r.total_sales || 0)), 1), [monthly]);

  const productCols = [
    { key: 'name',           header: 'Product',  render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'category_name',  header: 'Category', render: (r) => <span className="text-gray-500">{r.category_name}</span> },
    { key: 'order_count',    header: 'Orders',   headerClassName: 'text-right', render: (r) => <span className="block text-right">{r.order_count}</span> },
    { key: 'total_qty',      header: 'Qty',      headerClassName: 'text-right', render: (r) => <span className="block text-right">{Number(r.total_qty).toLocaleString()}</span> },
    {
      key: 'total_revenue', header: 'Revenue',
      headerClassName: 'text-right',
      render: (r) => <span className="block text-right font-semibold text-indigo-700">{formatCurrency(r.total_revenue)}</span>,
    },
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
              type="date"
              value={from}
              max={to}
              onChange={(e) => { setFrom(e.target.value); setPreset(-1); }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => { setTo(e.target.value); setPreset(-1); }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales',    value: formatCurrency(summary.total_sales),    color: 'text-indigo-700' },
          { label: 'Bills Created',  value: Number(summary.bill_count || 0).toString(), color: 'text-gray-900' },
          { label: 'Avg Bill Value', value: formatCurrency(summary.avg_bill),       color: 'text-gray-900' },
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
      <div className="flex gap-1 bg-gray-50 rounded-xl p-1 w-fit border border-gray-100">
        <Tab active={tab === 'daily'}    onClick={() => setTab('daily')}    icon={BarChart2}   label="Daily Sales" />
        <Tab active={tab === 'monthly'}  onClick={() => setTab('monthly')}  icon={Calendar}    label="Monthly" />
        <Tab active={tab === 'products'} onClick={() => setTab('products')} icon={Package}     label="Top Products" />
      </div>

      {/* Daily chart */}
      {tab === 'daily' && (
        <Card>
          <CardHeader
            title="Daily Sales"
            subtitle={`${from} → ${to} · ${daily.length} days with activity`}
          />
          {loadingDaily ? (
            <div className="py-10 text-center text-gray-400">Loading…</div>
          ) : (
            <BarChart
              data={daily}
              valueKey="total_sales"
              labelKey="label"
              color="bg-indigo-500"
              formatVal={(v) => formatCurrency(v)}
            />
          )}
        </Card>
      )}

      {/* Monthly table + mini chart */}
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

      {/* Top products */}
      {tab === 'products' && (
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3">
            <CardHeader
              title="Top Products"
              subtitle={`By revenue · ${from} → ${to}`}
            />
          </div>
          {loadingProducts ? (
            <div className="py-10 text-center text-gray-400">Loading…</div>
          ) : (
            <>
              {/* Revenue bar chart */}
              {products.length > 0 && (
                <div className="px-5 pb-4">
                  <BarChart
                    data={products.slice(0, 10)}
                    valueKey="total_revenue"
                    labelKey="name"
                    color="bg-violet-500"
                    formatVal={(v) => formatCurrency(v)}
                  />
                </div>
              )}
              <Table columns={productCols} data={products} emptyMessage="No product data for this period" />
            </>
          )}
        </Card>
      )}
    </div>
  );
};

export default Reports;
