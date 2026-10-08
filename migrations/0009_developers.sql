-- tapndine serves many restaurants. Above their managers sit the developers:
-- the people who run tapndine itself. A developer belongs to no restaurant;
-- they open one at a time and work in it as its manager. "owner" (a
-- restaurant's owner) is allowed now so it can be added later without
-- rebuilding this table again.
--
-- SQLite cannot change a CHECK or make a column nullable in place, so staff
-- is rebuilt. Sessions, batches and item changes point at staff by id; the
-- deferred check lets the old table go before the new one takes its name
-- (D1 needs the pragma switched back off for the rebuild to commit).

PRAGMA defer_foreign_keys = on;

CREATE TABLE staff_new (
  id               TEXT PRIMARY KEY,
  business_id      TEXT REFERENCES businesses(id),   -- NULL only for developers
  username         TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('developer', 'owner', 'manager', 'waiter')),
  password_hash    TEXT NOT NULL,
  failed_logins    INTEGER NOT NULL DEFAULT 0,
  locked_until     INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  disabled_at      INTEGER,
  CHECK ((role = 'developer') = (business_id IS NULL))
);

INSERT INTO staff_new (id, business_id, username, name, role, password_hash, failed_logins, locked_until, created_at, disabled_at)
SELECT id, business_id, username, name, role, password_hash, failed_logins, locked_until, created_at, disabled_at FROM staff;

DROP TABLE staff;
ALTER TABLE staff_new RENAME TO staff;
CREATE INDEX idx_staff_business ON staff(business_id);
PRAGMA defer_foreign_keys = off;

-- The restaurant a developer has open in this session. NULL for everyone else.
ALTER TABLE staff_sessions ADD COLUMN business_id TEXT REFERENCES businesses(id);

-- A switched-off restaurant: its tags stop opening the menu, open menus stop
-- working and its staff cannot log in. Nothing is deleted; switching it back
-- on restores everything.
ALTER TABLE businesses ADD COLUMN disabled_at INTEGER;
