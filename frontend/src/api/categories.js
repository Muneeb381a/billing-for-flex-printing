import client from './client.js';

export const getCategories   = (params) => client.get('/categories', { params });
export const getCategory     = (id)     => client.get(`/categories/${id}`);
export const createCategory  = (data)   => client.post('/categories', data);
export const updateCategory  = (id, data) => client.put(`/categories/${id}`, data);
export const deleteCategory  = (id)     => client.delete(`/categories/${id}`);
export const replaceCategoryTiers = (id, tiers) => client.put(`/categories/${id}/tiers`, { tiers });
