import client from './client.js';

export const getProductPricingConfig = (productId) => client.get(`/pricing/product/${productId}`);
export const calculatePrice          = (data)       => client.post('/pricing/calculate', data);
export const estimateBill            = (data)       => client.post('/pricing/estimate', data);
export const getTiersWithGuidance    = (productId, qty) =>
  client.get(`/pricing/tiers/${productId}`, { params: { qty } });
