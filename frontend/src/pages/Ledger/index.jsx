import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
  PageHeader, Table, Button, Card, Input,
} from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import * as api from '../../api/dashboard.js';

const Ledger = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ledger'],
    queryFn:  api.getLedger,
  });

  const rows = data?.data || [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      r.customer_name.toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    billed:      acc.billed      + parseFloat(r.total_billed       || 0),
    paid:        acc.paid        + parseFloat(r.total_paid         || 0),
    outstanding: acc.outstanding + parseFloat(r.outstanding_balance || 0),
  }), { billed: 0, paid: 0, outstanding: 0 }), [rows]);

  const columns = [
    {
      key: 'customer_name', header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.customer_name}</p>
          <p className="text-xs text-gray-400 font-mono">{row.phone}</p>
        </div>
      ),
    },
    {
      key: 'total_bills', header: 'Bills',
      headerClassName: 'text-center',
      render: (row) => (
        <span className="block text-center text-gray-600 font-medium">{row.total_bills}</span>
      ),
    },
    {
      key: 'total_billed', header: 'Total Billed',
      render: (row) => <span className="font-medium">{formatCurrency(row.total_billed)}</span>,
    },
    {
      key: 'total_paid', header: 'Paid',
      render: (row) => <span className="text-green-600 font-medium">{formatCurrency(row.total_paid)}</span>,
    },
    {
      key: 'outstanding_balance', header: 'Outstanding',
      render: (row) => {
        const out = parseFloat(row.outstanding_balance);
        return (
          <span className={`font-bold ${out > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(out)}
          </span>
        );
      },
    },
    {
      key: 'actions', header: '',
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => navigate(`/customers/${row.customer_id}/ledger`)}>
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Customer Ledger" subtitle="Outstanding balances across all customers" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total Billed',      value: formatCurrency(totals.billed),      color: 'text-gray-900' },
          { label: 'Total Collected',   value: formatCurrency(totals.paid),         color: 'text-green-600' },
          { label: 'Total Outstanding', value: formatCurrency(totals.outstanding),  color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="text-center py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 max-w-xs">
        <Input
          placeholder="Search customer…"
          prefix={<Search size={14} className="text-gray-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Table
        columns={columns}
        data={filtered}
        loading={isLoading}
        emptyMessage={search ? 'No customers match your search' : 'No ledger data found'}
      />
    </div>
  );
};

export default Ledger;
