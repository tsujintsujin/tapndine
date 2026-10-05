-- Managers edit the menu themselves now. A removed dish leaves the menu but
-- keeps its row: past orders and corrections still point at it.
ALTER TABLE dishes ADD COLUMN removed_at INTEGER;
