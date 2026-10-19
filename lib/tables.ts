import { db } from "./cf";
import { today } from "./billing";
import { randomId } from "./ids";
import { PLANS } from "./plans";

// The manager's NFC links page: the tables, and the tag link each one opens.
// We only hand out the link; the restaurant writes it to the tag with any NFC
// app. Deleting or replacing keeps the row (sittings and visits point at it).

export type TableLinks = { id: string; label: string; tags: string[] };
/** limit: how many tables the restaurant's plan allows. */
export type LinksPage = { tables: TableLinks[]; unplaced: string[]; limit: number };

/**
 * How many tables the restaurant may have: what its contract covering today
 * says, else its latest contract's. With no contract yet (a trial), the
 * biggest plan's count.
 */
export async function tableLimit(businessId: string): Promise<number> {
  const day = today();
  const r = await db()
    .prepare(
      `SELECT tables FROM contracts WHERE business_id = ?1
       ORDER BY (starts_on <= ?2 AND ends_on >= ?2) DESC, starts_on DESC LIMIT 1`
    )
    .bind(businessId, day)
    .first<{ tables: number }>();
  return r?.tables ?? Math.max(...PLANS.map((p) => p.tables));
}

/** A table name from a request body, trimmed; null if empty or too long. */
export const parseLabel = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.length <= 40 ? s : null;
};

/** A new tag id: what goes after /t/ in the link. Lower case, to match isTagId. */
export function newTagId(): string {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  // ponytail: modulo bias over 36 letters is negligible at 12 characters (~62 bits).
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}

export async function linksPage(businessId: string): Promise<LinksPage> {
  const d = db();
  const [[tables, tags], limit] = await Promise.all([d.batch([
    d.prepare("SELECT id, label FROM tables WHERE business_id = ? AND removed_at IS NULL ORDER BY sort, label").bind(businessId),
    d
      .prepare("SELECT id, table_id FROM tags WHERE business_id = ? AND removed_at IS NULL ORDER BY created_at, id")
      .bind(businessId),
  ]), tableLimit(businessId)]);
  const byTable = new Map<string, string[]>();
  const unplaced: string[] = [];
  for (const t of tags.results as { id: string; table_id: string | null }[]) {
    if (!t.table_id) unplaced.push(t.id);
    else byTable.set(t.table_id, [...(byTable.get(t.table_id) ?? []), t.id]);
  }
  return {
    tables: (tables.results as { id: string; label: string }[]).map((t) => ({ ...t, tags: byTable.get(t.id) ?? [] })),
    // A tag left on a deleted table is not listed: its table is gone.
    unplaced,
    limit,
  };
}

const live = (businessId: string, tableId: string) =>
  db().prepare("SELECT 1 FROM tables WHERE id = ? AND business_id = ? AND removed_at IS NULL").bind(tableId, businessId).first();

/** A new table, with its link. "full" when the plan's table count is reached. */
export async function addTable(businessId: string, label: string): Promise<"ok" | "full"> {
  const d = db();
  const id = randomId();
  const limit = await tableLimit(businessId);
  // The count check is inside the insert, so two quick adds cannot both slip past the limit.
  const [added] = await d.batch([
    d
      .prepare(
        `INSERT INTO tables (id, business_id, label, sort)
         SELECT ?1, ?2, ?3, (SELECT COALESCE(MAX(sort), 0) + 1 FROM tables WHERE business_id = ?2)
         WHERE (SELECT COUNT(*) FROM tables WHERE business_id = ?2 AND removed_at IS NULL) < ?4`
      )
      .bind(id, businessId, label, limit),
    d
      .prepare(
        `INSERT INTO tags (id, business_id, table_id, created_at)
         SELECT ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM tables WHERE id = ?3)`
      )
      .bind(newTagId(), businessId, id, Date.now()),
  ]);
  return added.meta.changes > 0 ? "ok" : "full";
}

export async function renameTable(businessId: string, tableId: string, label: string): Promise<boolean> {
  const r = await db()
    .prepare("UPDATE tables SET label = ? WHERE id = ? AND business_id = ? AND removed_at IS NULL")
    .bind(label, tableId, businessId)
    .run();
  return r.meta.changes > 0;
}

/** Replaces every link the table has with one new one. The old links stop opening the menu. */
export async function newLink(businessId: string, tableId: string): Promise<boolean> {
  if (!(await live(businessId, tableId))) return false;
  const d = db();
  const now = Date.now();
  await d.batch([
    d.prepare("UPDATE tags SET removed_at = ? WHERE table_id = ? AND removed_at IS NULL").bind(now, tableId),
    d.prepare("INSERT INTO tags (id, business_id, table_id, created_at) VALUES (?, ?, ?, ?)").bind(newTagId(), businessId, tableId, now),
  ]);
  return true;
}

/** Deletes the table and its links. Refused while the table has guests or orders open. */
export async function removeTable(businessId: string, tableId: string): Promise<"ok" | "missing" | "open"> {
  if (!(await live(businessId, tableId))) return "missing";
  const d = db();
  const open = await d.prepare("SELECT 1 FROM sittings WHERE table_id = ? AND closed_at IS NULL").bind(tableId).first();
  if (open) return "open";
  const now = Date.now();
  await d.batch([
    d.prepare("UPDATE tables SET removed_at = ? WHERE id = ?").bind(now, tableId),
    d.prepare("UPDATE tags SET removed_at = ? WHERE table_id = ? AND removed_at IS NULL").bind(now, tableId),
  ]);
  return "ok";
}
