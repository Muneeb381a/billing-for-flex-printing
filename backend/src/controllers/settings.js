import * as Q from '../db/queries/settings.js';
import { createError } from '../middleware/errorHandler.js';

export const getSettings = async (_req, res) => {
  const { rows } = await Q.getSettings();
  // Always return a row — the migration inserts the default
  res.json({ data: rows[0] ?? { shop_name: 'My Print Shop', tagline: '', cta_text: 'New Bill', cta_route: '/bills/new' } });
};

export const updateSettings = async (req, res, next) => {
  const { shopName, tagline, ctaText, ctaRoute } = req.body;
  if (!shopName?.trim()) return next(createError(400, 'shopName is required'));

  const { rows } = await Q.upsertSettings({
    shopName:  shopName.trim(),
    tagline:   tagline?.trim() ?? null,
    ctaText:   ctaText?.trim() || 'New Bill',
    ctaRoute:  ctaRoute?.trim() || '/bills/new',
  });
  res.json({ data: rows[0] });
};
