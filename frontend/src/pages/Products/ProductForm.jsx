import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Input, Select, Button, Textarea } from '../../components/ui/index.js';
import { PRICING_MODEL_LABELS } from '../../utils/format.js';
import * as api from '../../api/products.js';
import * as catApi from '../../api/categories.js';
import * as subcatApi from '../../api/subcategories.js';

const PRICING_MODELS = Object.entries(PRICING_MODEL_LABELS).map(([value, label]) => ({ value, label }));
const UNITS = [
  { value: 'sqft', label: 'Sq. Feet' },
  { value: 'pcs',  label: 'Pieces'   },
  { value: 'set',  label: 'Set'      },
  { value: 'sheet',label: 'Sheet'    },
];

const ProductForm = ({ product, onSuccess }) => {
  const isEdit = Boolean(product);
  const qc     = useQueryClient();
  const [tiers, setTiers] = useState(product?.tiers || []);

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn:  catApi.getCategories,
  });

  const categories = (catData?.data || []).map((c) => ({ value: c.id, label: c.name }));

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      categoryId:    product?.category_id    || '',
      subcategoryId: product?.subcategory_id || '',
      name:          product?.name           || '',
      description:   product?.description    || '',
      pricingModel:  product?.pricing_model  || 'area_based',
      basePrice:     product?.base_price     || '',
      unit:          product?.unit           || 'sqft',
    },
  });

  useEffect(() => { if (product) reset({ ...product, categoryId: product.category_id, subcategoryId: product.subcategory_id || '' }); }, [product, reset]);

  const pricingModel = watch('pricingModel');
  const categoryId   = watch('categoryId');

  const { data: subcatData } = useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn:  () => subcatApi.getSubcategories({ category_id: categoryId }),
    enabled:  !!categoryId,
  });
  const subcategories = (subcatData?.data || []).map((s) => ({ value: s.id, label: s.name }));

  const mutation = useMutation({
    mutationFn: async (data) => {
      const saved = isEdit
        ? await api.updateProduct(product.id, data)
        : await api.createProduct(data);
      const productId = saved.data.id;

      // Save tiers for quantity-based
      if (data.pricingModel === 'quantity_based' && tiers.length > 0) {
        await api.replaceTiersBulk(productId, tiers);
      }

      // Save pricing rule for area_based / fixed_charge
      if (['area_based', 'fixed_charge'].includes(data.pricingModel) && data.basePrice) {
        await api.addPricingRule(productId, {
          pricePerSqft:  data.pricingModel === 'area_based' ? data.basePrice : null,
          fixedPrice:    data.pricingModel === 'fixed_charge' ? data.basePrice : null,
          effectiveFrom: new Date().toISOString().split('T')[0],
        });
      }
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(isEdit ? 'Product updated!' : 'Product created!');
      onSuccess?.();
    },
  });

  const addTier    = () => setTiers((t) => [...t, { minQty: '', maxQty: '', price: '' }]);
  const removeTier = (i) => setTiers((t) => t.filter((_, idx) => idx !== i));
  const updateTier = (i, field, val) =>
    setTiers((t) => t.map((tier, idx) => idx === i ? { ...tier, [field]: val } : tier));

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Category"
          required
          options={categories}
          placeholder="Select category…"
          error={errors.categoryId?.message}
          {...register('categoryId', { required: 'Category is required', onChange: () => setValue('subcategoryId', '') })}
        />
        <Select
          label="Type / Subcategory"
          options={subcategories}
          placeholder={categoryId ? (subcategories.length ? 'Select type…' : 'No subtypes') : 'Pick category first'}
          disabled={!categoryId || subcategories.length === 0}
          {...register('subcategoryId')}
        />
      </div>
      <Input
        label="Product Name"
        placeholder="e.g. Star Flex"
        required
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })}
      />
      <Textarea label="Description" rows={2} {...register('description')} />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Pricing Model"
          required
          options={PRICING_MODELS}
          error={errors.pricingModel?.message}
          {...register('pricingModel', { required: true })}
        />
        <Select label="Unit" options={UNITS} {...register('unit')} />
      </div>

      {/* Base price for area_based / fixed_charge */}
      {['area_based', 'fixed_charge'].includes(pricingModel) && (
        <Input
          label={pricingModel === 'area_based' ? 'Price per sqft (PKR)' : 'Fixed Price (PKR)'}
          type="number" min="0" step="0.01"
          prefix="PKR"
          error={errors.basePrice?.message}
          {...register('basePrice', { required: 'Price is required', min: { value: 0, message: 'Must be ≥ 0' } })}
        />
      )}

      {/* Quantity tiers for quantity_based */}
      {pricingModel === 'quantity_based' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Quantity Tiers</p>
            <Button type="button" size="sm" variant="secondary" icon={<Plus size={12} />} onClick={addTier}>
              Add Tier
            </Button>
          </div>
          {tiers.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
              No tiers yet. Click "Add Tier" to start.
            </p>
          )}
          <div className="space-y-2">
            {tiers.map((tier, i) => (
              <div key={i} className="flex gap-2 items-end">
                <Input
                  label={i === 0 ? 'Min Qty' : undefined}
                  type="number" min="1" placeholder="100"
                  value={tier.minQty}
                  onChange={(e) => updateTier(i, 'minQty', e.target.value)}
                  wrapperClassName="flex-1"
                />
                <Input
                  label={i === 0 ? 'Max Qty' : undefined}
                  type="number" min="1" placeholder="499 (blank=∞)"
                  value={tier.maxQty}
                  onChange={(e) => updateTier(i, 'maxQty', e.target.value)}
                  wrapperClassName="flex-1"
                />
                <Input
                  label={i === 0 ? 'Price (PKR)' : undefined}
                  type="number" min="0" step="0.01" placeholder="500"
                  value={tier.price}
                  onChange={(e) => updateTier(i, 'price', e.target.value)}
                  prefix="PKR"
                  wrapperClassName="flex-1"
                />
                <Button
                  type="button" size="sm" variant="ghost"
                  className="text-red-500 hover:bg-red-50 mb-1 shrink-0"
                  onClick={() => removeTier(i)}
                  icon={<Trash2 size={14} />}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" loading={mutation.isPending} className="w-full">
        {isEdit ? 'Save Changes' : 'Add Product'}
      </Button>
    </form>
  );
};

export default ProductForm;
