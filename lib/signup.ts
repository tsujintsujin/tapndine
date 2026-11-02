import { cookies } from "next/headers";
import { BASE_PATH } from "./base";
import { db } from "./cf";
import { isSlug } from "./dev";
import { randomId } from "./ids";
import { sendMail } from "./mail";
import { cookieOptions, sha256, startSession } from "./staff";
import { newTagId } from "./tables";
import { TRIAL_MS } from "./trial";

// Restaurants signing themselves up for the free trial, and their managers
// logging back in, without a password: they prove an email address, either
// with a code we email them or through Google. A known address logs in; a new
// one gets a short-lived ticket and names its restaurant next (createTrial).

const CODE_MS = 10 * 60 * 1000;
/** A new code no sooner than this after the last one, and at most HOURLY_SENDS an hour. */
const RESEND_MS = 60 * 1000;
const HOURLY_SENDS = 5;
const MAX_TRIES = 5;
const TICKET_COOKIE = "tnd_signup";
const TICKET_MS = 30 * 60 * 1000;

/** An email address from a request body, lower case; null if it isn't one. */
export function parseEmail(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

const codeHash = (email: string, code: string) => sha256(`${email}:${code}`);

/** Emails a 6-digit sign-in code. "wait": a code went out under a minute ago; "limit": too many this hour. */
export async function sendCode(email: string): Promise<"ok" | "wait" | "limit" | "mail"> {
  const now = Date.now();
  const last = await db()
    .prepare("SELECT sent_at, window_start, sends FROM email_codes WHERE email = ?")
    .bind(email)
    .first<{ sent_at: number; window_start: number; sends: number }>();
  if (last && now - last.sent_at < RESEND_MS) return "wait";
  const freshWindow = !last || now - last.window_start >= 60 * 60 * 1000;
  if (!freshWindow && last.sends >= HOURLY_SENDS) return "limit";

  // ponytail: modulo bias over 2^32 is negligible for a 6-digit code that dies after 5 tries.
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  await db()
    .prepare(
      `INSERT INTO email_codes (email, code_hash, expires_at, tries, sent_at, window_start, sends)
       VALUES (?1, ?2, ?3, 0, ?4, ?4, 1)
       ON CONFLICT (email) DO UPDATE SET code_hash = ?2, expires_at = ?3, tries = 0, sent_at = ?4,
         window_start = CASE WHEN ?5 THEN ?4 ELSE window_start END,
         sends = CASE WHEN ?5 THEN 1 ELSE sends + 1 END`
    )
    .bind(email, await codeHash(email, code), now + CODE_MS, now, freshWindow ? 1 : 0)
    .run();
  const sent = await sendMail({
    to: email,
    subject: `${code} is your tapndine code`,
    text: `Your tapndine code is ${code}\n\nType it on the sign-in page within 10 minutes. If you didn't ask for it, you can ignore this email.\n\ntapndine.online`,
  });
  // Without mail set up (next dev), the code is in the server log; the deployed Worker always has it.
  return sent.delivered || process.env.NODE_ENV === "development" ? "ok" : "mail";
}

/** The code typed for the email. A right one is used up; MAX_TRIES wrong ones kill it. */
export async function checkCode(email: string, code: string): Promise<"ok" | "wrong" | "expired"> {
  const row = await db()
    .prepare("SELECT code_hash, expires_at, tries FROM email_codes WHERE email = ?")
    .bind(email)
    .first<{ code_hash: string; expires_at: number; tries: number }>();
  if (!row || row.expires_at < Date.now() || row.tries >= MAX_TRIES) return "expired";
  if ((await codeHash(email, code)) !== row.code_hash) {
    await db().prepare("UPDATE email_codes SET tries = tries + 1 WHERE email = ?").bind(email).run();
    return row.tries + 1 >= MAX_TRIES ? "expired" : "wrong";
  }
  // Keep the row (its send counts guard the hourly limit); just make the code unusable,
  // and let a new one go out straight away (the minute's wait is for unused codes).
  await db().prepare("UPDATE email_codes SET expires_at = 0, sent_at = 0 WHERE email = ?").bind(email).run();
  return "ok";
}

/**
 * Someone proved they own `email` (and, through Google, `googleSub`). Their
 * login, if they have one, is logged in ("in"; "off" if the restaurant is
 * switched off). Otherwise they get a sign-up ticket and name their restaurant next ("new").
 */
export async function verified(email: string, googleSub: string | null, secure: boolean): Promise<"in" | "new" | "off"> {
  const staff = await db()
    .prepare(
      `SELECT s.id, s.google_sub, b.disabled_at AS off FROM staff s JOIN businesses b ON b.id = s.business_id
       WHERE s.disabled_at IS NULL AND (s.email = ?1 OR (?2 IS NOT NULL AND s.google_sub = ?2))
       ORDER BY s.google_sub = ?2 DESC LIMIT 1`
    )
    .bind(email, googleSub)
    .first<{ id: string; google_sub: string | null; off: number | null }>();
  if (staff) {
    if (staff.off) return "off";
    // Signed up with an emailed code, now came through Google with that address: remember the account.
    if (googleSub && !staff.google_sub) {
      await db().prepare("UPDATE staff SET google_sub = ? WHERE id = ?").bind(googleSub, staff.id).run();
    }
    await startSession(staff.id, secure);
    return "in";
  }
  const token = randomId() + randomId();
  const now = Date.now();
  await db().batch([
    db().prepare("DELETE FROM signup_tickets WHERE expires_at < ?").bind(now),
    db()
      .prepare("INSERT INTO signup_tickets (id, email, google_sub, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await sha256(token), email, googleSub, now + TICKET_MS),
  ]);
  (await cookies()).set(TICKET_COOKIE, token, { ...cookieOptions(secure), maxAge: TICKET_MS / 1000 });
  return "new";
}

type Ticket = { id: string; email: string; google_sub: string | null };

async function ticket(): Promise<Ticket | null> {
  const token = (await cookies()).get(TICKET_COOKIE)?.value;
  if (!token) return null;
  return db()
    .prepare("SELECT id, email, google_sub FROM signup_tickets WHERE id = ? AND expires_at > ?")
    .bind(await sha256(token), Date.now())
    .first<Ticket>();
}

/** The email waiting to name its restaurant on this browser, or null. */
export async function pendingEmail(): Promise<string | null> {
  return (await ticket())?.email ?? null;
}

/** "Kusina ni Lola" -> "kusina-ni-lola", within the code's 31 characters. */
export function slugFor(name: string): string {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/, "");
  return isSlug(s) ? s : "cafe";
}

/**
 * The ticket's restaurant on a free trial: the restaurant, its manager (who
 * logs in with the ticket's email or Google account), its "Menu for show"
 * link and Table 1 with its link, all or nothing. Then logs the manager in.
 */
export async function createTrial(restaurant: string, managerName: string, secure: boolean): Promise<"ok" | "expired"> {
  const t = await ticket();
  if (!t) return "expired";
  const d = db();
  const now = Date.now();
  const base = slugFor(restaurant);
  for (let attempt = 0; attempt < 4; attempt++) {
    // A taken code gets a short random ending: kusina-ni-lola-x7k2.
    const slug = attempt === 0 ? base : `${base}-${newTagId().slice(0, 4)}`;
    const id = "biz_" + randomId();
    const staffId = randomId();
    const tableId = randomId();
    try {
      await d.batch([
        d
          .prepare("INSERT INTO businesses (id, slug, name, created_at, trial_ends_at) VALUES (?, ?, ?, ?, ?)")
          .bind(id, slug, restaurant, now, now + TRIAL_MS),
        // No password: "none" never matches a hash, so only the email or Google gets in.
        d
          .prepare(
            `INSERT INTO staff (id, business_id, username, name, role, password_hash, created_at, email, google_sub)
             VALUES (?, ?, ?, ?, 'manager', 'none', ?, ?, ?)`
          )
          .bind(staffId, id, `${slug}-manager`, managerName, now, t.email, t.google_sub),
        d.prepare("INSERT INTO tags (id, business_id, table_id, created_at) VALUES (?, ?, NULL, ?)").bind(newTagId(), id, now),
        d.prepare("INSERT INTO tables (id, business_id, label, sort) VALUES (?, ?, 'Table 1', 1)").bind(tableId, id),
        d.prepare("INSERT INTO tags (id, business_id, table_id, created_at) VALUES (?, ?, ?, ?)").bind(newTagId(), id, tableId, now),
        d.prepare("DELETE FROM signup_tickets WHERE id = ?").bind(t.id),
      ]);
    } catch (e) {
      // The code or username was taken (try the next ending), or this email
      // signed up in another tab meanwhile (the unique email index): log that one in.
      if (String(e).includes("staff.email") || String(e).includes("idx_staff_email")) {
        return (await verified(t.email, t.google_sub, secure)) === "in" ? "ok" : "expired";
      }
      continue;
    }
    (await cookies()).delete({ name: TICKET_COOKIE, path: BASE_PATH || "/" });
    await startSession(staffId, secure);
    return "ok";
  }
  return "expired";
}

