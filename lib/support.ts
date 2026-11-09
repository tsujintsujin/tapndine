import { db } from "./cf";
import { randomId } from "./ids";

// Support: one running conversation per restaurant, between its managers and
// the developers. The routes and pages check who is asking before calling these.

export type SupportMessage = { id: string; fromDev: boolean; sender: string; body: string; at: number };

/** A restaurant's conversation as a row in the developers' Tickets list. */
export type Ticket = { id: string; name: string; logo: string | null; last: string; lastFromDev: boolean; at: number; unread: number };

/** A message from a request body, trimmed; null if empty or too long. */
export const parseMessage = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.length <= 2000 ? s : null;
};

/** The conversation, oldest first. */
export async function thread(businessId: string): Promise<SupportMessage[]> {
  // ponytail: the whole recent thread on every poll, latest 300; fetch only newer ids if threads get long.
  const r = await db()
    .prepare(
      `SELECT id, from_dev AS fromDev, sender, body, created_at AS at FROM support_messages
       WHERE business_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 300`
    )
    .bind(businessId)
    .all<Omit<SupportMessage, "fromDev"> & { fromDev: number }>();
  return r.results.reverse().map((m) => ({ ...m, fromDev: m.fromDev === 1 }));
}

/** Someone opened the conversation: the other side's messages are read. `fromDev`: whose messages. */
export async function markSeen(businessId: string, fromDev: boolean) {
  await db()
    .prepare("UPDATE support_messages SET seen_at = ? WHERE business_id = ? AND from_dev = ? AND seen_at IS NULL")
    .bind(Date.now(), businessId, fromDev ? 1 : 0)
    .run();
}

export async function sendMessage(businessId: string, fromDev: boolean, sender: string, body: string) {
  await db()
    .prepare("INSERT INTO support_messages (id, business_id, from_dev, sender, body, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(randomId(), businessId, fromDev ? 1 : 0, sender, body, Date.now())
    .run();
}

/** Developers' replies this restaurant's managers haven't opened yet. */
export async function unreadReplies(businessId: string): Promise<number> {
  const r = await db()
    .prepare("SELECT COUNT(*) AS n FROM support_messages WHERE business_id = ? AND from_dev = 1 AND seen_at IS NULL")
    .bind(businessId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** Every restaurant that has written or been written to, newest conversation first. */
export async function tickets(): Promise<Ticket[]> {
  const r = await db()
    .prepare(
      `SELECT b.id, b.name, b.logo_url AS logo, substr(m.body, 1, 120) AS last, m.from_dev AS lastFromDev, m.created_at AS at,
              (SELECT COUNT(*) FROM support_messages u WHERE u.business_id = b.id AND u.from_dev = 0 AND u.seen_at IS NULL) AS unread
       FROM businesses b
       JOIN support_messages m ON m.id = (
         SELECT id FROM support_messages WHERE business_id = b.id ORDER BY created_at DESC, rowid DESC LIMIT 1
       )
       ORDER BY m.created_at DESC`
    )
    .all<Omit<Ticket, "lastFromDev"> & { lastFromDev: number }>();
  return r.results.map((t) => ({ ...t, lastFromDev: t.lastFromDev === 1 }));
}
