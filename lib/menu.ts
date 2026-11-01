import { db } from "./cf";
import type { DishOption, OptionKind } from "./options";
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
  /** Sizes, add-ons and spice choices, in menu order (lib/options.ts). */
  options: DishOption[];
  /** With sizes: the guest has to pick one before adding. */
  sizeRequired: boolean;
};

export type MenuDesign = "a" | "b";

export type Category = { id: string; name: string; dishIds: string[] };

export type Menu = {
  businessName: string;
  /** The restaurant's own logo (Cloudinary URL), or null for name only. */
  logoUrl: string | null;
  /** Which look the menu has; the manager picks it (migration 0016). */
  design: MenuDesign;
  /** The colour scheme the manager picked (lib/palettes.ts), or null for the design's own. */
  palette: string | null;
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
  size_required: number;
};

export type OptionRow = {
  id: string;
  dish_id: string;
  kind: OptionKind;
  group_name: string | null;
  ref_dish_id: string | null;
  name: string;
  price_cents: number;
};
export const toOption = (o: OptionRow): DishOption => ({
  id: o.id,
  kind: o.kind,
  group: o.group_name,
  ref: o.ref_dish_id,
  name: o.name,
  priceCents: o.price_cents,
});

/**
 * A set meal choice shows only while its dish is on the menu today: sold out
 * or removed, it drops out of the list. Use with "LEFT JOIN dishes r ON r.id = o.ref_dish_id".
 */
export const CHOICE_ON_MENU = "(o.ref_dish_id IS NULL OR (r.available = 1 AND r.removed_at IS NULL))";

/** Everything the menu screens need, for the business the visit belongs to. */
export async function loadMenu(visit: Visit): Promise<Menu | null> {
  const d = db();
  const [biz, table, cats, dishes, links, ingredients, options] = await d.batch([
    d.prepare("SELECT name, logo_url, menu_design, menu_palette FROM businesses WHERE id = ?").bind(visit.business_id),
    d.prepare("SELECT label FROM tables WHERE id = ?").bind(visit.table_id),
    d
      .prepare("SELECT id, name FROM categories WHERE business_id = ? ORDER BY sort, name")
      .bind(visit.business_id),
    d
      .prepare(
        `SELECT id, name, short_description, description, price_cents, image_url,
                spice_level, serves_min, serves_max, available, featured, best_seller, is_new, size_required
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
    d
      .prepare(
`SELECT o.id, o.dish_id, o.kind, o.group_name, o.ref_dish_id, COALESCE(r.name, o.name) AS name, o.price_cents
         FROM dish_options o
         LEFT JOIN dishes r ON r.id = o.ref_dish_id
         JOIN dishes x ON x.id = o.dish_id
         WHERE x.business_id = ? AND ${CHOICE_ON_MENU} ORDER BY o.sort`
      )
      .bind(visit.business_id),
  ]);

  const business = (biz.results as { name: string; logo_url: string | null; menu_design: string; menu_palette: string | null }[])[0];
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
      options: [],
      sizeRequired: r.size_required === 1,
    };
    dishOrder.push(r.id);
  }
  for (const i of ingredients.results as { dish_id: string; name: string; kind: string }[]) {
    byId[i.dish_id]?.ingredients.push({ name: i.name, kind: i.kind });
  }
  for (const o of options.results as OptionRow[]) {
    byId[o.dish_id]?.options.push(toOption(o));
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
    logoUrl: business.logo_url,
    design: business.menu_design === "b" ? "b" : "a",
    palette: business.menu_palette,
    tableLabel: (table.results as { label: string }[])[0]?.label ?? null,
    // An empty category would be a dead end in the Menu list.
    categories: categories.filter((c) => c.dishIds.length > 0),
    dishes: byId,
    dishOrder,
  };
}
