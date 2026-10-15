import { db } from "./cf";
import { randomId } from "./ids";
import { rangeStart, type Range } from "./reports";
import { hashPassword } from "./staff";
import { newTagId } from "./tables";

// The developers' screen: every restaurant on tapndine, how each is doing,
// and adding, renaming and switching them off. Developers only; the routes
// and the page check that before calling anything here.

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  off: boolean;
  tables: number;
  dishes: number;
  staff: number;
  /** Orders sent in the period, centavos; the same count as the restaurant's own dashboard. */
  sent: number;
  /** Groups that sent at least one order in the period. */
  groups: number;
  /** Tables with orders on an open bill right now. */
  ordering: number;
};

export async function restaurants(range: Range, now = Date.now()): Promise<Restaurant[]> {
  const r = await db()
    .prepare(
      `SELECT b.id, b.slug, b.name, b.disabled_at IS NOT NULL AS off,
              (SELECT COUNT(*) FROM tables t WHERE t.business_id = b.id AND t.removed_at IS NULL) AS tables,
              (SELECT COUNT(*) FROM dishes d WHERE d.business_id = b.id AND d.removed_at IS NULL) AS dishes,
              (SELECT COUNT(*) FROM staff s WHERE s.business_id = b.id AND s.disabled_at IS NULL) AS staff,
              (SELECT COALESCE(SUM(i.price_cents * i.qty), 0)
                 FROM batches x JOIN batch_items i ON i.batch_id = x.id JOIN sittings s ON s.id = x.sitting_id
                 WHERE s.business_id = b.id AND x.sent_at >= ?1 AND x.sent_at < ?2) AS sent,
              (SELECT COUNT(DISTINCT x.sitting_id)
                 FROM batches x JOIN sittings s ON s.id = x.sitting_id
                 WHERE s.business_id = b.id AND x.sent_at >= ?1 AND x.sent_at < ?2) AS groups,
              (SELECT COUNT(*) FROM sittings s
                 WHERE s.business_id = b.id AND s.closed_at IS NULL
                   AND EXISTS (SELECT 1 FROM batches x WHERE x.sitting_id = s.id)) AS ordering
       FROM businesses b ORDER BY b.name`
    )
    .bind(rangeStart(range, now), now)
    .all<Omit<Restaurant, "off"> & { off: number }>();
  return r.results.map((x) => ({ ...x, off: x.off === 1 }));
}

/** The restaurant's short code, lower case: tells restaurants with similar names apart. */
export const isSlug = (s: string) => /^[a-z0-9][a-z0-9-]{1,30}$/.test(s);

/** A restaurant name from a request body, trimmed; null if empty or too long. */
export const parseName = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.length <= 60 ? s : null;
};

/** A new restaurant, its first manager and its "Not at a table" link, together or not at all. */
export async function addRestaurant(
  name: string,
  slug: string,
  manager: { name: string; username: string; password: string }
): Promise<"ok" | "slug" | "username" | "race"> {
  const d = db();
  const [slugTaken, userTaken] = await d.batch([
    d.prepare("SELECT 1 FROM businesses WHERE slug = ?").bind(slug),
    d.prepare("SELECT 1 FROM staff WHERE username = ?").bind(manager.username),
  ]);
  if (slugTaken.results.length) return "slug";
  if (userTaken.results.length) return "username";
  const id = "biz_" + randomId();
  const now = Date.now();
  try {
    await d.batch([
      d.prepare("INSERT INTO businesses (id, slug, name, created_at) VALUES (?, ?, ?, ?)").bind(id, slug, name, now),
      d
        .prepare(
          `INSERT INTO staff (id, business_id, username, name, role, password_hash, created_at)
           VALUES (?, ?, ?, ?, 'manager', ?, ?)`
        )
        .bind(randomId(), id, manager.username, manager.name, await hashPassword(manager.password), now),
      // The menu-only link (no table), for guests who just want to look.
      d.prepare("INSERT INTO tags (id, business_id, table_id, created_at) VALUES (?, ?, NULL, ?)").bind(newTagId(), id, now),
    ]);
  } catch {
    // Someone took the code or the username between the check and the insert.
    return "race";
  }
  return "ok";
}

export async function renameRestaurant(id: string, name: string): Promise<boolean> {
  const r = await db().prepare("UPDATE businesses SET name = ? WHERE id = ?").bind(name, id).run();
  return r.meta.changes > 0;
}

/** Off: its tags, open menus and staff logins stop working. On: they work again. */
export async function setRestaurantOff(id: string, off: boolean): Promise<boolean> {
  const r = await db()
    .prepare("UPDATE businesses SET disabled_at = ? WHERE id = ?")
    .bind(off ? Date.now() : null, id)
    .run();
  return r.meta.changes > 0;
}

/**
 * Deletes the restaurant and everything it owns: menu, tables, links, orders,
 * staff and billing. Cannot be undone. Children go first (D1 enforces the
 * foreign keys), all in one batch, so it is all or nothing. Developers who
 * had it open are left with no restaurant open.
 */
export async function deleteRestaurant(id: string): Promise<boolean> {
  const d = db();
  const sittings = "SELECT id FROM sittings WHERE business_id = ?1";
  const dishes = "SELECT id FROM dishes WHERE business_id = ?1";
  const r = await d.batch([
    `DELETE FROM payments WHERE contract_id IN (SELECT id FROM contracts WHERE business_id = ?1)`,
    `DELETE FROM contracts WHERE business_id = ?1`,
    `DELETE FROM batch_items WHERE batch_id IN (SELECT id FROM batches WHERE sitting_id IN (${sittings}))`,
    `DELETE FROM item_changes WHERE sitting_id IN (${sittings})`,
    `DELETE FROM visits WHERE business_id = ?1`,
    `DELETE FROM batches WHERE sitting_id IN (${sittings})`,
    `DELETE FROM guests WHERE sitting_id IN (${sittings})`,
    `DELETE FROM sittings WHERE business_id = ?1`,
    `DELETE FROM dish_categories WHERE dish_id IN (${dishes})`,
    `DELETE FROM dish_ingredients WHERE dish_id IN (${dishes})`,
    `DELETE FROM dishes WHERE business_id = ?1`,
    `DELETE FROM categories WHERE business_id = ?1`,
    `DELETE FROM tags WHERE business_id = ?1`,
    `DELETE FROM tables WHERE business_id = ?1`,
    `DELETE FROM staff_sessions WHERE staff_id IN (SELECT id FROM staff WHERE business_id = ?1)`,
    `UPDATE staff_sessions SET business_id = NULL WHERE business_id = ?1`,
    `DELETE FROM staff WHERE business_id = ?1`,
    `DELETE FROM businesses WHERE id = ?1`,
  ].map((sql) => d.prepare(sql).bind(id)));
  return r[r.length - 1].meta.changes > 0;
}

export async function restaurantExists(id: string): Promise<boolean> {
  return !!(await db().prepare("SELECT 1 FROM businesses WHERE id = ?").bind(id).first());
}

/** The restaurant's code: the start of its logins and its photo folder. */
export async function restaurantSlug(id: string): Promise<string | null> {
  const r = await db().prepare("SELECT slug FROM businesses WHERE id = ?").bind(id).first<{ slug: string }>();
  return r?.slug ?? null;
}

/** The restaurant's name, for the staff screens' frame. */
export async function restaurantName(id: string): Promise<string | null> {
  const r = await db().prepare("SELECT name FROM businesses WHERE id = ?").bind(id).first<{ name: string }>();
  return r?.name ?? null;
}
