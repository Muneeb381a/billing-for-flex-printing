import pool from '../../config/db.js';

export const getSettings = () =>
  pool.query(`SELECT * FROM shop_settings WHERE id = 1`);

export const upsertSettings = ({ shopName, tagline, ctaText, ctaRoute, whatsappPhone }) =>
  pool.query(
    `INSERT INTO shop_settings (id, shop_name, tagline, cta_text, cta_route, whatsapp_phone, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO UPDATE SET
       shop_name      = EXCLUDED.shop_name,
       tagline        = EXCLUDED.tagline,
       cta_text       = EXCLUDED.cta_text,
       cta_route      = EXCLUDED.cta_route,
       whatsapp_phone = EXCLUDED.whatsapp_phone,
       updated_at     = NOW()
     RETURNING *`,
    [shopName, tagline ?? null, ctaText, ctaRoute, whatsappPhone ?? null]
  );
