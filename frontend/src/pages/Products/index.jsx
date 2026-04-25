import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import {
  PageHeader, Table, Modal, ConfirmDialog, Button, Select, Input,
} from '../../components/ui/index.js';
import Badge from '../../components/ui/Badge.jsx';
import { PRICING_MODEL_LABELS, formatCurrency } from '../../utils/format.js';
import * as api from '../../api/products.js';
import * as catApi from '../../api/categories.js';
import * as subcatApi from '../../api/subcategories.js';
import ProductForm from './ProductForm.jsx';

// ── Subcategory inline form ────────────────────────────────────
const SubcategoryForm = ({ subcat, categories, onSuccess }) => {
  const isEdit = Boolean(subcat);
  const qc = useQueryClient();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      categoryId:  subcat?.category_id  || '',
      name:        subcat?.name         || '',
      description: subcat?.description  || '',
      sortOrder:   subcat?.sort_order   || 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? subcatApi.updateSubcategory(subcat.id, data)
      : subcatApi.createSubcategory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subcategories'] });
      toast.success(isEdit ? 'Subcategory updated!' : 'Subcategory created!');
      onSuccess?.();
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || 'Failed to save';
      toast.error(msg);
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <Select
        label="Category"
        required
        options={categories}
        placeholder="Select category…"
        error={errors.categoryId?.message}
        {...register('categoryId', { required: 'Category is required' })}
      />
      <Input
        label="Name"
        placeholder="e.g. Star Flex"
        required
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })}
      />
      <Input label="Description" placeholder="Optional" {...register('description')} />
      <Input label="Sort Order" type="number" min="0" {...register('sortOrder', { valueAsNumber: true })} />
      <Button type="submit" loading={mutation.isPending} className="w-full">
        {isEdit ? 'Save Changes' : 'Add Subcategory'}
      </Button>
    </form>
  );
};

// ── Main Page ──────────────────────────────────────────────────
const Products = () => {
  const [tab,            setTab]            = useState('products');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modal,          setModal]          = useState(null);
  const [selected,       setSelected]       = useState(null);
  const qc = useQueryClient();

  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: catApi.getCategories });
  const categories = (catData?.data || []).map((c) => ({ value: c.id, label: c.name }));

  // Products
  const { data: prodData, isLoading: prodLoading } = useQuery({
    queryKey: ['products', categoryFilter],
    queryFn:  () => api.getProducts({ category_id: categoryFilter || undefined, active_only: false }),
  });
  const products = prodData?.data || [];

  // Subcategories
  const { data: subcatData, isLoading: subcatLoading } = useQuery({
    queryKey: ['subcategories', categoryFilter],
    queryFn:  () => subcatApi.getSubcategories({ category_id: categoryFilter || undefined }),
  });
  const subcategories = subcatData?.data || [];

  const deleteProdMutation = useMutation({
    mutationFn: () => api.deleteProduct(selected.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product deleted'); closeModal(); },
  });

  const deleteSubcatMutation = useMutation({
    mutationFn: () => subcatApi.deleteSubcategory(selected.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['subcategories'] }); toast.success('Subcategory deleted'); closeModal(); },
  });

  const closeModal = () => { setModal(null); setSelected(null); };

  const productColumns = [
    {
      key: 'name', header: 'Product',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          {row.description && <p className="text-xs text-gray-400 truncate max-w-48">{row.description}</p>}
        </div>
      ),
    },
    { key: 'category_name', header: 'Category',
      render: (row) => <Badge variant="indigo">{row.category_name}</Badge> },
    { key: 'subcategory_name', header: 'Subcategory',
      render: (row) => row.subcategory_name
        ? <Badge variant="blue">{row.subcategory_name}</Badge>
        : <span className="text-gray-300 text-xs">—</span> },
    { key: 'pricing_model', header: 'Pricing',
      render: (row) => <span className="text-xs text-gray-600">{PRICING_MODEL_LABELS[row.pricing_model]}</span> },
    { key: 'base_price', header: 'Base Price',
      render: (row) => row.base_price ? `${formatCurrency(row.base_price)} / ${row.unit}` : '—' },
    { key: 'is_active', header: 'Status',
      render: (row) => <Badge variant={row.is_active ? 'green' : 'gray'}>{row.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" icon={<Pencil size={14} />}
            onClick={() => { setSelected(row); setModal('edit-product'); }} />
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />}
            onClick={() => { setSelected(row); setModal('delete-product'); }}
            className="text-red-500 hover:bg-red-50" />
        </div>
      ),
    },
  ];

  const subcatColumns = [
    { key: 'name', header: 'Name',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
    { key: 'category_name', header: 'Category',
      render: (row) => <Badge variant="indigo">{row.category_name}</Badge> },
    { key: 'description', header: 'Description',
      render: (row) => <span className="text-xs text-gray-500">{row.description || '—'}</span> },
    { key: 'product_count', header: 'Products',
      render: (row) => <span className="text-sm text-gray-600">{row.product_count ?? 0}</span> },
    { key: 'sort_order', header: 'Order',
      render: (row) => <span className="text-xs text-gray-400">{row.sort_order}</span> },
    { key: 'is_active', header: 'Status',
      render: (row) => <Badge variant={row.is_active ? 'green' : 'gray'}>{row.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: '',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" icon={<Pencil size={14} />}
            onClick={() => { setSelected(row); setModal('edit-subcat'); }} />
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />}
            onClick={() => { setSelected(row); setModal('delete-subcat'); }}
            className="text-red-500 hover:bg-red-50" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={tab === 'products'
          ? `${products.length} product${products.length !== 1 ? 's' : ''}`
          : `${subcategories.length} subcategor${subcategories.length !== 1 ? 'ies' : 'y'}`}
        action={
          tab === 'products'
            ? <Button icon={<Plus size={16} />} onClick={() => setModal('add-product')}>Add Product</Button>
            : <Button icon={<Plus size={16} />} onClick={() => setModal('add-subcat')}>Add Subcategory</Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'products',      label: 'Products'      }
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="mb-4 max-w-xs">
        <Select
          placeholder="All Categories"
          options={categories}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        />
      </div>

      {tab === 'products' && (
        <Table
          columns={productColumns}
          data={products}
          loading={prodLoading}
          emptyMessage="No products found."
        />
      )}

      {tab === 'subcategories' && (
        <Table
          columns={subcatColumns}
          data={subcategories}
          loading={subcatLoading}
          emptyMessage="No subcategories found."
        />
      )}

      {/* Product modals */}
      <Modal isOpen={modal === 'add-product'} onClose={closeModal} title="Add Product" size="lg">
        <ProductForm onSuccess={closeModal} />
      </Modal>
      <Modal isOpen={modal === 'edit-product'} onClose={closeModal} title="Edit Product" size="lg">
        <ProductForm product={selected} onSuccess={closeModal} />
      </Modal>
      <ConfirmDialog
        isOpen={modal === 'delete-product'}
        onClose={closeModal}
        onConfirm={() => deleteProdMutation.mutate()}
        loading={deleteProdMutation.isPending}
        title={`Delete "${selected?.name}"?`}
        message="This will remove the product and its pricing rules."
      />

      {/* Subcategory modals */}
      <Modal isOpen={modal === 'add-subcat'} onClose={closeModal} title="Add Subcategory">
        <SubcategoryForm categories={categories} onSuccess={closeModal} />
      </Modal>
      <Modal isOpen={modal === 'edit-subcat'} onClose={closeModal} title="Edit Subcategory">
        <SubcategoryForm subcat={selected} categories={categories} onSuccess={closeModal} />
      </Modal>
      <ConfirmDialog
        isOpen={modal === 'delete-subcat'}
        onClose={closeModal}
        onConfirm={() => deleteSubcatMutation.mutate()}
        loading={deleteSubcatMutation.isPending}
        title={`Delete "${selected?.name}"?`}
        message="Products in this subcategory will lose their subcategory link."
      />
    </div>
  );
};

export default Products;
