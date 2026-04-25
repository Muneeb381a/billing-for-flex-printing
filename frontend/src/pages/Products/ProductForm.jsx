import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Input, Select, Button } from '../../components/ui/index.js';
import * as api from '../../api/categories.js';

const PRICING_TYPES = [
  { value: 'area_based',     label: 'Area-based  —  W × H × Qty × Rate/sqft' },
  { value: 'quantity_based', label: 'Quantity-based  —  items × rate (or total)' },
  { value: 'fixed_charge',   label: 'Fixed charge  —  user enters total directly' },
];

const PRICING_MODES = [
  { value: 'total',    label: 'Total price  —  user enters the full job price' },
  { value: 'per_unit', label: 'Per unit  —  quantity × rate per piece' },
];

const RATE_HINT = {
  area_based:     'Rate per sqft — pre-filled when this category is selected in billing',
  quantity_based: 'Default rate — user can override per bill',
  fixed_charge:   'Default fixed amount',
  custom:         'Default amount',
};

const CategoryForm = ({ category, onSuccess }) => {
  const isEdit = Boolean(category);
  const qc = useQueryClient();

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      name:        category?.name         || '',
      pricingType: category?.pricing_type || 'area_based',
      pricingMode: category?.pricing_mode || 'total',
      rate:        category?.rate         || '',
      isActive:    category?.is_active    ?? true,
    },
  });

  useEffect(() => {
    if (category) {
      reset({
        name:        category.name,
        pricingType: category.pricing_type,
        pricingMode: category.pricing_mode || 'total',
        rate:        category.rate || '',
        isActive:    category.is_active ?? true,
      });
    }
  }, [category, reset]);

  const pricingType = watch('pricingType');

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        name:        data.name.trim(),
        pricingType: data.pricingType,
        pricingMode: data.pricingType === 'quantity_based' ? data.pricingMode : undefined,
        rate:        data.rate ? parseFloat(data.rate) : undefined,
        isActive:    data.isActive,
      };
      return isEdit
        ? api.updateCategory(category.id, payload)
        : api.createCategory(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success(isEdit ? 'Category updated!' : 'Category created!');
      onSuccess?.();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to save'),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <Input
        label="Category Name"
        placeholder="e.g. China Flex, Business Cards, Star Flex…"
        size="lg"
        required
        autoFocus
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })}
      />

      <Select
        label="Type"
        size="lg"
        options={PRICING_TYPES}
        {...register('pricingType')}
      />

      {pricingType === 'quantity_based' && (
        <Select
          label="Rate Mode"
          size="lg"
          options={PRICING_MODES}
          {...register('pricingMode')}
        />
      )}

      <Input
        label="Default Rate (optional)"
        type="number" min="0" step="1" prefix="₨" placeholder="0"
        size="lg"
        hint={RATE_HINT[pricingType]}
        {...register('rate')}
      />

      {isEdit && (
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input type="checkbox" className="sr-only peer" {...register('isActive')} />
            <div className="w-9 h-5 rounded-full bg-slate-200 peer-checked:bg-brand-600 transition-colors duration-150" />
            <div className="absolute top-0.5 inset-s-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-150 peer-checked:translate-x-4" />
          </div>
          <span className="text-sm font-medium text-slate-700">Active (visible in billing)</span>
        </label>
      )}

      <Button
        type="submit"
        loading={mutation.isPending}
        size="lg"
        className="w-full"
      >
        {isEdit ? 'Save Changes' : 'Add Category'}
      </Button>
    </form>
  );
};

export default CategoryForm;
