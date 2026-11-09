-- Support: one running conversation between each restaurant and tapndine.
-- from_dev: 1 = written by a developer, 0 = by the restaurant's manager.
-- seen_at: when the other side opened the conversation. NULL = unread, which
-- is what the badges count.
CREATE TABLE support_messages (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES businesses(id),
  from_dev     INTEGER NOT NULL CHECK (from_dev IN (0, 1)),
  sender       TEXT NOT NULL,                -- who wrote it, as named when they sent it
  body         TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  seen_at      INTEGER
);
CREATE INDEX idx_support_thread ON support_messages(business_id, created_at);
