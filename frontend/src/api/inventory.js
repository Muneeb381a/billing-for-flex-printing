import client from './client.js';

export const getItems       = (params)          => client.get('/inventory', { params });
export const getItem        = (id)              => client.get(`/inventory/${id}`);
export const createItem     = (data)            => client.post('/inventory', data);
export const updateItem     = (id, data)        => client.put(`/inventory/${id}`, data);
export const restock        = (id, data)        => client.post(`/inventory/${id}/restock`, data);
export const adjust         = (id, data)        => client.post(`/inventory/${id}/adjust`, data);
export const getMovements   = (id, params)      => client.get(`/inventory/${id}/movements`, { params });
export const getAlerts      = ()                => client.get('/inventory/alerts');

export const getMappings    = (productId)       => client.get(`/inventory/product/${productId}/mappings`);
export const upsertMapping  = (productId, data) => client.put(`/inventory/product/${productId}/mappings`, data);
export const deleteMapping  = (productId, iid)  => client.delete(`/inventory/product/${productId}/mappings/${iid}`);
