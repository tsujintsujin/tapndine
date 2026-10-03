-- What the guest calls themselves, typed on their phone the first time they
-- open a menu. The waiter sees it instead of "Guest 2". NULL: they skipped it.
ALTER TABLE guests ADD COLUMN nickname TEXT;
