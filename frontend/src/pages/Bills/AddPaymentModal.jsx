import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal, Input, Select, Button } from '../../components/ui/index.js';
import { formatCurrency } from '../../utils/format.js';
import * as api from '../../api/payments.js';

const METHODS = [
  { value: 'cash',          label: 'Cash'          },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque'        },
  { value: 'online',        label: 'Online'        },
];

const AddPaymentModal = ({ isOpen, onClose, bill }) => {
  const qc = useQueryClient();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: { amount: '', paymentMethod: 'cash', referenceNumber: '', notes: '' },
  });

  const method = watch('paymentMethod');

  const mutation = useMutation({
    mutationFn: (data) => api.createPayment({
      billId:          bill.id,
      amount:          parseFloat(data.amount),
      paymentMethod:   data.paymentMethod,
      referenceNumber: data.referenceNumber || undefined,
      notes:           data.notes           || undefined,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['bill', bill.id] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      toast.success(`Payment of ${formatCurrency(res.data.amount)} recorded!`);
      reset();
      onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" size="sm">
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">Bill</p>
        <p className="font-semibold text-gray-900">{bill?.bill_number}</p>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">Remaining Balance</span>
          <span className="text-sm font-bold text-red-600">
            {formatCurrency(bill?.remaining_balance)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <Input
          label="Amount (PKR)"
          type="number" min="1" step="1"
          prefix="₨"
          required
          error={errors.amount?.message}
          {...register('amount', {
            required: 'Amount is required',
            min: { value: 1, message: 'Must be > 0' },
            validate: (v) =>
              parseFloat(v) <= parseFloat(bill?.remaining_balance || 0) ||
              `Cannot exceed remaining balance of ${formatCurrency(bill?.remaining_balance)}`,
          })}
        />

        <Select
          label="Payment Method"
          options={METHODS}
          {...register('paymentMethod')}
        />

        {['bank_transfer', 'cheque'].includes(method) && (
          <Input
            label={method === 'cheque' ? 'Cheque Number' : 'Transaction Reference'}
            placeholder="Reference number…"
            {...register('referenceNumber')}
          />
        )}

        <Input label="Notes (optional)" placeholder="Partial payment, receipt #…" {...register('notes')} />

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending} className="flex-1">
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddPaymentModal;
