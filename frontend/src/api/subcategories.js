import client from './client.js';

export const getSubcategories   = (params)      => client.get('/subcategories', { params });
export const getSubcategory     = (id)          => client.get(`/subcategories/${id}`);
export const createSubcategory  = (data)        => client.post('/subcategories', data);
export const updateSubcategory  = (id, data)    => client.put(`/subcategories/${id}`, data);
export const deleteSubcategory  = (id)          => client.delete(`/subcategories/${id}`);
