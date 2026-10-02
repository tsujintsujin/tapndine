-- tapndine: tap an NFC tag at a table, get that restaurant's menu.
--
-- The tag only carries its own random id. Which business and table it belongs
-- to lives here, so a tag can be moved between tables without rewriting it.

CREATE TABLE businesses (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,        -- "hikay"
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL             -- unix ms
);

CREATE TABLE tables (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES businesses(id),
  label        TEXT NOT NULL,              -- "Table 2"
  sort         INTEGER NOT NULL DEFAULT 0
);

-- id is what is written on the physical tag: random, so nobody can walk the
-- tables by counting. table_id is nullable: a tag not yet placed still opens
-- the menu, just without a table number.
CREATE TABLE tags (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES businesses(id),
  table_id     TEXT REFERENCES tables(id),
  created_at   INTEGER NOT NULL
);

CREATE TABLE categories (
  id           TEXT PRIMARY KEY,
  business_id  TEXT NOT NULL REFERENCES businesses(id),
  name         TEXT NOT NULL,              -- "Seafood", "Halal"
  sort         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE dishes (
  id                 TEXT PRIMARY KEY,
  business_id        TEXT NOT NULL REFERENCES businesses(id),
  name               TEXT NOT NULL,
  short_description  TEXT NOT NULL,        -- one line, beside the price
  description        TEXT NOT NULL,
  price_cents        INTEGER NOT NULL,     -- PHP centavos
  image_url          TEXT,
  spice_level        INTEGER CHECK (spice_level BETWEEN 0 AND 5),  -- NULL: not applicable (drinks)
  serves_min         INTEGER NOT NULL DEFAULT 1,   -- how many people one order feeds
  serves_max         INTEGER NOT NULL DEFAULT 1,
  available          INTEGER NOT NULL DEFAULT 1,   -- 0 = sold out
  featured           INTEGER NOT NULL DEFAULT 0,   -- the hero on the menu home
  best_seller        INTEGER NOT NULL DEFAULT 0,   -- the three under the hero
  sort               INTEGER NOT NULL DEFAULT 0
);

-- A dish can sit in several categories: a chicken dish under both Chicken and Halal.
CREATE TABLE dish_categories (
  dish_id      TEXT NOT NULL REFERENCES dishes(id),
  category_id  TEXT NOT NULL REFERENCES categories(id),
  sort         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dish_id, category_id)
);

-- kind picks the icon; it is one of the kinds in lib/ingredients.ts.
CREATE TABLE dish_ingredients (
  dish_id  TEXT NOT NULL REFERENCES dishes(id),
  name     TEXT NOT NULL,
  kind     TEXT NOT NULL,
  sort     INTEGER NOT NULL DEFAULT 0
);

-- One row per tap. id is the random part of the menu URL. The visit lives
-- until 30 minutes after its last activity; after that the URL is dead and
-- the only way back in is another tap.
CREATE TABLE visits (
  id            TEXT PRIMARY KEY,
  tag_id        TEXT NOT NULL REFERENCES tags(id),
  business_id   TEXT NOT NULL REFERENCES businesses(id),
  table_id      TEXT REFERENCES tables(id),
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);

CREATE INDEX idx_dishes_business ON dishes(business_id, sort);
CREATE INDEX idx_categories_business ON categories(business_id, sort);
CREATE INDEX idx_dish_categories_category ON dish_categories(category_id, sort);
CREATE INDEX idx_dish_ingredients_dish ON dish_ingredients(dish_id, sort);
CREATE INDEX idx_visits_expires ON visits(expires_at);
