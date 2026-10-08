-- What each restaurant signed with tapndine and what it has paid. Developers
-- type these in; nothing here is charged automatically.
--
-- One contract row per term: a renewal is a new row, so last year's plan,
-- price and payments stay as they were. Plan name, tables and price are
-- copied in at signing, so a later price change never rewrites a contract.
-- Dates are restaurant days, YYYY-MM-DD.

CREATE TABLE contracts (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES businesses(id),
  plan         TEXT NOT NULL,              -- "Growth Plan"
  tables       INTEGER NOT NULL,           -- how many tables the plan covers
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
  signed_on    TEXT NOT NULL,
  starts_on    TEXT NOT NULL,
  ends_on      TEXT NOT NULL,              -- last day covered
  note         TEXT,
  created_at   INTEGER NOT NULL,
  CHECK (ends_on >= starts_on)
);

-- Money received for a contract. A wrong entry is deleted and typed again.
CREATE TABLE payments (
  id            TEXT PRIMARY KEY,
  contract_id   TEXT NOT NULL REFERENCES contracts(id),
  paid_on       TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  method        TEXT NOT NULL,             -- GCash, Maya, Bank transfer, Cash, Other
  reference     TEXT,                      -- receipt or transfer number
  note          TEXT,
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_contracts_business ON contracts(business_id, starts_on);
CREATE INDEX idx_payments_contract ON payments(contract_id, paid_on);
