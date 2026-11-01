-- Design C of the guests' menu (categories down the left, dishes on the
-- right). 0016's CHECK only allows 'a' and 'b', and SQLite can't change a
-- CHECK in place, so the column is copied into one that also allows 'c' and
-- swapped in. Every restaurant keeps the design it had.
ALTER TABLE businesses ADD COLUMN menu_design_next TEXT NOT NULL DEFAULT 'a' CHECK (menu_design_next IN ('a', 'b', 'c'));
UPDATE businesses SET menu_design_next = menu_design;
ALTER TABLE businesses DROP COLUMN menu_design;
ALTER TABLE businesses RENAME COLUMN menu_design_next TO menu_design;
