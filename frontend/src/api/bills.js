import client from './client.js';

export const getBills          = (params)           => client.get('/bills', { params });
export const checkBillNumber   = (value)            => client.get('/bills/check-bill-number', { params: { value } });
export const getBill         = (id)             => client.get(`/bills/${id}`);
export const getInvoice      = (id)             => client.get(`/bills/${id}/invoice`);
export const createBill      = (data)           => client.post('/bills', data);
export const completeBill    = (data)           => client.post('/bills/complete', data);
export const updateBill      = (id, data)       => client.put(`/bills/${id}`, data);
export const deleteBill      = (id)             => client.delete(`/bills/${id}`);
export const updateStatus    = (id, status)     => client.patch(`/bills/${id}/status`, { status });
export const markDelivered   = (id)             => client.patch(`/bills/${id}/deliver`);
export const applyDiscount   = (id, data)       => client.patch(`/bills/${id}/discount`, data);

export const addItem         = (id, data)       => client.post(`/bills/${id}/items`, data);
export const updateItem      = (id, itemId, data) => client.put(`/bills/${id}/items/${itemId}`, data);
export const deleteItem      = (id, itemId)     => client.delete(`/bills/${id}/items/${itemId}`);

export const addExtraCharge  = (id, data)       => client.post(`/bills/${id}/extra-charges`, data);
export const deleteExtraCharge = (id, chargeId) => client.delete(`/bills/${id}/extra-charges/${chargeId}`);

export const duplicateBill    = (id)             => client.post(`/bills/${id}/duplicate`);
export const bulkUpdateStatus = (ids, status)   => client.post('/bills/bulk-status', { ids, status });
export const bulkDeleteBills  = (ids)           => client.delete('/bills/bulk', { data: { ids } });
