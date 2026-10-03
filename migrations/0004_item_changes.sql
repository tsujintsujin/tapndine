-- Every time a waiter changes or removes a line at an open table. The line
-- itself is overwritten (or deleted at 0), so this is the only record of what
-- the guest first sent. Statistics reads it as "corrections at confirmation".
--
-- No foreign key to the line or batch: both can be deleted when a line goes to 0.

CREATE TABLE item_changes (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL,              -- the batch_items line (may be gone now)
  sitting_id  TEXT NOT NULL REFERENCES sittings(id),
  dish_id     TEXT NOT NULL REFERENCES dishes(id),
  name        TEXT NOT NULL,              -- as on the line, at the time
  old_qty     INTEGER NOT NULL,
  new_qty     INTEGER NOT NULL,           -- 0: removed
  from_guest  INTEGER NOT NULL,           -- 1: a line the guest sent; 0: one a waiter added
  staff_id    TEXT NOT NULL REFERENCES staff(id),
  changed_at  INTEGER NOT NULL
);

CREATE INDEX idx_item_changes_sitting ON item_changes(sitting_id);
