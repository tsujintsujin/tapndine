import { INGREDIENT_LABELS } from "@/app/components/Icons";
import { db } from "./cf";
import { randomId } from "./ids";
import { toOption, type Ingredient, type OptionRow } from "./menu";
import { OPTION_KINDS, type DishOption, type OptionKind } from "./options";

// The manager's menu editor: dishes, the categories they sit in, and the
// order both appear in. One order runs through the whole menu: a category's
// dishes appear in the same order as on the full menu.

export type AdminDish = {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  spiceLevel: number | null;
  servesMin: number;
  servesMax: number;
  available: boolean;
  featured: boolean;
  bestSeller: boolean;
  isNew: boolean;
  categoryIds: string[];
  ingredients: Ingredient[];
  /** Sizes, add-ons and spice choices (lib/options.ts). A kind is on when it has options. */
  options: DishOption[];
  sizeRequired: boolean;
  /** What the sizes are called when they aren't sizes ("Meat"); null shows "Size". */
  sizeLabel: string | null;
};

/** `parentId` is the main category it sits under. `dishCount` includes its sub-categories' dishes. */
export type AdminCategory = { id: string; name: string; parentId: string | null; dishCount: number };

type Row = {
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

/** Every dish still on the menu (sold out included) and every category, in menu order. */
export async function loadMenuAdmin(businessId: string) {
  const d = db();
  const [dishes, cats, links, ingredients, options] = await d.batch([
    d
      .prepare(
        `SELECT id, name, short_description, description, price_cents, image_url, spice_level,
                serves_min, serves_max, available, featured, best_seller, is_new, size_required, size_label
         FROM dishes WHERE business_id = ? AND removed_at IS NULL ORDER BY sort, name`
      )
      .bind(businessId),
    d.prepare("SELECT id, name, parent_id FROM categories WHERE business_id = ? ORDER BY sort, name").bind(businessId),
    d
      .prepare(
        `SELECT dc.dish_id, dc.category_id FROM dish_categories dc
         JOIN dishes x ON x.id = dc.dish_id
         WHERE x.business_id = ? AND x.removed_at IS NULL`
      )
      .bind(businessId),
    d
      .prepare(
        `SELECT di.dish_id, di.name, di.kind FROM dish_ingredients di
         JOIN dishes x ON x.id = di.dish_id
         WHERE x.business_id = ? AND x.removed_at IS NULL ORDER BY di.sort`
      )
      .bind(businessId),
    d
      .prepare(
`SELECT o.id, o.dish_id, o.kind, o.group_name, o.ref_dish_id, COALESCE(r.name, o.name) AS name, o.price_cents
         FROM dish_options o
         LEFT JOIN dishes r ON r.id = o.ref_dish_id
         JOIN dishes x ON x.id = o.dish_id
         WHERE x.business_id = ? AND x.removed_at IS NULL AND (o.ref_dish_id IS NULL OR r.removed_at IS NULL) ORDER BY o.sort`
      )
      .bind(businessId),
  ]);

  const list: AdminDish[] = (dishes.results as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    shortDescription: r.short_description,
    description: r.description,
    priceCents: r.price_cents,
    imageUrl: r.image_url,
    spiceLevel: r.spice_level,
    servesMin: r.serves_min,
    servesMax: r.serves_max,
    available: r.available === 1,
    featured: r.featured === 1,
    bestSeller: r.best_seller === 1,
    isNew: r.is_new === 1,
    categoryIds: [],
    ingredients: [],
    options: [],
    sizeRequired: r.size_required === 1,
    sizeLabel: r.size_label,
  }));
  const byId = new Map(list.map((x) => [x.id, x]));
  for (const l of links.results as { dish_id: string; category_id: string }[]) {
    byId.get(l.dish_id)?.categoryIds.push(l.category_id);
  }
  for (const i of ingredients.results as { dish_id: string; name: string; kind: string }[]) {
    byId.get(i.dish_id)?.ingredients.push({ name: i.name, kind: i.kind });
  }
  for (const o of options.results as OptionRow[]) {
    byId.get(o.dish_id)?.options.push(toOption(o));
  }

  // Each main category with its sub-categories right after it.
  const rows = cats.results as { id: string; name: string; parent_id: string | null }[];
  const subsOf = (id: string) => rows.filter((c) => c.parent_id === id);
  const categories: AdminCategory[] = rows
    .filter((c) => !c.parent_id)
    .flatMap((c) => [c, ...subsOf(c.id)])
    .map((c) => {
      const ids = [c.id, ...subsOf(c.id).map((s) => s.id)];
      return {
        id: c.id,
        name: c.name,
        parentId: c.parent_id,
        dishCount: list.filter((x) => x.categoryIds.some((i) => ids.includes(i))).length,
      };
    });
  return { dishes: list, categories };
}

export type DishInput = Omit<AdminDish, "id">;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : NaN);

/** Checks a dish from the editor. Returns the cleaned dish, or what to fix. */
export function parseDishInput(b: Record<string, unknown> | null): DishInput | string {
  if (!b) return "Nothing was sent.";
  const name = str(b.name);
  if (!name || name.length > 60) return "Give the dish a name (up to 60 characters).";
  const shortDescription = str(b.shortDescription);
  if (!shortDescription || shortDescription.length > 80) return "Add a one-line description (up to 80 characters).";
  const description = str(b.description);
  if (description.length > 600) return "Keep the full description under 600 characters.";
  const priceCents = int(b.priceCents);
  if (!(priceCents >= 0 && priceCents <= 10_000_000)) return "Enter a price.";
  const imageUrl = str(b.imageUrl) || null;
  if (imageUrl && !imageUrl.startsWith("https://res.cloudinary.com/")) return "Upload the photo again.";
  const spiceLevel = b.spiceLevel === null ? null : int(b.spiceLevel);
  if (spiceLevel !== null && !(spiceLevel >= 0 && spiceLevel <= 5)) return "Spice level is 0 to 5.";
  const servesMin = int(b.servesMin);
  const servesMax = int(b.servesMax);
  if (!(servesMin >= 1 && servesMax >= servesMin && servesMax <= 30)) return "Check how many people it serves.";
  const categoryIds = Array.isArray(b.categoryIds) ? [...new Set(b.categoryIds.filter((c) => typeof c === "string"))] : [];
  const raw = Array.isArray(b.ingredients) ? b.ingredients : [];
  const ingredients: Ingredient[] = [];
  for (const i of raw as Record<string, unknown>[]) {
    const n = str(i?.name);
    const kind = str(i?.kind);
    if (!n) continue;
    if (n.length > 40 || !(kind in INGREDIENT_LABELS)) return "Check the ingredients.";
    ingredients.push({ name: n, kind });
  }
  if (ingredients.length > 20) return "Up to 20 ingredients.";
  const options: DishOption[] = [];
  for (const o of (Array.isArray(b.options) ? b.options : []) as Record<string, unknown>[]) {
    const n = str(o?.name);
    const kind = str(o?.kind) as OptionKind;
    if (!n) continue;
    if (!OPTION_KINDS.includes(kind)) return "Check the options.";
    if (n.length > 40) return "Keep each option under 40 characters.";
    const cents = int(o?.priceCents);
    if (!(cents >= 0 && cents <= 10_000_000)) return `Check the price of ${n}.`;
    // An id the editor got from loadMenuAdmin; saveDish keeps it only if it is this dish's.
    const id = typeof o?.id === "string" && /^o_[\w-]{1,40}$/.test(o.id) ? o.id : "";
    // A set meal choice is a dish from the menu, in a named list ("Drink"); the other kinds have neither.
    const group = kind === "choice" ? str(o?.group) : null;
    if (group !== null && (!group || group.length > 30)) return "Name each set meal list (up to 30 characters).";
    const ref = kind === "choice" ? str(o?.ref) : null;
    if (ref !== null && !/^d_[\w-]{1,40}$/.test(ref)) return "Pick each set meal choice from the menu.";
    options.push({ id, kind, group, ref, name: n, priceCents: cents });
  }
  if (new Set(options.filter((o) => o.kind === "choice").map((o) => o.group)).size > 5) return "Up to 5 choose-one lists.";
  if (OPTION_KINDS.some((k) => options.filter((o) => o.kind === k).length > 20)) return "Up to 20 choices of each kind.";
  // Kept only with sizes, and only when it says something other than "Size".
  const label = str(b.sizeLabel);
  if (label.length > 20) return "Keep what the sizes are called under 20 characters.";
  const sizeLabel = options.some((o) => o.kind === "size") && label && label.toLowerCase() !== "size" ? label : null;
  return {
    name,
    shortDescription,
    description,
    priceCents,
    imageUrl,
    spiceLevel,
    servesMin,
    servesMax,
    available: b.available !== false,
    featured: b.featured === true,
    bestSeller: b.bestSeller === true,
    isNew: b.isNew === true,
    categoryIds,
    ingredients,
    options,
    sizeRequired: b.sizeRequired !== false,
    sizeLabel,
  };
}

/** Creates the dish (id null) or replaces it. Returns its id, or null if it isn't this business's. */
export async function saveDish(businessId: string, id: string | null, x: DishInput): Promise<string | null> {
  const d = db();
  // Only this restaurant's own categories.
  const own = await d
    .prepare("SELECT id FROM categories WHERE business_id = ? AND id IN (SELECT value FROM json_each(?))")
    .bind(businessId, JSON.stringify(x.categoryIds))
    .all<{ id: string }>();
  const categoryIds = x.categoryIds.filter((c) => own.results.some((o) => o.id === c));

  let sort: number;
  if (id) {
    const row = await d
      .prepare("SELECT sort FROM dishes WHERE id = ? AND business_id = ? AND removed_at IS NULL")
      .bind(id, businessId)
      .first<{ sort: number }>();
    if (!row) return null;
    sort = row.sort;
  } else {
    // New dishes go to the end of the menu.
    const last = await d.prepare("SELECT MAX(sort) AS s FROM dishes WHERE business_id = ?").bind(businessId).first<{ s: number | null }>();
    sort = (last?.s ?? 0) + 1;
    id = "d_" + randomId();
  }

  // Option ids stay the same across saves, so a guest's open order still matches.
  // An id that is new, or not this dish's, gets a fresh one.
  const mine = await d.prepare("SELECT id FROM dish_options WHERE dish_id = ?").bind(id).all<{ id: string }>();
  const keep = new Set(mine.results.map((o) => o.id));
  // Each kept id is used once, so a doubled id can't collide on insert.
  const options = x.options.map((o) => ({ ...o, id: keep.delete(o.id) ? o.id : "o_" + randomId() }));
  // Set meal choices only from this restaurant's own menu, never the dish itself; the name is the dish's.
  const refs = options.filter((o) => o.ref).map((o) => o.ref!);
  if (refs.length) {
    const menu = await d
      .prepare("SELECT id, name FROM dishes WHERE business_id = ? AND removed_at IS NULL AND id IN (SELECT value FROM json_each(?))")
      .bind(businessId, JSON.stringify(refs))
      .all<{ id: string; name: string }>();
    const names = new Map(menu.results.map((m) => [m.id, m.name]));
    if (refs.some((r) => r === id || !names.has(r))) return null;
    for (const o of options) if (o.ref) o.name = names.get(o.ref)!;
  }

  const values = [
    x.name, x.shortDescription, x.description, x.priceCents, x.imageUrl, x.spiceLevel,
    x.servesMin, x.servesMax, +x.available, +x.featured, +x.bestSeller, +x.isNew, +x.sizeRequired, x.sizeLabel,
  ];
  await d.batch([
    d
      .prepare(
        `INSERT INTO dishes (id, business_id, sort, name, short_description, description, price_cents, image_url,
                             spice_level, serves_min, serves_max, available, featured, best_seller, is_new, size_required, size_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, short_description = excluded.short_description,
           description = excluded.description, price_cents = excluded.price_cents, image_url = excluded.image_url,
           spice_level = excluded.spice_level, serves_min = excluded.serves_min, serves_max = excluded.serves_max,
           available = excluded.available, featured = excluded.featured, best_seller = excluded.best_seller,
           is_new = excluded.is_new, size_required = excluded.size_required, size_label = excluded.size_label`
      )
      .bind(id, businessId, sort, ...values),
    // The menu home has one hero: picking this one unpicks the old one.
    ...(x.featured
      ? [d.prepare("UPDATE dishes SET featured = 0 WHERE business_id = ? AND id <> ?").bind(businessId, id)]
      : []),
    d.prepare("DELETE FROM dish_categories WHERE dish_id = ?").bind(id),
    ...categoryIds.map((c) =>
      d.prepare("INSERT INTO dish_categories (dish_id, category_id, sort) VALUES (?, ?, ?)").bind(id, c, sort)
    ),
    d.prepare("DELETE FROM dish_ingredients WHERE dish_id = ?").bind(id),
    ...x.ingredients.map((i, n) =>
      d.prepare("INSERT INTO dish_ingredients (dish_id, name, kind, sort) VALUES (?, ?, ?, ?)").bind(id, i.name, i.kind, n + 1)
    ),
    d.prepare("DELETE FROM dish_options WHERE dish_id = ?").bind(id),
    ...options.map((o, n) =>
      d
        .prepare(
          "INSERT INTO dish_options (id, dish_id, kind, group_name, ref_dish_id, name, price_cents, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(o.id, id, o.kind, o.group, o.ref ?? null, o.name, o.priceCents, n + 1)
    ),
  ]);
  return id;
}

/** Off the menu for good. The row stays, because past orders point at it. */
export async function removeDish(businessId: string, id: string): Promise<boolean> {
  const d = db();
  const r = await d
    .prepare("UPDATE dishes SET removed_at = ?, featured = 0 WHERE id = ? AND business_id = ? AND removed_at IS NULL")
    .bind(Date.now(), id, businessId)
    .run();
  if (!r.meta.changes) return false;
  await d.prepare("DELETE FROM dish_categories WHERE dish_id = ?").bind(id).run();
  return true;
}

export async function setDishAvailable(businessId: string, id: string, available: boolean): Promise<boolean> {
  const r = await db()
    .prepare("UPDATE dishes SET available = ? WHERE id = ? AND business_id = ? AND removed_at IS NULL")
    .bind(+available, id, businessId)
    .run();
  return r.meta.changes > 0;
}

/** `ids`: every dish on the menu, in the new order. */
export async function reorderDishes(businessId: string, ids: string[]): Promise<boolean> {
  const d = db();
  const all = await d
    .prepare("SELECT id FROM dishes WHERE business_id = ? AND removed_at IS NULL")
    .bind(businessId)
    .all<{ id: string }>();
  if (ids.length !== all.results.length || !all.results.every((r) => ids.includes(r.id))) return false;
  await d.batch(
    ids.flatMap((id, i) => [
      d.prepare("UPDATE dishes SET sort = ? WHERE id = ?").bind(i + 1, id),
      d.prepare("UPDATE dish_categories SET sort = ? WHERE dish_id = ?").bind(i + 1, id),
    ])
  );
  return true;
}

// --- Categories ---------------------------------------------------------------

export const parseCategoryName = (v: unknown) => {
  const name = str(v);
  return name && name.length <= 30 ? name : null;
};

/** Whether this restaurant has this category as a main one, the only kind a category can sit under. */
export async function isMainCategory(businessId: string, id: string): Promise<boolean> {
  const row = await db()
    .prepare("SELECT 1 FROM categories WHERE id = ? AND business_id = ? AND parent_id IS NULL")
    .bind(id, businessId)
    .first();
  return !!row;
}

export async function createCategory(businessId: string, name: string, parentId: string | null = null): Promise<string> {
  const d = db();
  const last = await d.prepare("SELECT MAX(sort) AS s FROM categories WHERE business_id = ?").bind(businessId).first<{ s: number | null }>();
  const id = "cat_" + randomId();
  await d
    .prepare("INSERT INTO categories (id, business_id, name, parent_id, sort) VALUES (?, ?, ?, ?, ?)")
    .bind(id, businessId, name, parentId, (last?.s ?? 0) + 1)
    .run();
  return id;
}

export async function renameCategory(businessId: string, id: string, name: string): Promise<boolean> {
  const r = await db().prepare("UPDATE categories SET name = ? WHERE id = ? AND business_id = ?").bind(name, id, businessId).run();
  return r.meta.changes > 0;
}

/** Puts it under a main category (null: makes it a main one). Its dishes come along. One level deep only. */
export async function setCategoryParent(businessId: string, id: string, parentId: string | null): Promise<boolean> {
  const d = db();
  if (parentId) {
    if (parentId === id || !(await isMainCategory(businessId, parentId))) return false;
    const hasSubs = await d.prepare("SELECT 1 FROM categories WHERE parent_id = ?").bind(id).first();
    if (hasSubs) return false;
  }
  const r = await d.prepare("UPDATE categories SET parent_id = ? WHERE id = ? AND business_id = ?").bind(parentId, id, businessId).run();
  return r.meta.changes > 0;
}

/** The dishes stay on the menu; they just lose this tag. Its sub-categories become main ones. */
export async function deleteCategory(businessId: string, id: string): Promise<boolean> {
  const d = db();
  const own = await d.prepare("SELECT 1 FROM categories WHERE id = ? AND business_id = ?").bind(id, businessId).first();
  if (!own) return false;
  await d.batch([
    d.prepare("UPDATE categories SET parent_id = NULL WHERE parent_id = ?").bind(id),
    d.prepare("DELETE FROM dish_categories WHERE category_id = ?").bind(id),
    d.prepare("DELETE FROM categories WHERE id = ?").bind(id),
  ]);
  return true;
}

/**
 * Puts exactly these dishes in the category. They keep their menu order, so
 * the order of `dishIds` doesn't matter.
 */
export async function setCategoryDishes(businessId: string, id: string, dishIds: string[]): Promise<boolean> {
  const d = db();
  const own = await d.prepare("SELECT 1 FROM categories WHERE id = ? AND business_id = ?").bind(id, businessId).first();
  if (!own) return false;
  // Only this restaurant's dishes still on the menu.
  const dishes = await d
    .prepare(
      `SELECT id, sort FROM dishes
       WHERE business_id = ? AND removed_at IS NULL AND id IN (SELECT value FROM json_each(?))`
    )
    .bind(businessId, JSON.stringify(dishIds))
    .all<{ id: string; sort: number }>();
  await d.batch([
    d.prepare("DELETE FROM dish_categories WHERE category_id = ?").bind(id),
    ...dishes.results.map((x) =>
      d.prepare("INSERT INTO dish_categories (dish_id, category_id, sort) VALUES (?, ?, ?)").bind(x.id, id, x.sort)
    ),
  ]);
  return true;
}

export async function reorderCategories(businessId: string, ids: string[]): Promise<boolean> {
  const d = db();
  const all = await d.prepare("SELECT id FROM categories WHERE business_id = ?").bind(businessId).all<{ id: string }>();
  if (ids.length !== all.results.length || !all.results.every((r) => ids.includes(r.id))) return false;
  await d.batch(ids.map((id, i) => d.prepare("UPDATE categories SET sort = ? WHERE id = ?").bind(i + 1, id)));
  return true;
}

// --- Bulk upload ----------------------------------------------------------------

/**
 * Adds checked dishes from the CSV upload, in file order, at the end of the
 * menu. Categories are matched by name (any case) and made if missing. A dish
 * whose name is already on the menu is skipped, not changed.
 */
export async function importDishes(
  businessId: string,
  dishes: { input: DishInput; categoryNames: string[] }[]
): Promise<{ added: number; skipped: string[] }> {
  const d = db();
  const existing = await d
    .prepare("SELECT name FROM dishes WHERE business_id = ? AND removed_at IS NULL")
    .bind(businessId)
    .all<{ name: string }>();
  const onMenu = new Set(existing.results.map((r) => r.name.toLowerCase()));
  const cats = await d.prepare("SELECT id, name FROM categories WHERE business_id = ?").bind(businessId).all<{ id: string; name: string }>();
  const catId = new Map(cats.results.map((c) => [c.name.toLowerCase(), c.id]));

  const skipped: string[] = [];
  let added = 0;
  for (const x of dishes) {
    if (onMenu.has(x.input.name.toLowerCase())) {
      skipped.push(x.input.name);
      continue;
    }
    const categoryIds: string[] = [];
    for (const name of x.categoryNames) {
      let id = catId.get(name.toLowerCase());
      if (!id) catId.set(name.toLowerCase(), (id = await createCategory(businessId, name)));
      categoryIds.push(id);
    }
    await saveDish(businessId, null, { ...x.input, categoryIds });
    added++;
  }
  return { added, skipped };
}
