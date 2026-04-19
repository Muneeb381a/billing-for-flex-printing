import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Search, SlidersHorizontal, CheckSquare, X } from 'lucide-react';
import {
  PageHeader, Table, ConfirmDialog, Button, Select, Input,
} from '../../components/ui/index.js';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { formatCurrency, formatDate, STATUS_LABELS } from '../../utils/format.js';
import useDebounce from '../../hooks/useDebounce.js';
import * as api from '../../api/bills.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const BULK_STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'delivered',   label: 'Delivered' },
  { value: 'cancelled',   label: 'Cancelled' },
];

const Bills = () => {
  const navigate  = useNavigate();
  const qc        = useQueryClient();

  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [selected,      setSelected]      = useState(null);
  const [confirmOpen,   setConfirmOpen]   = useState(false);
  const [checkedIds,         setCheckedIds]         = useState(new Set());
  const [bulkStatus,         setBulkStatus]         = useState('');
  const [bulkDeleteConfirm,  setBulkDeleteConfirm]  = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const { data, isLoading } = useQuery({
    queryKey: ['bills', statusFilter, debouncedSearch],
    queryFn:  () => api.getBills({
      status: statusFilter || undefined,
      search: debouncedSearch || undefined,
      limit:  200,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteBill(selected.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill deleted');
      setConfirmOpen(false);
      setSelected(null);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, status }) => api.bulkUpdateStatus(ids, status),
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      toast.success(`${res.data.updated} bill${res.data.updated !== 1 ? 's' : ''} updated`);
      setCheckedIds(new Set());
      setBulkStatus('');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Bulk update failed'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => api.bulkDeleteBills(ids),
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      toast.success(`${res.data.deleted} bill${res.data.deleted !== 1 ? 's' : ''} deleted`);
      setCheckedIds(new Set());
      setBulkStatus('');
      setBulkDeleteConfirm(false);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Bulk delete failed'),
  });

  const bills = data?.data || [];

  const toggleCheck = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allChecked = bills.length > 0 && bills.every((b) => checkedIds.has(b.id));
  const someChecked = checkedIds.size > 0;

  const toggleAll = () => {
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(bills.map((b) => b.id)));
    }
  };

  const applyBulkStatus = () => {
    if (!bulkStatus) return toast.error('Select a status to apply');
    bulkMutation.mutate({ ids: [...checkedIds], status: bulkStatus });
  };

  const columns = [
    {
      key: 'checkbox', header: (
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={checkedIds.has(row.id)}
          onChange={() => toggleCheck(row.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
        />
      ),
    },
    {
      key: 'bill_number', header: 'Bill #',
      render: (row) => (
        <button
          onClick={() => navigate(`/bills/${row.id}`)}
          className="font-mono font-semibold text-indigo-600 hover:text-indigo-800 hover:underline text-left"
        >
          {row.bill_number}
        </button>
      ),
    },
    {
      key: 'customer_name', header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.customer_name}</p>
          <p className="text-xs text-gray-400 font-mono">{row.customer_phone}</p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'total_amount', header: 'Total',
      render: (row) => <span className="font-semibold">{formatCurrency(row.total_amount)}</span>,
    },
    {
      key: 'remaining_balance', header: 'Balance',
      render: (row) => {
        const rem = parseFloat(row.remaining_balance);
        return (
          <span className={rem > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
            {rem > 0 ? formatCurrency(rem) : 'Paid ✓'}
          </span>
        );
      },
    },
    {
      key: 'due_date', header: 'Due',
      render: (row) => {
        if (!row.due_date) return <span className="text-gray-300">—</span>;
        const overdue = new Date(row.due_date) < new Date() && !['delivered', 'cancelled'].includes(row.status);
        return (
          <span className={overdue ? 'text-red-500 font-medium' : 'text-gray-600'}>
            {formatDate(row.due_date)}
          </span>
        );
      },
    },
    { key: 'created_at', header: 'Created', render: (row) => formatDate(row.created_at) },
    {
      key: 'actions', header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            size="sm" variant="ghost"
            onClick={() => navigate(`/bills/${row.id}`)}
          >
            Open
          </Button>
          <Button
            size="sm" variant="ghost"
            icon={<Trash2 size={14} />}
            onClick={() => { setSelected(row); setConfirmOpen(true); }}
            className="text-red-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          />
        </div>
      ),
    },
  ];

  const isFiltered = !!search || !!statusFilter;

  return (
    <div>
      <PageHeader
        title="Bills & Orders"
        subtitle={
          isFiltered
            ? `${bills.length} result${bills.length !== 1 ? 's' : ''} for current filter`
            : `${bills.length} bill${bills.length !== 1 ? 's' : ''} total`
        }
        action={
          <Button icon={<Plus size={16} />} onClick={() => navigate('/bills/new')}>
            New Bill
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5 text-gray-400">
          <SlidersHorizontal size={15} />
        </div>
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        />
        <div className="flex-1 min-w-48 max-w-72">
          <Input
            placeholder="Search customer, phone, bill #…"
            prefix={<Search size={14} className="text-gray-400" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isFiltered && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); }}
            className="text-xs text-gray-400 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {someChecked && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <CheckSquare size={16} className="text-indigo-600 shrink-0" />
          <span className="text-sm font-medium text-indigo-700">
            {checkedIds.size} selected
          </span>
          <div className="flex-1" />
          <Select
            options={[{ value: '', label: 'Change status to…' }, ...BULK_STATUS_OPTIONS]}
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="w-48"
          />
          <Button size="sm" loading={bulkMutation.isPending} onClick={applyBulkStatus}>
            Apply
          </Button>
          <Button
            size="sm" variant="ghost"
            icon={<Trash2 size={13} />}
            loading={bulkDeleteMutation.isPending}
            onClick={() => setBulkDeleteConfirm(true)}
            className="text-red-500 hover:bg-red-50 border border-red-200"
          >
            Delete
          </Button>
          <button
            onClick={() => { setCheckedIds(new Set()); setBulkStatus(''); }}
            className="p-1 rounded-lg text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <Table
        columns={columns}
        data={bills}
        loading={isLoading}
        emptyMessage={
          isFiltered
            ? 'No bills match your search or filter.'
            : 'No bills yet. Create your first bill.'
        }
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => { setConfirmOpen(false); setSelected(null); }}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title={`Delete ${selected?.bill_number}?`}
        message="This permanently deletes the bill and all its items. Payments already recorded will also be removed."
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={() => bulkDeleteMutation.mutate([...checkedIds])}
        loading={bulkDeleteMutation.isPending}
        title={`Delete ${checkedIds.size} bill${checkedIds.size !== 1 ? 's' : ''}?`}
        message="This permanently deletes all selected bills and their items. This cannot be undone."
      />
    </div>
  );
};

export default Bills;
