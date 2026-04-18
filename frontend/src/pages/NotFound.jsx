import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button.jsx';

const NotFound = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
        <AlertCircle size={32} className="text-indigo-600" />
      </div>
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-gray-500">This page does not exist.</p>
      <Link to="/">
        <Button icon={<Home size={16} />}>Back to Dashboard</Button>
      </Link>
    </div>
  </div>
);

export default NotFound;
