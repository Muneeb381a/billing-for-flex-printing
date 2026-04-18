import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppLayout      from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login          from './pages/Login.jsx';
import Dashboard      from './pages/Dashboard.jsx';
import Customers      from './pages/Customers/index.jsx';
import Products       from './pages/Products/index.jsx';
import Bills          from './pages/Bills/index.jsx';
import BillForm       from './pages/Bills/BillForm.jsx';
import BillDetail     from './pages/Bills/BillDetail.jsx';
import PrintInvoice   from './pages/Bills/PrintInvoice.jsx';
import Ledger         from './pages/Ledger/index.jsx';
import Reports        from './pages/Reports/index.jsx';
import Settings       from './pages/Settings/index.jsx';
import Inventory      from './pages/Inventory/index.jsx';
import CustomerLedger from './pages/Customers/CustomerLedger.jsx';
import NotFound       from './pages/NotFound.jsx';

const router = createBrowserRouter([
  { path: 'login', element: <Login /> },

  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true,                       element: <Dashboard /> },
          { path: 'customers',                 element: <Customers /> },
          { path: 'products',                  element: <Products /> },
          { path: 'bills',                     element: <Bills /> },
          { path: 'bills/new',                 element: <BillForm /> },
          { path: 'bills/:id',                 element: <BillDetail /> },
          { path: 'ledger',                    element: <Ledger /> },
          { path: 'reports',                   element: <Reports /> },
          { path: 'settings',                  element: <Settings /> },
          { path: 'inventory',                 element: <Inventory /> },
          { path: 'customers/:id/ledger',      element: <CustomerLedger /> },
        ],
      },
    ],
  },

  { path: 'bills/:id/print', element: <PrintInvoice /> },
  { path: '*',               element: <NotFound /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
