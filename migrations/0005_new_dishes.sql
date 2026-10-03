-- "New on the menu" on the menu home: the dishes the restaurant just added.
ALTER TABLE dishes ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0;

-- The sample restaurant's three.
UPDATE dishes SET is_new = 1 WHERE id IN ('d_crispypata', 'd_ginataanghipon', 'd_mangoshake');
