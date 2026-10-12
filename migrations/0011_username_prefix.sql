-- A restaurant login is "<restaurant code>-<name>": hikay-maria, kusina-dos-ana.
-- Two restaurants can each have a Maria, and the code says whose login it is.
-- The name part has no dashes, so the code always ends at the last dash.
-- Developers belong to no restaurant and keep their plain usernames.
--
-- Existing logins get the code in front. One already written "<code>." or
-- "<code>-" (kusina.manager) has that replaced, not doubled.

UPDATE staff SET username = (
  SELECT CASE
    WHEN staff.username LIKE b.slug || '-%' THEN staff.username
    WHEN staff.username LIKE b.slug || '.%' THEN b.slug || '-' || substr(staff.username, length(b.slug) + 2)
    ELSE b.slug || '-' || staff.username
  END
  FROM businesses b WHERE b.id = staff.business_id
)
WHERE business_id IS NOT NULL;
