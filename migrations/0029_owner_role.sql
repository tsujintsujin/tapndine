-- Each restaurant gets one Owner (Justin, 2026-11-11): the login made with the
-- restaurant, at sign-up (it has the email) or by a developer (the oldest
-- manager). Other managers stay managers. The Owner has every page; managers
-- lose Subscription, adding and removing logins, and the name, logo and
-- colours. The role has been allowed since 0009.

UPDATE staff SET role = 'owner'
WHERE id IN (
  SELECT (
    SELECT s.id FROM staff s
    WHERE s.business_id = b.id AND s.role = 'manager' AND s.disabled_at IS NULL
    ORDER BY s.email IS NULL, s.created_at, s.id
    LIMIT 1
  )
  FROM businesses b
  WHERE NOT EXISTS (SELECT 1 FROM staff o WHERE o.business_id = b.id AND o.role = 'owner' AND o.disabled_at IS NULL)
);
