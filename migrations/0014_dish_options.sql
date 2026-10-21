-- Dish options (Stage 1, Build 1): sizes, add-ons and spice choices a guest
-- picks when adding a dish. A manager switches each kind on per dish; a kind
-- is on when the dish has options of it.
--
-- size:  pick one. size_required = 0 picks the first size for the guest.
-- addon: tick any.
-- spice: pick one or none ("Less spicy"); only offered on dishes with a spice level.
CREATE TABLE dish_options (
  id           TEXT PRIMARY KEY,
  dish_id      TEXT NOT NULL REFERENCES dishes(id),
  kind         TEXT NOT NULL CHECK (kind IN ('size', 'addon', 'spice')),
  name         TEXT NOT NULL,
  price_cents  INTEGER NOT NULL DEFAULT 0,   -- added to the dish's price
  sort         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_dish_options_dish ON dish_options(dish_id, sort);

ALTER TABLE dishes ADD COLUMN size_required INTEGER NOT NULL DEFAULT 1;

-- What was picked, as the waiter reads it ("Sharing · Extra egg"), copied in
-- at send time like the name. price_cents on the line already includes it.
ALTER TABLE batch_items ADD COLUMN options TEXT;
