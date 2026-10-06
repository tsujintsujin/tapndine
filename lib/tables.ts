import { db } from "./cf";
import { randomId } from "./ids";

// The manager's NFC links page: the tables, and the tag link each one opens.
// We only hand out the link; the restaurant writes it to the tag with any NFC
// app. Deleting or replacing keeps the row (sittings and visits point at it).

export type TableLinks = { id: string; label: string; tags: string[] };
export type LinksPage = { tables: TableLinks[]; unplaced: string[] };

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
  const [tables, tags] = await d.batch([
    d.prepare("SELECT id, label FROM tables WHERE business_id = ? AND removed_at IS NULL ORDER BY sort, label").bind(businessId),
    d
      .prepare("SELECT id, table_id FROM tags WHERE business_id = ? AND removed_at IS NULL ORDER BY created_at, id")
      .bind(businessId),
  ]);
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
  };
}

const live = (businessId: string, tableId: string) =>
  db().prepare("SELECT 1 FROM tables WHERE id = ? AND business_id = ? AND removed_at IS NULL").bind(tableId, businessId).first();

/** A new table, with its link. */
export async function addTable(businessId: string, label: string): Promise<void> {
  const d = db();
  const id = randomId();
  await d.batch([
    d
      .prepare(
        `INSERT INTO tables (id, business_id, label, sort)
         VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(sort), 0) + 1 FROM tables WHERE business_id = ?2))`
      )
      .bind(id, businessId, label),
    d.prepare("INSERT INTO tags (id, business_id, table_id, created_at) VALUES (?, ?, ?, ?)").bind(newTagId(), businessId, id, Date.now()),
  ]);
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
