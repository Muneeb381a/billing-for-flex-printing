import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import {
  PageHeader, Table, Modal, ConfirmDialog, Button, Input,
} from '../../components/ui/index.js';
import { formatDate } from '../../utils/format.js';
import useDebounce from '../../hooks/useDebounce.js';
import * as api from '../../api/customers.js';
import CustomerForm from './CustomerForm.jsx';

const Customers = () => {
  const navigate = useNavigate();
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState(null);  // null | 'add' | 'edit' | 'delete'
  const [selected, setSelected] = useState(null);

  const debouncedSearch = useDebounce(search);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch],
    queryFn:  () => api.getCustomers({ search: debouncedSearch, limit: 100 }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCustomer(selected.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
      setModal(null);
      setSelected(null);
    },
  });

  const openEdit   = (c) => { setSelected(c); setModal('edit'); };
  const openLedger = (c) => navigate(`/customers/${c.id}/ledger`);
  const openDelete = (c) => { setSelected(c); setModal('delete'); };
  const closeModal = ()  => { setModal(null); setSelected(null); };

  const customers = data?.data || [];

  const columns = [
    {
      key: 'name', header: 'Customer',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-400">{row.phone}</p>
        </div>
      ),
    },
    { key: 'email',   header: 'Email',   render: (row) => row.email   || '—' },
    { key: 'address', header: 'Address', render: (row) => row.address || '—', className: 'max-w-48 truncate' },
    { key: 'created_at', header: 'Added', render: (row) => formatDate(row.created_at) },
    {
      key: 'actions', header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" icon={<Eye size={14} />}    onClick={() => openLedger(row)} title="View Ledger" />
          <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => openEdit(row)}   title="Edit" />
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => openDelete(row)} title="Delete"
            className="text-red-500 hover:bg-red-50" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length !== 1 ? 's' : ''}`}
        action={
          <Button icon={<Plus size={16} />} onClick={() => setModal('add')}>
            Add Customer
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<Search size={14} />}
        />
      </div>

      <Table
        columns={columns}
        data={customers}
        loading={isLoading}
        emptyMessage="No customers found. Add your first customer."
      />

      <Modal isOpen={modal === 'add'} onClose={closeModal} title="Add Customer">
        <CustomerForm onSuccess={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Customer">
        <CustomerForm customer={selected} onSuccess={closeModal} />
      </Modal>

      <ConfirmDialog
        isOpen={modal === 'delete'}
        onClose={closeModal}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title={`Delete ${selected?.name}?`}
        message="All bills linked to this customer will be affected. This cannot be undone."
      />
    </div>
  );
};

export default Customers;
