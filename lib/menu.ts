import { db } from "./cf";
import type { Visit } from "./visits";

export type Ingredient = { name: string; kind: string };

export type Dish = {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  /** 0-5, or null when it does not apply (drinks). */
  spiceLevel: number | null;
  /** How many people one order feeds. */
  servesMin: number;
  servesMax: number;
  available: boolean;
  featured: boolean;
  bestSeller: boolean;
  /** Shown under "New on the menu" on the menu home. */
  isNew: boolean;
  ingredients: Ingredient[];
};

export type Category = { id: string; name: string; dishIds: string[] };

export type Menu = {
  businessName: string;
  tableLabel: string | null;
  categories: Category[];
  /** Keyed by id; categories and the home sections refer to dishes by id. */
  dishes: Record<string, Dish>;
  /** In menu order. */
  dishOrder: string[];
};

type DishRow = {
  id: string;
  name: string;
  short_description: string;
  description: string;
  price_cents: number;
  image_url: string | null;
  spice_level: number | null;
  serves_min: number;
  serves_max: number;
  available: number;
  featured: number;
  best_seller: number;
  is_new: number;
};

/** Everything the menu screens need, for the business the visit belongs to. */
export async function loadMenu(visit: Visit): Promise<Menu | null> {
  const d = db();
  const [biz, table, cats, dishes, links, ingredients] = await d.batch([
    d.prepare("SELECT name FROM businesses WHERE id = ?").bind(visit.business_id),
    d.prepare("SELECT label FROM tables WHERE id = ?").bind(visit.table_id),
    d
      .prepare("SELECT id, name FROM categories WHERE business_id = ? ORDER BY sort, name")
      .bind(visit.business_id),
    d
      .prepare(
        `SELECT id, name, short_description, description, price_cents, image_url,
                spice_level, serves_min, serves_max, available, featured, best_seller, is_new
         FROM dishes WHERE business_id = ? AND removed_at IS NULL ORDER BY sort, name`
      )
      .bind(visit.business_id),
    d
      .prepare(
        `SELECT dc.category_id, dc.dish_id FROM dish_categories dc
         JOIN categories c ON c.id = dc.category_id
         WHERE c.business_id = ? ORDER BY dc.sort`
      )
      .bind(visit.business_id),
    d
      .prepare(
        `SELECT di.dish_id, di.name, di.kind FROM dish_ingredients di
         JOIN dishes x ON x.id = di.dish_id
         WHERE x.business_id = ? ORDER BY di.sort`
      )
      .bind(visit.business_id),
  ]);

  const business = (biz.results as { name: string }[])[0];
  if (!business) return null;

  const byId: Record<string, Dish> = {};
  const dishOrder: string[] = [];
  for (const r of dishes.results as DishRow[]) {
    byId[r.id] = {
      id: r.id,
      name: r.name,
      shortDescription: r.short_description,
      description: r.description,
      priceCents: r.price_cents,
      // Full Cloudinary URLs (cloud dopunn7eb, folder tapndine/).
      imageUrl: r.image_url,
      spiceLevel: r.spice_level,
      servesMin: r.serves_min,
      servesMax: r.serves_max,
      available: r.available === 1,
      featured: r.featured === 1,
      bestSeller: r.best_seller === 1,
      isNew: r.is_new === 1,
      ingredients: [],
    };
    dishOrder.push(r.id);
  }
  for (const i of ingredients.results as { dish_id: string; name: string; kind: string }[]) {
    byId[i.dish_id]?.ingredients.push({ name: i.name, kind: i.kind });
  }

  const categories: Category[] = (cats.results as { id: string; name: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
    dishIds: [],
  }));
  const catById = new Map(categories.map((c) => [c.id, c]));
  for (const l of links.results as { category_id: string; dish_id: string }[]) {
    if (byId[l.dish_id]) catById.get(l.category_id)?.dishIds.push(l.dish_id);
  }

  return {
    businessName: business.name,
    tableLabel: (table.results as { label: string }[])[0]?.label ?? null,
    // An empty category would be a dead end in the Menu list.
    categories: categories.filter((c) => c.dishIds.length > 0),
    dishes: byId,
    dishOrder,
  };
}
