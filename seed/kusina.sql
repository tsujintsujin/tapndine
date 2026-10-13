-- A second sample restaurant, for testing that restaurants stay apart.
-- Fake data, safe to commit. Applied after dev.sql by `npm run db:seed`.
--
-- Kusina Dos is a copy of the first sample's menu (same prices, photos,
-- categories, ingredients and home picks) with its own dish names, tables,
-- tags and logins. Every copied id starts "k2_".
--
-- Tag links to try (npm run dev, then open):
--   http://127.0.0.1:3300/t/p5mw2xqa   -> Table 1
--   http://127.0.0.1:3300/t/t8vc3nje   -> Table 2
--
-- Logins (test passwords, not used anywhere real):
--   kusina-dos-manager  /  kusina-manager-1   (manager)
--   kusina-dos-ana      /  kusina-waiter-1    (waiter)

INSERT INTO businesses (id, slug, name, created_at) VALUES
  ('biz_kusina', 'kusina-dos', 'Kusina Dos', 1759104000000);

INSERT INTO tables (id, business_id, label, sort) VALUES
  ('tbl_kusina_1', 'biz_kusina', 'Table 1', 1),
  ('tbl_kusina_2', 'biz_kusina', 'Table 2', 2);

INSERT INTO tags (id, business_id, table_id, created_at) VALUES
  ('p5mw2xqa', 'biz_kusina', 'tbl_kusina_1', 1759104000000),
  ('t8vc3nje', 'biz_kusina', 'tbl_kusina_2', 1759104000000);

INSERT INTO categories (id, business_id, name, sort)
SELECT 'k2_' || id, 'biz_kusina', name, sort FROM categories WHERE business_id = 'biz_hikay';

INSERT INTO dishes (id, business_id, name, short_description, description, price_cents, image_url, spice_level,
                    serves_min, serves_max, available, featured, best_seller, sort, is_new)
SELECT 'k2_' || id, 'biz_kusina', name, short_description, description, price_cents, image_url, spice_level,
       serves_min, serves_max, available, featured, best_seller, sort, is_new
FROM dishes WHERE business_id = 'biz_hikay' AND removed_at IS NULL;

INSERT INTO dish_categories (dish_id, category_id, sort)
SELECT 'k2_' || dc.dish_id, 'k2_' || dc.category_id, dc.sort
FROM dish_categories dc JOIN dishes d ON d.id = dc.dish_id
WHERE d.business_id = 'biz_hikay' AND d.removed_at IS NULL;

INSERT INTO dish_ingredients (dish_id, name, kind, sort)
SELECT 'k2_' || di.dish_id, di.name, di.kind, di.sort
FROM dish_ingredients di JOIN dishes d ON d.id = di.dish_id
WHERE d.business_id = 'biz_hikay' AND d.removed_at IS NULL;

-- Its own names for the same dishes.
UPDATE dishes SET name = CASE id
  WHEN 'k2_d_karekare'       THEN 'Kare-Kare ni Lola'
  WHEN 'k2_d_sinigang'       THEN 'Sinigang sa Sampalok'
  WHEN 'k2_d_inasal'         THEN 'Bacolod Inasal'
  WHEN 'k2_d_sisig'          THEN 'Sizzling Sisig'
  WHEN 'k2_d_crispypata'     THEN 'Crispy Pata Espesyal'
  WHEN 'k2_d_adobongpusit'   THEN 'Pusit sa Tinta'
  WHEN 'k2_d_bicolexpress'   THEN 'Sili Express'
  WHEN 'k2_d_chickenadobo'   THEN 'Adobong Manok'
  WHEN 'k2_d_ginataanghipon' THEN 'Hipon sa Gata'
  WHEN 'k2_d_laing'          THEN 'Laing Bicolana'
  WHEN 'k2_d_pinakbet'       THEN 'Pakbet Ilocano'
  WHEN 'k2_d_caldereta'      THEN 'Kalderetang Baka'
  WHEN 'k2_d_tilapia'        THEN 'Tilapia sa Uling'
  WHEN 'k2_d_calamansi'      THEN 'Kalamansi Iced'
  WHEN 'k2_d_sagotgulaman'   THEN 'Palamig'
  WHEN 'k2_d_buko'           THEN 'Buko Fresh'
  WHEN 'k2_d_mangoshake'     THEN 'Mango Smoothie'
  WHEN 'k2_d_salabat'        THEN 'Ginger Salabat'
  ELSE name END
WHERE business_id = 'biz_kusina';

INSERT INTO staff (id, business_id, username, name, role, password_hash, created_at) VALUES
  ('stf_kusina_manager', 'biz_kusina', 'kusina-dos-manager', 'Rosa', 'manager', 'pbkdf2$100000$BVgrHvIM+y35tLroJU+pjg==$iRSGtxfuttnki0qaLzyaV68HaqkJiCme1X23e6EX+ZI=', 1759104000000),
  ('stf_kusina_ana',     'biz_kusina', 'kusina-dos-ana',     'Ana',  'waiter',  'pbkdf2$100000$GpG/sCHVO1bxhku0wIDK9w==$7RNl7NOW5597ZD5l7nGSIgEg7n/FWNcNmffqz+jJ5+Q=', 1759104000000);
