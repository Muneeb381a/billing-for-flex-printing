import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Edit2, Search, TrendingDown, DollarSign, Calendar, Tag,
} from 'lucide-react';
import {
  PageHeader, Card, CardHeader, Table, Button, Input, Select,
  Modal, ConfirmDialog, StatCard,
} from '../../components/ui/index.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import useDebounce from '../../hooks/useDebounce.js';
import * as api from '../../api/expenses.js';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'Rent',          label: 'Rent' },
  { value: 'Utilities',     label: 'Utilities' },
  { value: 'Salaries',      label: 'Salaries' },
  { value: 'Materials',     label: 'Materials' },
  { value: 'Equipment',     label: 'Equipment' },
  { value: 'Maintenance',   label: 'Maintenance' },
  { value: 'Marketing',     label: 'Marketing' },
  { value: 'Transport',     label: 'Transport' },
  { value: 'Miscellaneous', label: 'Miscellaneous' },
];

const PAYMENT_OPTIONS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'online',        label: 'Online' },
];

const FORM_CATEGORIES = CATEGORY_OPTIONS.slice(1);

// ── Expense Form Modal ─────────────────────────────────────────
const ExpenseModal = ({ expense, onClose }) => {
  const qc   = useQueryClient();
  const isEdit = Boolean(expense);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      title:         expense?.title         || '',
      amount:        expense?.amount        || '',
      category:      expense?.category      || '',
      paymentMethod: expense?.payment_method || 'cash',
      expenseDate:   expense?.expense_date   ? expense.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes:         expense?.notes         || '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? api.updateExpense(expense.id, data) : api.createExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
      toast.success(isEdit ? 'Expense updated' : 'Expense recorded');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save expense'),
  });

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Expense' : 'New Expense'}>
      <form onSubmit={handleSubmit(mutation.mutate)} className="space-y-4">
        <Input
          label="Title *"
          placeholder="e.g. Electricity Bill"
          {...register('title', { required: 'Title is required' })}
          error={errors.title?.message}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Amount (PKR) *"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('amount', { required: 'Amount is required', min: { value: 0, message: 'Must be positive' } })}
            error={errors.amount?.message}
          />
          <Input
            label="Date"
            type="date"
            {...register('expenseDate')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            options={FORM_CATEGORIES}
            {...register('category')}
          />
          <Select
            label="Payment Method"
            options={PAYMENT_OPTIONS}
            {...register('paymentMethod')}
          />
        </div>
        <Input
          label="Notes"
          placeholder="Optional description"
          {...register('notes')}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? 'Save Changes' : 'Record Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ── Main Page ──────────────────────────────────────────────────
const Expenses = () => {
  const qc = useQueryClient();

  const [search,       setSearch]       = useState('');
  const [catFilter,    setCatFilter]    = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [confirmId,    setConfirmId]    = useState(null);

  const debouncedSearch = useDebounce(search, 350);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', catFilter, debouncedSearch],
    queryFn:  () => api.getExpenses({
      category: catFilter || undefined,
      search:   debouncedSearch || undefined,
      limit:    200,
    }),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['expense-summary'],
    queryFn:  () => api.getSummary(),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteExpense(confirmId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
      toast.success('Expense deleted');
      setConfirmId(null);
    },
    onError: () => toast.error('Failed to delete'),
  });

  const expenses = data?.data || [];
  const summary  = summaryData?.data || {};

  const columns = [
    {
      key: 'expense_date', header: 'Date',
      render: (row) => <span className="text-sm text-gray-600">{formatDate(row.expense_date)}</span>,
    },
    {
      key: 'title', header: 'Expense',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.title}</p>
          {row.notes && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{row.notes}</p>}
        </div>
      ),
    },
    {
      key: 'category', header: 'Category',
      render: (row) => row.category
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium"><Tag size={10} />{row.category}</span>
        : <span className="text-gray-300 text-xs">—</span>,
    },
    {
      key: 'payment_method', header: 'Payment',
      render: (row) => (
        <span className="text-xs text-gray-500 capitalize">{row.payment_method?.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'amount', header: 'Amount',
      render: (row) => (
        <span className="font-semibold text-red-600">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'actions', header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            size="sm" variant="ghost"
            icon={<Edit2 size={13} />}
            onClick={() => { setEditing(row); setModalOpen(true); }}
            title="Edit"
          />
          <Button
            size="sm" variant="ghost"
            icon={<Trash2 size={13} />}
            onClick={() => setConfirmId(row.id)}
            className="text-red-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          />
        </div>
      ),
    },
  ];

  const isFiltered = !!search || !!catFilter;

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={
          isFiltered
            ? `${expenses.length} result${expenses.length !== 1 ? 's' : ''}`
            : `${expenses.length} expense${expenses.length !== 1 ? 's' : ''} recorded`
        }
        action={
          <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setModalOpen(true); }}>
            New Expense
          </Button>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Today"
          value={formatCurrency(summary.today || 0)}
          icon={Calendar}
          color="amber"
        />
        <StatCard
          title="This Month"
          value={formatCurrency(summary.this_month || 0)}
          icon={TrendingDown}
          color="red"
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(summary.total_expenses || 0)}
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Transactions"
          value={summary.expense_count || 0}
          icon={Tag}
          color="indigo"
        />
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <Select
          options={CATEGORY_OPTIONS}
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="w-44"
        />
        <div className="flex-1 min-w-48 max-w-72">
          <Input
            placeholder="Search expenses…"
            prefix={<Search size={14} className="text-gray-400" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isFiltered && (
          <button
            onClick={() => { setSearch(''); setCatFilter(''); }}
            className="text-xs text-gray-400 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <Table
        columns={columns}
        data={expenses}
        loading={isLoading}
        emptyMessage={
          isFiltered ? 'No expenses match your filter.' : 'No expenses recorded yet.'
        }
      />

      {modalOpen && (
        <ExpenseModal
          expense={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete Expense?"
        message="This expense record will be permanently removed."
      />
    </div>
  );
};

export default Expenses;
