-- What guests can do from a table's menu (Settings > General > At the table),
-- and when and where orders are taken. Decided 2026-11-17 (ROADMAP.md, "The
-- sit-down flow when staff have no phones"). The defaults keep every restaurant
-- as it was: sending, Call staff and Bill, please on; no hours, no location.
ALTER TABLE businesses ADD COLUMN send_orders INTEGER NOT NULL DEFAULT 1;
ALTER TABLE businesses ADD COLUMN call_staff INTEGER NOT NULL DEFAULT 1;
ALTER TABLE businesses ADD COLUMN ask_bill INTEGER NOT NULL DEFAULT 1;
-- Restaurant time (Manila), "HH:MM". Both NULL: orders any time. Closing
-- before opening means past midnight (18:00 to 02:00).
ALTER TABLE businesses ADD COLUMN opens_at TEXT;
ALTER TABLE businesses ADD COLUMN closes_at TEXT;
-- Where the restaurant is, taken from a manager's phone inside it. NULL: no
-- location check. geo_radius in metres: 50, 100 or 200.
ALTER TABLE businesses ADD COLUMN geo_lat REAL;
ALTER TABLE businesses ADD COLUMN geo_lng REAL;
ALTER TABLE businesses ADD COLUMN geo_accuracy INTEGER;
ALTER TABLE businesses ADD COLUMN geo_set_at INTEGER;
ALTER TABLE businesses ADD COLUMN geo_radius INTEGER NOT NULL DEFAULT 50;
