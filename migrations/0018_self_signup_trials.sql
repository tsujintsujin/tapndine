-- Restaurants sign themselves up for a free trial, with Google or with a code
-- emailed to them. A trial has every feature but one table and two staff
-- logins besides the manager, and ends 7 days after sign-up. Adding a
-- contract (developers, Billing) makes it a normal restaurant again.

-- When the trial ends, unix ms. NULL: not a self sign-up (restaurants added by
-- a developer keep working as before). Ignored once the restaurant has a contract.
ALTER TABLE businesses ADD COLUMN trial_ends_at INTEGER;

-- How a self signed-up manager logs in: no password, their email (lower case)
-- or their Google account. Restaurant logins made with a password leave both NULL.
ALTER TABLE staff ADD COLUMN email TEXT;
ALTER TABLE staff ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX idx_staff_email ON staff(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_staff_google ON staff(google_sub) WHERE google_sub IS NOT NULL;

-- The code emailed to sign in. One row per address; a new code replaces the old.
-- code_hash is the SHA-256 of "<email>:<code>", so a leaked table gives nothing away.
CREATE TABLE email_codes (
  email         TEXT PRIMARY KEY,
  code_hash     TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  tries         INTEGER NOT NULL DEFAULT 0,  -- wrong codes typed for this one
  sent_at       INTEGER NOT NULL,
  -- Codes sent in the hour that started at window_start, against mail bombing.
  window_start  INTEGER NOT NULL,
  sends         INTEGER NOT NULL DEFAULT 1
);

-- Someone who proved their email (code or Google) but has no restaurant yet:
-- the next step asks for its name. id is the SHA-256 of the cookie value.
CREATE TABLE signup_tickets (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  google_sub  TEXT,
  expires_at  INTEGER NOT NULL
);
