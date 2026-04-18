import client from './client.js';

export const getPayments   = (params) => client.get('/payments', { params });
export const createPayment = (data)   => client.post('/payments', data);
export const deletePayment = (id)     => client.delete(`/payments/${id}`);
