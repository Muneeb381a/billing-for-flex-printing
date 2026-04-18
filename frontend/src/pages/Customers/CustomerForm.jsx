import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Input, Textarea, Button } from '../../components/ui/index.js';
import * as api from '../../api/customers.js';

const CustomerForm = ({ customer, onSuccess }) => {
  const isEdit = Boolean(customer);
  const qc     = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      name:    customer?.name    || '',
      phone:   customer?.phone   || '',
      email:   customer?.email   || '',
      address: customer?.address || '',
    },
  });

  useEffect(() => {
    if (customer) reset(customer);
  }, [customer, reset]);

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
      <Input
        label="Email"
        type="email"
        placeholder="Optional"
        error={errors.email?.message}
        {...register('email')}
      />
      <Textarea
        label="Address"
        placeholder="Street, City"
        rows={2}
        {...register('address')}
      />
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={mutation.isPending} className="flex-1">
          {isEdit ? 'Save Changes' : 'Add Customer'}
        </Button>
      </div>
    </form>
  );
};

export default CustomerForm;
