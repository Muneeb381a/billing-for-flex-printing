import client from './client.js';

export const getProducts      = (params)       => client.get('/products', { params });
export const getProduct       = (id)           => client.get(`/products/${id}`);
export const createProduct    = (data)         => client.post('/products', data);
export const updateProduct    = (id, data)     => client.put(`/products/${id}`, data);
export const deleteProduct    = (id)           => client.delete(`/products/${id}`);

export const getTiers         = (id)           => client.get(`/products/${id}/tiers`);
export const replaceTiersBulk = (id, tiers)   => client.patch(`/products/${id}/tiers/bulk`, { tiers });
export const addTier          = (id, data)     => client.post(`/products/${id}/tiers`, data);
export const deleteTier       = (id, tierId)   => client.delete(`/products/${id}/tiers/${tierId}`);

export const getPricingRules  = (id)           => client.get(`/products/${id}/pricing-rules`);
export const addPricingRule   = (id, data)     => client.post(`/products/${id}/pricing-rules`, data);

export const getSpecs         = (id)           => client.get(`/products/${id}/specs`);
export const upsertSpec       = (id, data)     => client.put(`/products/${id}/specs`, data);
export const deleteSpec       = (id, specKey)  => client.delete(`/products/${id}/specs/${specKey}`);
