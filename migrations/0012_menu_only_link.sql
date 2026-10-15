-- Every restaurant has a "Not at a table" link: the menu without a table, for
-- guests who just want to look. Restaurants added from the developers' screen
-- never got one (only the seed data had it), so they get one here.
-- 12 lower-case hex characters, which isTagId accepts.

INSERT INTO tags (id, business_id, table_id, created_at)
SELECT lower(hex(randomblob(6))), b.id, NULL, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM tags t WHERE t.business_id = b.id AND t.table_id IS NULL AND t.removed_at IS NULL
);
