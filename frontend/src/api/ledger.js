import client from './client.js';

export const getAllLedger     = ()           => client.get('/ledger');
export const getCustomerLedger = (id, params) => client.get(`/ledger/${id}`, { params });
export const recordPayment   = (data)       => client.post('/payments', data);
