import client from './client.js';

export const getSummary       = ()                => client.get('/dashboard/summary');
export const getDailySales    = (days = 30)       => client.get('/dashboard/daily-sales',    { params: { days } });
export const getMonthlySales  = (months = 12)     => client.get('/dashboard/monthly-sales',  { params: { months } });
export const getPendingOrders = (limit = 20)      => client.get('/dashboard/pending-orders', { params: { limit } });
export const getTopProducts   = (limit = 10)      => client.get('/dashboard/top-products',   { params: { limit } });
export const getStockAlerts   = ()                => client.get('/dashboard/stock-alerts');
export const getLedger        = (params)          => client.get('/ledger', { params });
export const getCustomerLedger = (customerId)     => client.get(`/ledger/${customerId}`);
