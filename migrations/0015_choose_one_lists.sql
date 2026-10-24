-- Combos / set meals (Stage 1, Build 2): "choose one" lists a manager names
-- per dish ("Drink": Calamansi Juice, Mango Shake +P30). The guest must pick
-- exactly one from each list. Kind 'choice', with the list's name in
-- group_name; the other kinds keep group_name NULL.
--
-- Each choice is a dish from the same menu (ref_dish_id), with its own combo
-- price. Its name is read from that dish, so a rename shows everywhere, and a
-- dish that is sold out or removed drops out of the list. name keeps a copy.
--
-- SQLite can't change a CHECK in place, so the table is rebuilt. Nothing
-- references dish_options (order lines copy the picks as text), so no
-- foreign keys need deferring.
CREATE TABLE dish_options_new (
  id           TEXT PRIMARY KEY,
  dish_id      TEXT NOT NULL REFERENCES dishes(id),
  kind         TEXT NOT NULL CHECK (kind IN ('size', 'addon', 'spice', 'choice')),
  group_name   TEXT,                         -- the list's name, for kind 'choice'
  ref_dish_id  TEXT REFERENCES dishes(id),   -- the menu dish a 'choice' is
  name         TEXT NOT NULL,
  price_cents  INTEGER NOT NULL DEFAULT 0,   -- added to the dish's price
  sort         INTEGER NOT NULL DEFAULT 0
);
INSERT INTO dish_options_new (id, dish_id, kind, group_name, ref_dish_id, name, price_cents, sort)
  SELECT id, dish_id, kind, NULL, NULL, name, price_cents, sort FROM dish_options;
DROP TABLE dish_options;
ALTER TABLE dish_options_new RENAME TO dish_options;
CREATE INDEX idx_dish_options_dish ON dish_options(dish_id, sort);
