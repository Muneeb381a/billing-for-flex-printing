import { Inbox } from 'lucide-react';

const EmptyState = ({ message = 'No data found', icon: Icon = Inbox, action }) => (
  <div className="flex flex-col items-center gap-3 text-gray-400 py-6">
    <Icon size={40} strokeWidth={1.5} />
    <p className="text-sm">{message}</p>
    {action}
  </div>
);

export default EmptyState;
