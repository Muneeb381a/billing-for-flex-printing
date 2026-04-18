import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Store, Palette, Link2 } from 'lucide-react';
import * as settingsAPI from '../../api/settings.js';
import { toast } from 'react-hot-toast';

const Field = ({ label, hint, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
);

const Section = ({ icon: Icon, title, subtitle, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
    <div className="flex items-start gap-3 mb-6">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
        <Icon size={17} className="text-indigo-600" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const CTA_ROUTES = [
  { value: '/bills/new',    label: 'New Bill  (/bills/new)' },
  { value: '/customers',    label: 'Customers  (/customers)' },
  { value: '/products',     label: 'Products  (/products)' },
  { value: '/reports',      label: 'Reports  (/reports)' },
];

const Settings = () => {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['shop-settings'],
    queryFn:  settingsAPI.getSettings,
    staleTime: 5 * 60 * 1000,
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({
    defaultValues: { shopName: '', tagline: '', ctaText: '', ctaRoute: '/bills/new' },
  });

  useEffect(() => {
    if (data?.data) {
      const s = data.data;
      reset({
        shopName: s.shop_name  || '',
        tagline:  s.tagline    || '',
        ctaText:  s.cta_text   || 'New Bill',
        ctaRoute: s.cta_route  || '/bills/new',
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: settingsAPI.updateSettings,
    onSuccess: (res) => {
      qc.setQueryData(['shop-settings'], res);
      qc.invalidateQueries({ queryKey: ['shop-settings'] });
      toast.success('Settings saved!');
      reset(undefined, { keepValues: true });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Failed to save settings');
    },
  });

  const onSubmit = (values) => mutation.mutate(values);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-5">

      <Section icon={Store} title="Shop Identity" subtitle="Name and tagline shown across the app">
        <Field
          label="Shop Name"
          error={errors.shopName?.message}
        >
          <input
            {...register('shopName', { required: 'Shop name is required' })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="My Print Shop"
          />
        </Field>

        <Field
          label="Tagline"
          hint="Optional — shown below the shop name on the dashboard"
        >
          <input
            {...register('tagline')}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Professional Printing Solutions"
          />
        </Field>
      </Section>

      <Section icon={Link2} title="Primary Action" subtitle="The main button shown on the dashboard hero strip">
        <Field
          label="Button Label"
          hint="Text displayed on the CTA button"
          error={errors.ctaText?.message}
        >
          <input
            {...register('ctaText', { required: 'Button label is required' })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="New Bill"
          />
        </Field>

        <Field label="Button Destination" hint="Where clicking the CTA navigates to">
          <select
            {...register('ctaRoute')}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            {CTA_ROUTES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
      </Section>

      <div className="flex items-center justify-between pt-1">
        {isDirty && (
          <p className="text-xs text-amber-600">You have unsaved changes</p>
        )}
        <div className="ml-auto">
          <button
            type="submit"
            disabled={mutation.isPending || !isDirty}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold
              px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={15} />
            {mutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

    </form>
  );
};

export default Settings;
