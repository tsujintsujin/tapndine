-- Orders reach the waiter, and waiters log in to see them.
--
-- A "sitting" is one group at one table, from the first tap until a waiter
-- taps Clear table. Every phone that orders during it is a guest, numbered in
-- the order they first send. Orders arrive in batches: each Send to waiter is
-- one batch. Waiter-added items are batches with no guest ("Additionals").

CREATE TABLE sittings (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES businesses(id),
  table_id     TEXT NOT NULL REFERENCES tables(id),
  opened_at    INTEGER NOT NULL,
  closed_at    INTEGER                      -- NULL while the group is still there
);

-- Which phone a visit came from: a random id in a cookie on that phone. A
-- re-tap from the same phone gets its live visit back instead of a new one.
ALTER TABLE visits ADD COLUMN phone_id TEXT;
ALTER TABLE visits ADD COLUMN sitting_id TEXT REFERENCES sittings(id);

CREATE TABLE guests (
  id          TEXT PRIMARY KEY,
  sitting_id  TEXT NOT NULL REFERENCES sittings(id),
  phone_id    TEXT NOT NULL,
  number      INTEGER NOT NULL,             -- Guest 1, Guest 2, ...
  created_at  INTEGER NOT NULL,
  UNIQUE (sitting_id, phone_id),
  UNIQUE (sitting_id, number)
);

CREATE TABLE staff (
  id               TEXT PRIMARY KEY,
  business_id      TEXT NOT NULL REFERENCES businesses(id),
  username         TEXT NOT NULL UNIQUE,    -- lower case
  name             TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('manager', 'waiter')),
  password_hash    TEXT NOT NULL,           -- pbkdf2$<iterations>$<salt>$<hash>
  failed_logins    INTEGER NOT NULL DEFAULT 0,
  locked_until     INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  -- Disabled, never deleted: batches keep pointing at whoever added them.
  disabled_at      INTEGER
);

-- id is the SHA-256 of the cookie value, so a leaked table cannot log anyone in.
CREATE TABLE staff_sessions (
  id          TEXT PRIMARY KEY,
  staff_id    TEXT NOT NULL REFERENCES staff(id),
  expires_at  INTEGER NOT NULL
);

CREATE TABLE batches (
  id          TEXT PRIMARY KEY,
  sitting_id  TEXT NOT NULL REFERENCES sittings(id),
  guest_id    TEXT REFERENCES guests(id),   -- NULL: added by a waiter
  staff_id    TEXT REFERENCES staff(id),    -- who added it, for waiter batches
  sent_at     INTEGER NOT NULL
);

-- Name and price are copied in at send time, so a later menu change never
-- rewrites a bill.
CREATE TABLE batch_items (
  id           TEXT PRIMARY KEY,
  batch_id     TEXT NOT NULL REFERENCES batches(id),
  dish_id      TEXT NOT NULL REFERENCES dishes(id),
  name         TEXT NOT NULL,
  price_cents  INTEGER NOT NULL,
  qty          INTEGER NOT NULL CHECK (qty > 0),
  sort         INTEGER NOT NULL DEFAULT 0
);

-- At most one open sitting per table, even when two phones tap at once.
CREATE UNIQUE INDEX idx_sittings_open ON sittings(table_id) WHERE closed_at IS NULL;
CREATE INDEX idx_visits_phone ON visits(phone_id, sitting_id);
CREATE INDEX idx_visits_sitting ON visits(sitting_id);
CREATE INDEX idx_batches_sitting ON batches(sitting_id, sent_at);
CREATE INDEX idx_batch_items_batch ON batch_items(batch_id, sort);
CREATE INDEX idx_staff_business ON staff(business_id);
