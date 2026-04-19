-- Additive migration: add whatsapp_phone to shop_settings
-- Safe to re-run — uses IF NOT EXISTS / DO NOTHING patterns.

ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20) DEFAULT NULL;

-- Pre-populate the default shop number
UPDATE shop_settings SET whatsapp_phone = '03239062418' WHERE id = 1 AND whatsapp_phone IS NULL;
