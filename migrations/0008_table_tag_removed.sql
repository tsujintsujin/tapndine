-- Managers add, rename and delete tables and their NFC links themselves now.
-- A deleted table and a replaced link keep their rows: past sittings and
-- visits still point at them. A removed tag no longer opens a menu.
ALTER TABLE tables ADD COLUMN removed_at INTEGER;
ALTER TABLE tags ADD COLUMN removed_at INTEGER;
