-- Plans can be bought by the month as well as by the year (set by Justin
-- 2026-11-08). A restaurant buys again for each new month or year; a plan
-- that runs out keeps working 3 more days, then closes like an ended trial.

-- What a checkout buys: 'year' (a year plus 7 free days) or 'month'.
ALTER TABLE checkouts ADD COLUMN term TEXT NOT NULL DEFAULT 'year';

-- What a new owner typed before picking "Buy a plan", so the plans page
-- (/start/plans) can use it. NULL until then.
ALTER TABLE signup_tickets ADD COLUMN restaurant TEXT;
ALTER TABLE signup_tickets ADD COLUMN owner_name TEXT;

-- Plan-ending reminder emails already sent, so the daily job sends each once:
-- one row per restaurant, plan end day and how many days were left (3 or 1).
CREATE TABLE plan_reminders (
  business_id  TEXT NOT NULL,
  ends_on      TEXT NOT NULL,
  days_left    INTEGER NOT NULL,
  sent_at      INTEGER NOT NULL,
  PRIMARY KEY (business_id, ends_on, days_left)
);
