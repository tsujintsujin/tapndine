-- When a login finished or skipped the guide (unix ms); null: it opens on their next visit.
ALTER TABLE staff ADD COLUMN guide_seen_at INTEGER;
