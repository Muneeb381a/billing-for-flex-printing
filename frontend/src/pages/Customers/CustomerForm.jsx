import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Input, Select, Textarea, Button } from '../../components/ui/index.js';
import * as api from '../../api/customers.js';

const DISCOUNT_TYPES = [
  { value: 'normal',  label: 'Normal (no auto-discount)' },
  { value: 'regular', label: 'Regular customer (auto-discount)' },
];

const CustomerForm = ({ customer, onSuccess }) => {
  const isEdit = Boolean(customer);
  const qc     = useQueryClient();

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      name:                customer?.name                || '',
      phone:               customer?.phone               || '',
      email:               customer?.email               || '',
      address:             customer?.address             || '',
      discountType:        customer?.discount_type       || 'normal',
      discountPercentage:  customer?.discount_percentage || 0,
    },
  });

  useEffect(() => {
    if (customer) reset({
      name:               customer.name,
      phone:              customer.phone,
      email:              customer.email               || '',
      address:            customer.address             || '',
      discountType:       customer.discount_type       || 'normal',
      discountPercentage: customer.discount_percentage || 0,
    });
  }, [customer, reset]);

  const discountType = watch('discountType');

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? api.updateCustomer(customer.id, data) : api.createCustomer(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success(isEdit ? 'Customer updated!' : 'Customer created!');
      onSuccess?.(res?.data ?? res);
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <Input
        label="Full Name"
        placeholder="e.g. Ahmed Khan"
        required
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })}
      />
      <Input
        label="Phone"
        placeholder="e.g. 03001234567"
        required
        error={errors.phone?.message}
        {...register('phone', {
          required: 'Phone is required',
          pattern: { value: /^[0-9+\-\s]{7,15}$/, message: 'Invalid phone number' },
        })}
      />
      <Input label="Email" type="email" placeholder="Optional" {...register('email')} />
      <Textarea label="Address" placeholder="Street, City" rows={2} {...register('address')} />

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Discount Settings</p>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Customer Type"
            options={DISCOUNT_TYPES}
            {...register('discountType')}
          />
          <Input
            label="Discount %"
            type="number" min="0" max="100" step="0.5"
            placeholder="0"
            disabled={discountType === 'normal'}
            suffix="%"
            {...register('discountPercentage', { valueAsNumber: true, min: 0, max: 100 })}
          />
        </div>
        {discountType === 'regular' && (
          <p className="text-xs text-emerald-600 mt-2 font-medium">
            ✓ Discount will be auto-applied when this customer is selected on a bill.
          </p>
        )}
      </div>

      <Button type="submit" loading={mutation.isPending} className="w-full">
        {isEdit ? 'Save Changes' : 'Add Customer'}
      </Button>
    </form>
  );
};

export default CustomerForm;
