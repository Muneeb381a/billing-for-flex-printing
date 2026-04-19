import client from './client.js';

export const getSummary      = (params) => client.get('/reports/summary',       { params });
export const getDaily        = (params) => client.get('/reports/daily',          { params });
export const getMonthly      = (params) => client.get('/reports/monthly',        { params });
export const getTopProducts  = (params) => client.get('/reports/top-products',   { params });
export const getTopCustomers = (params) => client.get('/reports/top-customers',  { params });
export const getProfitLoss   = (params) => client.get('/reports/profit-loss',    { params });
