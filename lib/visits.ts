import { db } from "./cf";
import { randomId } from "./ids";
import { SERVING } from "./trial";

/** A visit link dies this long after it was opened. Activity does not extend it. */
export const VISIT_MS = 2 * 60 * 60 * 1000;

/**
 * Testing switch: with TAPNDINE_VISITS_NEVER_EXPIRE=1 (set in
 * .env.development.local), every visit link stays alive. Only `next dev` reads
 * that file, so the deployed Worker always expires visits.
 */
const neverExpire = () => process.env.TAPNDINE_VISITS_NEVER_EXPIRE === "1";

export type Visit = {
  id: string;
  tag_id: string;
  business_id: string;
  table_id: string | null;
  /** NULL for a tag not placed at a table: that menu cannot send orders. */
  sitting_id: string | null;
  phone_id: string | null;
  expires_at: number;
};

/**
 * The demo restaurant's tag: the homepage's "Try the menu" (Justin, 2026-11-07).
 * Same id on the live site and in the seed data (seed/dev.sql).
 */
export const DEMO_TAG = "b3744013e9f6";

/** Tag ids are what is written on the physical tag. Reject anything else early. */
export const isTagId = (id: string) => /^[a-z0-9]{4,32}$/.test(id);
export const isVisitId = (id: string) => /^[A-Za-z0-9_-]{22}$/.test(id);
/** Phone ids come from our own cookie, which has the same shape as a visit id. */
export const isPhoneId = isVisitId;

/** The table's open sitting, opening one if the table has none. */
async function openSitting(businessId: string, tableId: string, now: number): Promise<string> {
  const d = db();
  // The unique index on open sittings makes a second, simultaneous insert a no-op.
  const [, found] = await d.batch([
    d
      .prepare("INSERT OR IGNORE INTO sittings (id, business_id, table_id, opened_at) VALUES (?, ?, ?, ?)")
      .bind(randomId(), businessId, tableId, now),
    d.prepare("SELECT id FROM sittings WHERE table_id = ? AND closed_at IS NULL").bind(tableId),
  ]);
  return (found.results as { id: string }[])[0].id;
}

/**
 * One tap: look the tag up and return the visit to send the phone to.
 * The same phone tapping again at the same sitting gets its live link back,
 * so it stays the same guest with the same orders. Otherwise a fresh link.
 * Returns null when the tag is not registered or was replaced, and "closed"
 * when its restaurant is switched off or its free trial has ended.
 */
export async function startVisit(tagId: string, phoneId: string): Promise<string | "closed" | null> {
  if (!isTagId(tagId)) return null;
  const tag = await db()
    .prepare(
      `SELECT t.id, t.business_id, t.table_id, ${SERVING} AS serving FROM tags t JOIN businesses b ON b.id = t.business_id
       WHERE t.id = ? AND t.removed_at IS NULL`
    )
    .bind(tagId)
    .first<{ id: string; business_id: string; table_id: string | null; serving: number }>();
  if (!tag) return null;
  if (!tag.serving) return "closed";

  const now = Date.now();
  const sittingId = tag.table_id ? await openSitting(tag.business_id, tag.table_id, now) : null;

  if (sittingId) {
    const live = await db()
      .prepare(
        `SELECT id FROM visits
         WHERE phone_id = ?1 AND sitting_id = ?2 AND (expires_at > ?3 OR ?4 = 1)
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(phoneId, sittingId, now, neverExpire() ? 1 : 0)
      .first<{ id: string }>();
    if (live) return live.id;
  }

  const id = randomId();
  await db()
    .prepare(
      `INSERT INTO visits (id, tag_id, business_id, table_id, sitting_id, phone_id, created_at, last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, tag.id, tag.business_id, tag.table_id, sittingId, phoneId, now, now, now + VISIT_MS)
    .run();
  return id;
}

/**
 * The visit, if its link is still alive: not expired, and its table not
 * cleared since. A dead or unknown visit returns null
 * and stays dead: the only way back in is another tap.
 */
export async function liveVisit(visitId: string): Promise<Visit | null> {
  if (!isVisitId(visitId)) return null;
  const now = Date.now();
  return db()
    .prepare(
      `UPDATE visits SET last_seen_at = ?1
       WHERE id = ?2 AND (expires_at > ?1 OR ?3 = 1)
         -- A cleared table ends its links, even with the testing switch on.
         AND (sitting_id IS NULL OR sitting_id IN (SELECT id FROM sittings WHERE closed_at IS NULL))
         -- So does switching the restaurant off, or its free trial ending.
         AND business_id IN (SELECT b.id FROM businesses b WHERE ${SERVING})
       RETURNING id, tag_id, business_id, table_id, sitting_id, phone_id, expires_at`
    )
    .bind(now, visitId, neverExpire() ? 1 : 0)
    .first<Visit>();
}
