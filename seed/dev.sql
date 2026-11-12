-- Sample restaurant for local development. Fake data, safe to commit.
-- Apply with `npm run db:reset`.
--
-- Tag links to try (npm run dev, then open):
--   http://127.0.0.1:3300/t/k7x9q2mp   -> Table 1
--   http://127.0.0.1:3300/t/r4tb8wzc   -> Table 2
--   http://127.0.0.1:3300/t/b3744013e9f6   -> not placed at a table yet

INSERT INTO businesses (id, slug, name, created_at) VALUES
  ('biz_hikay', 'hikay', 'Hikay', 1759104000000);

INSERT INTO tables (id, business_id, label, sort) VALUES
  ('tbl_hikay_1', 'biz_hikay', 'Table 1', 1),
  ('tbl_hikay_2', 'biz_hikay', 'Table 2', 2);

INSERT INTO tags (id, business_id, table_id, created_at) VALUES
  ('k7x9q2mp', 'biz_hikay', 'tbl_hikay_1', 1759104000000),
  ('r4tb8wzc', 'biz_hikay', 'tbl_hikay_2', 1759104000000),
  ('b3744013e9f6', 'biz_hikay', NULL,          1759104000000);

INSERT INTO categories (id, business_id, name, sort) VALUES
  ('cat_seafood', 'biz_hikay', 'Seafood',    1),
  ('cat_chicken', 'biz_hikay', 'Chicken',    2),
  ('cat_pork',    'biz_hikay', 'Pork',       3),
  ('cat_beef',    'biz_hikay', 'Beef',       4),
  ('cat_veg',     'biz_hikay', 'Vegetables', 5),
  ('cat_halal',   'biz_hikay', 'Halal',      6);

-- image_url NULL = no photo yet; the menu shows a placeholder.
INSERT INTO dishes (id, business_id, name, short_description, description, price_cents, image_url, spice_level, available, featured, best_seller, sort) VALUES
  ('d_karekare', 'biz_hikay', 'Kare-Kare', 'Oxtail in peanut sauce',
   'Slow-braised oxtail and tripe in a thick, nutty peanut sauce with bok choy, eggplant and string beans. Served with sautéed shrimp paste on the side.',
   49500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/kare-kare', 0, 1, 1, 0, 1),
  ('d_sinigang', 'biz_hikay', 'Sinigang na Hipon', 'Sour tamarind shrimp soup',
   'Fresh shrimp simmered in a sour tamarind broth with radish, kangkong, okra, tomatoes and long green chili.',
   38500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/sinigang-hipon', 1, 1, 0, 1, 2),
  ('d_inasal', 'biz_hikay', 'Chicken Inasal', 'Grilled annatto chicken',
   'Chicken leg quarter marinated in calamansi, lemongrass and ginger, basted with annatto oil and grilled over charcoal. Served with garlic rice and a soy-calamansi dip.',
   24500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/chicken-inasal', 0, 1, 0, 1, 3),
  ('d_sisig', 'biz_hikay', 'Pork Sisig', 'Sizzling chopped pork',
   'Crispy chopped pork with onions and chili, served sizzling on a hot plate and topped with a raw egg. Mix it in while it is still hot.',
   32000, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/pork-sisig', 3, 1, 0, 1, 4),
  ('d_crispypata', 'biz_hikay', 'Crispy Pata', 'Deep-fried pork leg',
   'Whole pork leg simmered until tender, then deep-fried until the skin crackles. Served with a soy-vinegar and chili dip.',
   69500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/crispy-pata', 0, 1, 0, 0, 5),
  ('d_adobongpusit', 'biz_hikay', 'Adobong Pusit', 'Squid in its own ink',
   'Tender squid cooked in vinegar, garlic and its own ink, finished with tomatoes and onions.',
   34000, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/adobong-pusit', 1, 0, 0, 0, 6),
  ('d_bicolexpress', 'biz_hikay', 'Bicol Express', 'Pork in spicy coconut milk',
   'Pork belly stewed in coconut milk and shrimp paste with plenty of chili. Rich and properly hot.',
   29500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/bicol-express', 4, 1, 0, 0, 7),
  ('d_chickenadobo', 'biz_hikay', 'Chicken Adobo', 'Soy and vinegar braise',
   'Chicken braised in soy sauce, vinegar, garlic, bay leaf and black pepper until the sauce turns glossy.',
   26500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/chicken-adobo', 0, 1, 0, 0, 8),
  ('d_ginataanghipon', 'biz_hikay', 'Ginataang Hipon', 'Shrimp in coconut milk',
   'Shrimp and squash simmered in coconut milk with ginger, garlic and a little chili.',
   39500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/ginataang-hipon', 2, 1, 0, 0, 9),
  ('d_laing', 'biz_hikay', 'Laing', 'Taro leaves in coconut milk',
   'Dried taro leaves slow-cooked in coconut milk with ginger, lemongrass and chili.',
   19500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/laing', 3, 1, 0, 0, 10),
  ('d_pinakbet', 'biz_hikay', 'Pinakbet', 'Mixed vegetable stew',
   'Squash, eggplant, okra, bitter melon and string beans stewed with tomatoes and fish sauce.',
   21500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/pinakbet', 0, 1, 0, 0, 11),
  ('d_caldereta', 'biz_hikay', 'Beef Caldereta', 'Beef in tomato and liver sauce',
   'Beef chunks stewed in tomato sauce and liver spread with potatoes, carrots, bell peppers and olives.',
   42500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/beef-caldereta', 2, 1, 0, 0, 12),
  ('d_tilapia', 'biz_hikay', 'Inihaw na Tilapia', 'Grilled stuffed tilapia',
   'Whole tilapia stuffed with tomatoes, onions and ginger, wrapped in banana leaf and grilled over charcoal.',
   28500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/inihaw-tilapia', 0, 1, 0, 0, 13);

INSERT INTO dish_categories (dish_id, category_id, sort) VALUES
  ('d_sinigang',       'cat_seafood', 1),
  ('d_ginataanghipon', 'cat_seafood', 2),
  ('d_adobongpusit',   'cat_seafood', 3),
  ('d_tilapia',        'cat_seafood', 4),
  ('d_inasal',         'cat_chicken', 1),
  ('d_chickenadobo',   'cat_chicken', 2),
  ('d_sisig',          'cat_pork', 1),
  ('d_crispypata',     'cat_pork', 2),
  ('d_bicolexpress',   'cat_pork', 3),
  ('d_karekare',       'cat_beef', 1),
  ('d_caldereta',      'cat_beef', 2),
  ('d_laing',          'cat_veg', 1),
  ('d_pinakbet',       'cat_veg', 2),
  ('d_inasal',         'cat_halal', 1),
  ('d_chickenadobo',   'cat_halal', 2),
  ('d_caldereta',      'cat_halal', 3),
  ('d_tilapia',        'cat_halal', 4),
  ('d_ginataanghipon', 'cat_halal', 5),
  ('d_laing',          'cat_halal', 6);

INSERT INTO dish_ingredients (dish_id, name, kind, sort) VALUES
  ('d_karekare', 'Oxtail', 'beef', 1),
  ('d_karekare', 'Beef tripe', 'beef', 2),
  ('d_karekare', 'Peanut', 'nut', 3),
  ('d_karekare', 'Bok choy', 'vegetable', 4),
  ('d_karekare', 'Eggplant', 'vegetable', 5),
  ('d_karekare', 'String beans', 'vegetable', 6),
  ('d_karekare', 'Shrimp paste', 'sauce', 7),
  ('d_karekare', 'Garlic', 'herb', 8),

  ('d_sinigang', 'Shrimp', 'seafood', 1),
  ('d_sinigang', 'Tamarind', 'fruit', 2),
  ('d_sinigang', 'Radish', 'vegetable', 3),
  ('d_sinigang', 'Kangkong', 'vegetable', 4),
  ('d_sinigang', 'Okra', 'vegetable', 5),
  ('d_sinigang', 'Tomato', 'vegetable', 6),
  ('d_sinigang', 'Long green chili', 'spice', 7),
  ('d_sinigang', 'Fish sauce', 'sauce', 8),

  ('d_inasal', 'Chicken leg', 'chicken', 1),
  ('d_inasal', 'Calamansi', 'fruit', 2),
  ('d_inasal', 'Lemongrass', 'herb', 3),
  ('d_inasal', 'Ginger', 'herb', 4),
  ('d_inasal', 'Annatto oil', 'sauce', 5),
  ('d_inasal', 'Garlic rice', 'grain', 6),

  ('d_sisig', 'Pork', 'pork', 1),
  ('d_sisig', 'Egg', 'egg', 2),
  ('d_sisig', 'Onion', 'vegetable', 3),
  ('d_sisig', 'Red chili', 'spice', 4),
  ('d_sisig', 'Calamansi', 'fruit', 5),
  ('d_sisig', 'Soy sauce', 'sauce', 6),

  ('d_crispypata', 'Pork leg', 'pork', 1),
  ('d_crispypata', 'Garlic', 'herb', 2),
  ('d_crispypata', 'Bay leaf', 'herb', 3),
  ('d_crispypata', 'Soy-vinegar dip', 'sauce', 4),

  ('d_adobongpusit', 'Squid', 'seafood', 1),
  ('d_adobongpusit', 'Vinegar', 'sauce', 2),
  ('d_adobongpusit', 'Garlic', 'herb', 3),
  ('d_adobongpusit', 'Tomato', 'vegetable', 4),
  ('d_adobongpusit', 'Onion', 'vegetable', 5),

  ('d_bicolexpress', 'Pork belly', 'pork', 1),
  ('d_bicolexpress', 'Coconut milk', 'milk', 2),
  ('d_bicolexpress', 'Shrimp paste', 'sauce', 3),
  ('d_bicolexpress', 'Bird''s eye chili', 'spice', 4),
  ('d_bicolexpress', 'Garlic', 'herb', 5),
  ('d_bicolexpress', 'Onion', 'vegetable', 6),

  ('d_chickenadobo', 'Chicken', 'chicken', 1),
  ('d_chickenadobo', 'Soy sauce', 'sauce', 2),
  ('d_chickenadobo', 'Vinegar', 'sauce', 3),
  ('d_chickenadobo', 'Garlic', 'herb', 4),
  ('d_chickenadobo', 'Bay leaf', 'herb', 5),
  ('d_chickenadobo', 'Black pepper', 'spice', 6),

  ('d_ginataanghipon', 'Shrimp', 'seafood', 1),
  ('d_ginataanghipon', 'Squash', 'vegetable', 2),
  ('d_ginataanghipon', 'Coconut milk', 'milk', 3),
  ('d_ginataanghipon', 'Ginger', 'herb', 4),
  ('d_ginataanghipon', 'Red chili', 'spice', 5),

  ('d_laing', 'Taro leaves', 'vegetable', 1),
  ('d_laing', 'Coconut milk', 'milk', 2),
  ('d_laing', 'Lemongrass', 'herb', 3),
  ('d_laing', 'Ginger', 'herb', 4),
  ('d_laing', 'Red chili', 'spice', 5),

  ('d_pinakbet', 'Squash', 'vegetable', 1),
  ('d_pinakbet', 'Eggplant', 'vegetable', 2),
  ('d_pinakbet', 'Okra', 'vegetable', 3),
  ('d_pinakbet', 'Bitter melon', 'vegetable', 4),
  ('d_pinakbet', 'String beans', 'vegetable', 5),
  ('d_pinakbet', 'Tomato', 'vegetable', 6),
  ('d_pinakbet', 'Fish sauce', 'sauce', 7),

  ('d_caldereta', 'Beef', 'beef', 1),
  ('d_caldereta', 'Tomato sauce', 'sauce', 2),
  ('d_caldereta', 'Potato', 'vegetable', 3),
  ('d_caldereta', 'Carrot', 'vegetable', 4),
  ('d_caldereta', 'Bell pepper', 'vegetable', 5),
  ('d_caldereta', 'Olives', 'fruit', 6),
  ('d_caldereta', 'Red chili', 'spice', 7),

  ('d_tilapia', 'Tilapia', 'fish', 1),
  ('d_tilapia', 'Tomato', 'vegetable', 2),
  ('d_tilapia', 'Onion', 'vegetable', 3),
  ('d_tilapia', 'Ginger', 'herb', 4),
  ('d_tilapia', 'Garlic rice', 'grain', 5);

-- Drinks. spice_level NULL: a spice rating means nothing for a drink.
INSERT INTO categories (id, business_id, name, sort) VALUES
  ('cat_drinks', 'biz_hikay', 'Drinks', 7);

INSERT INTO dishes (id, business_id, name, short_description, description, price_cents, image_url, spice_level, available, featured, best_seller, sort) VALUES
  ('d_calamansi', 'biz_hikay', 'Calamansi Juice', 'Fresh-squeezed and iced',
   'Calamansi squeezed to order, sweetened lightly with cane syrup and served over ice.',
   9500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/calamansi-juice', NULL, 1, 0, 0, 20),
  ('d_sagotgulaman', 'biz_hikay', 'Sago''t Gulaman', 'Brown sugar, pearls and jelly',
   'Chilled brown sugar syrup with tapioca pearls and cubes of gulaman jelly. Stir before drinking.',
   8500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/sagot-gulaman', NULL, 1, 0, 0, 21),
  ('d_buko', 'biz_hikay', 'Buko Juice', 'Young coconut, served whole',
   'A whole young coconut opened at the table, with a glass of its water and strips of soft coconut meat.',
   12000, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/buko-juice', NULL, 1, 0, 0, 22),
  ('d_mangoshake', 'biz_hikay', 'Mango Shake', 'Ripe mango, blended thick',
   'Ripe Philippine mangoes blended with milk and ice until thick.',
   13500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/mango-shake', NULL, 1, 0, 0, 23),
  ('d_salabat', 'biz_hikay', 'Salabat', 'Hot ginger tea',
   'Fresh ginger simmered with brown sugar and served hot. Good after a heavy meal.',
   7500, 'https://res.cloudinary.com/ipp6vibv/image/upload/f_auto,q_auto/tapndine/salabat', NULL, 1, 0, 0, 24);

INSERT INTO dish_categories (dish_id, category_id, sort) VALUES
  ('d_calamansi',    'cat_drinks', 1),
  ('d_sagotgulaman', 'cat_drinks', 2),
  ('d_buko',         'cat_drinks', 3),
  ('d_mangoshake',   'cat_drinks', 4),
  ('d_salabat',      'cat_drinks', 5);

INSERT INTO dish_ingredients (dish_id, name, kind, sort) VALUES
  ('d_calamansi', 'Calamansi', 'fruit', 1),
  ('d_calamansi', 'Cane syrup', 'sweet', 2),
  ('d_sagotgulaman', 'Brown sugar syrup', 'sweet', 1),
  ('d_sagotgulaman', 'Tapioca pearls', 'grain', 2),
  ('d_sagotgulaman', 'Gulaman jelly', 'sweet', 3),
  ('d_buko', 'Young coconut', 'fruit', 1),
  ('d_mangoshake', 'Ripe mango', 'fruit', 1),
  ('d_mangoshake', 'Milk', 'milk', 2),
  ('d_mangoshake', 'Sugar', 'sweet', 3),
  ('d_salabat', 'Ginger', 'herb', 1),
  ('d_salabat', 'Brown sugar', 'sweet', 2);

-- How many people one order feeds; shown as the serving badge on each card.
UPDATE dishes SET serves_min = 2, serves_max = 4 WHERE id = 'd_karekare';
UPDATE dishes SET serves_min = 2, serves_max = 3 WHERE id IN ('d_sinigang', 'd_sisig', 'd_caldereta');
UPDATE dishes SET serves_min = 3, serves_max = 4 WHERE id = 'd_crispypata';
UPDATE dishes SET serves_min = 2, serves_max = 2 WHERE id IN ('d_adobongpusit', 'd_bicolexpress', 'd_ginataanghipon', 'd_laing', 'd_pinakbet');
UPDATE dishes SET serves_min = 1, serves_max = 2 WHERE id IN ('d_chickenadobo', 'd_tilapia');
-- Chicken Inasal and every drink keep the default: 1 person.

-- "New on the menu" on the menu home.
UPDATE dishes SET is_new = 1 WHERE id IN ('d_crispypata', 'd_ginataanghipon', 'd_mangoshake');

-- Dish options: Sisig needs a size picked; the shake's size is optional (Regular is picked).
INSERT INTO dish_options (id, dish_id, kind, name, price_cents, sort) VALUES
  ('o_sisig_solo',    'd_sisig', 'size',  'Solo',            0, 1),
  ('o_sisig_sharing', 'd_sisig', 'size',  'Sharing',     16000, 2),
  ('o_sisig_egg',     'd_sisig', 'addon', 'Extra egg',    2000, 3),
  ('o_sisig_rice',    'd_sisig', 'addon', 'Garlic rice',  4500, 4),
  ('o_sisig_chich',   'd_sisig', 'addon', 'Chicharon bits', 3500, 5),
  ('o_sisig_less',    'd_sisig', 'spice', 'Less spicy',      0, 6),
  ('o_sisig_extra',   'd_sisig', 'spice', 'Extra spicy',     0, 7),
  ('o_shake_reg',     'd_mangoshake', 'size', 'Regular',     0, 1),
  ('o_shake_large',   'd_mangoshake', 'size', 'Large',    4000, 2);
UPDATE dishes SET size_required = 0 WHERE id = 'd_mangoshake';

-- A set meal: Chicken Inasal comes with a drink from the menu, one of them.
INSERT INTO dish_options (id, dish_id, kind, group_name, ref_dish_id, name, price_cents, sort) VALUES
  ('o_inasal_calamansi', 'd_inasal', 'choice', 'Drink', 'd_calamansi',  'Calamansi Juice',    0, 1),
  ('o_inasal_buko',      'd_inasal', 'choice', 'Drink', 'd_buko',       'Buko Juice',         0, 2),
  ('o_inasal_shake',     'd_inasal', 'choice', 'Drink', 'd_mangoshake', 'Mango Shake',     3000, 3);

-- Staff logins for local testing only (test passwords, not used anywhere real).
-- Log in at http://localhost:3300/login
--   hikay-manager  /  menu-manager-1   (the owner: every page)
--   hikay-ana      /  menu-waiter-1    (waiter)
--   hikay-ben      /  menu-waiter-2    (waiter)
INSERT INTO staff (id, business_id, username, name, role, password_hash, created_at) VALUES
  ('stf_manager', 'biz_hikay', 'hikay-manager', 'Maria', 'owner',   'pbkdf2$100000$UHlgEdRVU3kBmrkb3e2kqg==$K87FEMgEY6BA24McQLEH6mnP6DBeF+cu3KBK31oyGZc=', 1759104000000),
  ('stf_ana',     'biz_hikay', 'hikay-ana',     'Ana',   'waiter',  'pbkdf2$100000$lXqb0TwglEIW9tdJaCsTMQ==$gOngCTX4ON30TOLCKxdG4aOzWowJIHx4hqZg9lFX5Ks=',  1759104000000),
  ('stf_ben',     'biz_hikay', 'hikay-ben',     'Ben',   'waiter',  'pbkdf2$100000$a3HOzJVIAUpr4uAYYgVb5A==$j53PVo4LAarwQr8Yp/14Mu1gI2yXnBQ3V1fq1ZP/c5Q=',  1759104000000);
