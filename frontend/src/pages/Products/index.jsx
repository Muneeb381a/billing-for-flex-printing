import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  PageHeader, Table, Modal, ConfirmDialog, Button,
} from '../../components/ui/index.js';
import Badge from '../../components/ui/Badge.jsx';
import { formatCurrency } from '../../utils/format.js';
import * as api from '../../api/categories.js';
import CategoryForm from './ProductForm.jsx';

const TYPE_META = {
  area_based:     { label: 'Area (sqft)',   variant: 'indigo'  },
  quantity_based: { label: 'Quantity',      variant: 'emerald' },
  fixed_charge:   { label: 'Fixed Amount',  variant: 'amber'   },
  custom:         { label: 'Custom',        variant: 'gray'    },
};

const MODE_LABEL = {
  per_unit: 'per unit',
  total:    'total price',
};

const Categories = () => {
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => api.getCategories({ admin: 'true' }),
  });

  const categories = data?.data || [];

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCategory(selected.id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category deleted');
      closeModal();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to delete'),
  });

  const closeModal = () => { setModal(null); setSelected(null); };

  const columns = [
    {
      key: 'name', header: 'Category Name',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          {row.description && (
            <p className="text-xs text-slate-400 truncate max-w-64">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'pricing_type', header: 'Type',
      render: (row) => {
        const meta = TYPE_META[row.pricing_type] ?? TYPE_META.custom;
        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            {row.pricing_type === 'quantity_based' && (
              <span className="text-[10px] text-slate-400 font-medium">
                {MODE_LABEL[row.pricing_mode] ?? row.pricing_mode}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'rate', header: 'Default Rate',
      render: (row) => row.rate
        ? (
          <span className="font-mono text-sm font-semibold text-slate-700">
            ₨{parseFloat(row.rate).toLocaleString('en-PK')}
          </span>
        )
        : <span className="text-slate-300 text-xs">—</span>,
    },
    {
      key: 'is_active', header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions', header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            size="sm" variant="ghost" icon={<Pencil size={14} />}
            onClick={() => { setSelected(row); setModal('edit'); }}
          />
          <Button
            size="sm" variant="ghost" icon={<Trash2 size={14} />}
            onClick={() => { setSelected(row); setModal('delete'); }}
            className="text-red-500 hover:bg-red-50"
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle={`${categories.length} categor${categories.length !== 1 ? 'ies' : 'y'} — China Flex, Star Flex, Business Cards…`}
        action={
          <Button icon={<Plus size={16} />} onClick={() => setModal('add')}>
            Add Category
          </Button>
        }
      />

      <Table
        columns={columns}
        data={categories}
        loading={isLoading}
        emptyMessage="No categories yet. Click 'Add Category' to create your first one."
      />

      <Modal isOpen={modal === 'add'} onClose={closeModal} title="Add Category" size="sm">
        <CategoryForm onSuccess={closeModal} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Category" size="sm">
        {selected && <CategoryForm category={selected} onSuccess={closeModal} />}
      </Modal>

      <ConfirmDialog
        isOpen={modal === 'delete'}
        onClose={closeModal}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title={`Delete "${selected?.name}"?`}
        message="Existing bills using this category keep their data. The category will no longer appear when creating new bills."
      />
    </div>
  );
};

export default Categories;
