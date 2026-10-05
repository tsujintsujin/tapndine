-- "Book a demo" on the landing page. One row per request; Justin is emailed too.
CREATE TABLE demo_requests (
  id         TEXT PRIMARY KEY,
  slot_date  TEXT NOT NULL,     -- YYYY-MM-DD, the visitor's local day
  slot_min   INTEGER NOT NULL,  -- minutes after midnight, 540 = 9:00 AM
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT,
  created_at INTEGER NOT NULL
);
