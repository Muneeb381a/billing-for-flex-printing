import client from './client.js';

export const getCustomers    = (params) => client.get('/customers', { params });
export const getCustomer     = (id)     => client.get(`/customers/${id}`);
export const createCustomer  = (data)   => client.post('/customers', data);
export const updateCustomer  = (id, data) => client.put(`/customers/${id}`, data);
export const deleteCustomer  = (id)     => client.delete(`/customers/${id}`);
export const getCustomerLedger = (id)   => client.get(`/customers/${id}/ledger`);
