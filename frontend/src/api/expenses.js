import client from './client.js';

export const getExpenses    = (params)      => client.get('/expenses', { params });
export const getExpense     = (id)          => client.get(`/expenses/${id}`);
export const getSummary     = (params)      => client.get('/expenses/summary', { params });
export const getByCategory  = (params)      => client.get('/expenses/by-category', { params });
export const createExpense  = (data)        => client.post('/expenses', data);
export const updateExpense  = (id, data)    => client.put(`/expenses/${id}`, data);
export const deleteExpense  = (id)          => client.delete(`/expenses/${id}`);
