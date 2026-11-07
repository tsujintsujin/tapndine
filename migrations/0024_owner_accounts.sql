-- Owners sign up with an email and a password (or Google), and either start
-- the free trial or buy a plan. A bought plan's account is only made once
-- PayMongo says the money arrived.

-- The password chosen at sign-up, hashed, held while the owner names the
-- restaurant. NULL for a Google sign-up.
ALTER TABLE signup_tickets ADD COLUMN password_hash TEXT;

-- One QR Ph payment for a plan. Either a restaurant on its free trial buying
-- (business_id set from the start), or a new owner whose restaurant and login
-- are made when it is paid (owner holds what they typed; business_id and
-- staff_id are picked up front and used then).
CREATE TABLE checkouts (
  id            TEXT PRIMARY KEY,           -- chk_<random>, our reference
  business_id   TEXT NOT NULL,
  staff_id      TEXT,                       -- the new owner's login, made when paid
  owner         TEXT,                       -- JSON: email, googleSub, passwordHash, restaurant, name
  ticket        TEXT,                       -- SHA-256 of the sign-up cookie, to log the payer in
  plan          TEXT NOT NULL,
  tables        INTEGER NOT NULL,
  amount_cents  INTEGER NOT NULL,
  intent_id     TEXT UNIQUE,                -- PayMongo payment intent, pi_...
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | paid
  created_at    INTEGER NOT NULL,
  paid_at       INTEGER
);
CREATE INDEX idx_checkouts_business ON checkouts(business_id, created_at);
