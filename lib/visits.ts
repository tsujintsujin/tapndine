import { db } from "./cf";

/** A visit dies this long after its last activity. */
export const VISIT_IDLE_MS = 30 * 60 * 1000;

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
  expires_at: number;
};

/** 128 random bits, URL-safe: the random part of /m/<id>. Not guessable. */
function newVisitId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Tag ids are what is written on the physical tag. Reject anything else early. */
export const isTagId = (id: string) => /^[a-z0-9]{4,32}$/.test(id);
export const isVisitId = (id: string) => /^[A-Za-z0-9_-]{22}$/.test(id);

/**
 * One tap: look the tag up and open a fresh visit for it.
 * Returns null when the tag is not registered.
 */
export async function startVisit(tagId: string): Promise<string | null> {
  if (!isTagId(tagId)) return null;
  const tag = await db()
    .prepare("SELECT id, business_id, table_id FROM tags WHERE id = ?")
    .bind(tagId)
    .first<{ id: string; business_id: string; table_id: string | null }>();
  if (!tag) return null;

  const now = Date.now();
  const id = newVisitId();
  await db()
    .prepare(
      `INSERT INTO visits (id, tag_id, business_id, table_id, created_at, last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, tag.id, tag.business_id, tag.table_id, now, now, now + VISIT_IDLE_MS)
    .run();
  return id;
}

/**
 * Activity on a visit: if it is still alive, push its expiry 30 minutes out
 * and return it. A dead or unknown visit returns null and stays dead - the
 * only way back in is another tap.
 */
export async function touchVisit(visitId: string): Promise<Visit | null> {
  if (!isVisitId(visitId)) return null;
  const now = Date.now();
  return db()
    .prepare(
      `UPDATE visits SET last_seen_at = ?1, expires_at = ?2
       WHERE id = ?3 AND (expires_at > ?1 OR ?4 = 1)
       RETURNING id, tag_id, business_id, table_id, expires_at`
    )
    .bind(now, now + VISIT_IDLE_MS, visitId, neverExpire() ? 1 : 0)
    .first<Visit>();
}
