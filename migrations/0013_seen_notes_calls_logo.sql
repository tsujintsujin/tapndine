-- What the waiter has looked at, what the guest asked for, and the restaurant's logo.
--
-- seen_at: when a waiter first opened the table after this batch arrived.
-- NULL = new, shown as "New" on the Tables screen and "Waiting for your
-- waiter" on the guest's phone. Batches already sent count as seen, so
-- nothing old turns up as new.
ALTER TABLE batches ADD COLUMN seen_at INTEGER;
UPDATE batches SET seen_at = sent_at;

-- The guest's note on one dish line ("no egg"), typed in My order.
ALTER TABLE batch_items ADD COLUMN note TEXT;

-- "Call waiter" and "Bill, please" from a guest's phone. Cleared (seen_at)
-- when a waiter opens the table, like a new order. One open call of each
-- kind per sitting: asking again while one is open does nothing.
CREATE TABLE calls (
  id          TEXT PRIMARY KEY,
  sitting_id  TEXT NOT NULL REFERENCES sittings(id),
  kind        TEXT NOT NULL CHECK (kind IN ('waiter', 'bill')),
  name        TEXT,                        -- who asked: nickname or "Guest 2"; NULL if unknown
  created_at  INTEGER NOT NULL,
  seen_at     INTEGER
);
CREATE INDEX idx_calls_sitting ON calls(sitting_id, seen_at);

-- The restaurant's logo on the guest's menu, uploaded by a manager. NULL: name only.
ALTER TABLE businesses ADD COLUMN logo_url TEXT;
