import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  PageHeader, Table, Modal, ConfirmDialog, Button, Select,
} from '../../components/ui/index.js';
import Badge from '../../components/ui/Badge.jsx';
import { PRICING_MODEL_LABELS, formatCurrency } from '../../utils/format.js';
import * as api from '../../api/products.js';
import * as catApi from '../../api/categories.js';
import ProductForm from './ProductForm.jsx';

const Products = () => {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modal, setModal]   = useState(null);
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: catApi.getCategories });
  const { data, isLoading } = useQuery({
    queryKey: ['products', categoryFilter],
    queryFn:  () => api.getProducts({ category_id: categoryFilter || undefined, active_only: false }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProduct(selected.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
      setModal(null); setSelected(null);
    },
  });

  const categories = (catData?.data || []).map((c) => ({ value: c.id, label: c.name }));
  const products   = data?.data || [];

  const columns = [
    {
      key: 'name', header: 'Product',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          {row.description && <p className="text-xs text-gray-400 truncate max-w-48">{row.description}</p>}
        </div>
      ),
    },
    { key: 'category_name', header: 'Category', render: (row) => (
      <Badge variant="indigo">{row.category_name}</Badge>
    )},
    {
      key: 'pricing_model', header: 'Pricing Model',
      render: (row) => (
        <span className="text-xs text-gray-600">{PRICING_MODEL_LABELS[row.pricing_model]}</span>
      ),
    },
    {
      key: 'base_price', header: 'Base Price',
      render: (row) => row.base_price ? `${formatCurrency(row.base_price)} / ${row.unit}` : '—',
    },
    {
      key: 'is_active', header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'green' : 'gray'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions', header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" icon={<Pencil size={14} />}
            onClick={() => { setSelected(row); setModal('edit'); }} />
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />}
            onClick={() => { setSelected(row); setModal('delete'); }}
            className="text-red-500 hover:bg-red-50" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${products.length} product${products.length !== 1 ? 's' : ''}`}
        action={
          <Button icon={<Plus size={16} />} onClick={() => setModal('add')}>
            Add Product
          </Button>
        }
      />

      {/* Filter */}
      <div className="mb-4 max-w-xs">
        <Select
          placeholder="All Categories"
          options={categories}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        />
      </div>

      <Table
        columns={columns}
        data={products}
        loading={isLoading}
        emptyMessage="No products found."
      />

      <Modal isOpen={modal === 'add'}  onClose={() => { setModal(null); setSelected(null); }} title="Add Product" size="lg">
        <ProductForm onSuccess={() => { setModal(null); setSelected(null); }} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={() => { setModal(null); setSelected(null); }} title="Edit Product" size="lg">
        <ProductForm product={selected} onSuccess={() => { setModal(null); setSelected(null); }} />
      </Modal>

      <ConfirmDialog
        isOpen={modal === 'delete'}
        onClose={() => { setModal(null); setSelected(null); }}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title={`Delete "${selected?.name}"?`}
        message="This will remove the product and its pricing rules."
      />
    </div>
  );
};

export default Products;
