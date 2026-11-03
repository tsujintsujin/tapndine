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
  /** What the sizes are called when they aren't sizes ("Meat"); null shows "Size". */
  sizeLabel: string | null;
};

export type MenuDesign = "a" | "b" | "c";

export type SubCategory = { id: string; name: string; dishIds: string[] };
/**
 * A main category. `dishIds` includes the dishes in its sub-categories. `icon`
 * is the one the manager picked (null: guessed from the name).
 */
export type Category = SubCategory & { icon: string | null; subs: SubCategory[] };

export type Menu = {
  businessName: string;
  /** The restaurant's own logo (Cloudinary URL), or null for name only. */
  logoUrl: string | null;
  /** Which look the menu has; the manager picks it (migrations 0016, 0019). */
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
  size_label: string | null;
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
      .prepare("SELECT id, name, parent_id, icon FROM categories WHERE business_id = ? ORDER BY sort, name")
      .bind(visit.business_id),
    d
      .prepare(
        `SELECT id, name, short_description, description, price_cents, image_url,
                spice_level, serves_min, serves_max, available, featured, best_seller, is_new, size_required, size_label
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
      // Full Cloudinary URLs (cloud ipp6vibv, folder tapndine/).
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
      sizeLabel: r.size_label,
    };
    dishOrder.push(r.id);
  }
  for (const i of ingredients.results as { dish_id: string; name: string; kind: string }[]) {
    byId[i.dish_id]?.ingredients.push({ name: i.name, kind: i.kind });
  }
  for (const o of options.results as OptionRow[]) {
    byId[o.dish_id]?.options.push(toOption(o));
  }

  const rows = cats.results as { id: string; name: string; parent_id: string | null; icon: string | null }[];
  const categories: Category[] = rows
    .filter((c) => !c.parent_id)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, dishIds: [], subs: [] }));
  const mainById = new Map(categories.map((c) => [c.id, c]));
  const catById = new Map<string, SubCategory>(mainById);
  for (const c of rows) {
    if (!c.parent_id) continue;
    const sub = { id: c.id, name: c.name, dishIds: [] };
    mainById.get(c.parent_id)?.subs.push(sub);
    catById.set(c.id, sub);
  }
  for (const l of links.results as { category_id: string; dish_id: string }[]) {
    if (byId[l.dish_id]) catById.get(l.category_id)?.dishIds.push(l.dish_id);
  }
  for (const c of categories) {
    if (!c.subs.length) continue;
    // A dish in two sub-categories shows once under the main one, in menu order.
    const inIt = new Set([...c.dishIds, ...c.subs.flatMap((s) => s.dishIds)]);
    c.dishIds = dishOrder.filter((id) => inIt.has(id));
    c.subs = c.subs.filter((s) => s.dishIds.length > 0);
  }

  return {
    businessName: business.name,
    logoUrl: business.logo_url,
    // Designs B and C are hidden until their rework; every guest gets A. A
    // restaurant's stored menu_design stays as it was.
    design: "a",
    palette: business.menu_palette,
    tableLabel: (table.results as { label: string }[])[0]?.label ?? null,
    // An empty category would be a dead end in the Menu list.
    categories: categories.filter((c) => c.dishIds.length > 0),
    dishes: byId,
    dishOrder,
  };
}
