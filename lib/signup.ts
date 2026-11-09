import { cookies } from "next/headers";
import { BASE_PATH } from "./base";
import { db } from "./cf";
import { isSlug } from "./dev";
import { randomId } from "./ids";
import { sendMail } from "./mail";
import { cookieOptions, sha256, startSession } from "./staff";
import { newTagId } from "./tables";
import { TRIAL_MS } from "./trial";

// Owners signing up: with an email and a password (the email proven once with
// a code we send), or with Google. Either way they get a short-lived ticket,
// name their restaurant, then start the free trial (createTrial) or buy a plan
// (lib/checkout.ts makes the restaurant once it is paid). Google also logs an
// owner who already has an account straight in. The same emailed code resets
// a forgotten owner password (app/api/auth/reset).

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

/** The owner login with this email, or null. */
export async function ownerByEmail(email: string) {
  return db()
    .prepare("SELECT id FROM staff WHERE email = ? AND disabled_at IS NULL")
    .bind(email)
    .first<{ id: string }>();
}

/** A ticket for someone who proved `email`: the next step names their restaurant. */
export async function newTicket(email: string, googleSub: string | null, passwordHash: string | null, secure: boolean) {
  const token = randomId() + randomId();
  const now = Date.now();
  await db().batch([
    db().prepare("DELETE FROM signup_tickets WHERE expires_at < ?").bind(now),
    db()
      .prepare("INSERT INTO signup_tickets (id, email, google_sub, password_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(await sha256(token), email, googleSub, passwordHash, now + TICKET_MS),
  ]);
  (await cookies()).set(TICKET_COOKIE, token, { ...cookieOptions(secure), maxAge: TICKET_MS / 1000 });
}

/**
 * Back from Google with `email` and the Google account `googleSub`. Their
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
    // Signed up with an email and password, now came through Google with that address: remember the account.
    if (googleSub && !staff.google_sub) {
      await db().prepare("UPDATE staff SET google_sub = ? WHERE id = ?").bind(googleSub, staff.id).run();
    }
    await startSession(staff.id, secure);
    return "in";
  }
  await newTicket(email, googleSub, null, secure);
  return "new";
}

export type Ticket = {
  id: string;
  email: string;
  google_sub: string | null;
  password_hash: string | null;
  /** Typed on "Set up your restaurant" before picking "Buy a plan"; null until then. */
  restaurant: string | null;
  owner_name: string | null;
};

/** This browser's sign-up ticket, while it lasts. Its id is the SHA-256 of the cookie. */
export async function ticket(): Promise<Ticket | null> {
  const token = (await cookies()).get(TICKET_COOKIE)?.value;
  if (!token) return null;
  return db()
    .prepare("SELECT id, email, google_sub, password_hash, restaurant, owner_name FROM signup_tickets WHERE id = ? AND expires_at > ?")
    .bind(await sha256(token), Date.now())
    .first<Ticket>();
}

/** Keeps the restaurant's name and the owner's on the ticket, for the plans page (/start/plans). */
export async function saveTicketDetails(id: string, restaurant: string, ownerName: string) {
  await db().prepare("UPDATE signup_tickets SET restaurant = ?, owner_name = ? WHERE id = ?").bind(restaurant, ownerName, id).run();
}

/** Done with the ticket: the restaurant is made. */
export async function dropTicket(id: string) {
  await db().prepare("DELETE FROM signup_tickets WHERE id = ?").bind(id).run();
  (await cookies()).delete({ name: TICKET_COOKIE, path: BASE_PATH || "/" });
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

/** The restaurant code for attempt n: a taken code gets a short random ending, kusina-ni-lola-x7k2. */
export const slugAttempt = (base: string, n: number) => (n === 0 ? base : `${base}-${newTagId().slice(0, 4)}`);

/** True when a failed insert hit the unique owner email: that account exists already. */
export const emailTaken = (e: unknown) => String(e).includes("staff.email") || String(e).includes("idx_staff_email");

export type NewRestaurant = {
  businessId: string;
  staffId: string;
  slug: string;
  restaurant: string;
  name: string;
  email: string;
  googleSub: string | null;
  /** null: no password ("none" never matches a hash), so only Google gets in. */
  passwordHash: string | null;
  /** When its free trial ends; null for a bought plan. */
  trialEndsAt: number | null;
  /** Table 1 with its link. A menu-only plan (no tables) gets none. */
  firstTable: boolean;
};

/**
 * The statements that make a restaurant: the restaurant, its owner's manager
 * login, its "Menu for show" link and Table 1 with its link. Each runs only
 * while `when` holds (a checkout still pending), so one batch makes all of it or none.
 */
export function restaurantStatements(r: NewRestaurant, when = { sql: "1", binds: [] as unknown[] }): D1PreparedStatement[] {
  const d = db();
  const now = Date.now();
  const ins = (table: string, cols: string, vals: unknown[]) =>
    d
      .prepare(`INSERT INTO ${table} (${cols}) SELECT ${vals.map(() => "?").join(", ")} WHERE ${when.sql}`)
      .bind(...vals, ...when.binds);
  const tableId = randomId();
  return [
    ins("businesses", "id, slug, name, created_at, trial_ends_at", [r.businessId, r.slug, r.restaurant, now, r.trialEndsAt]),
    ins("staff", "id, business_id, username, name, role, password_hash, created_at, email, google_sub", [
      r.staffId,
      r.businessId,
      `${r.slug}-manager`,
      r.name,
      "manager",
      r.passwordHash ?? "none",
      now,
      r.email,
      r.googleSub,
    ]),
    ins("tags", "id, business_id, table_id, created_at", [newTagId(), r.businessId, null, now]),
    ...(r.firstTable
      ? [
          ins("tables", "id, business_id, label, sort", [tableId, r.businessId, "Table 1", 1]),
          ins("tags", "id, business_id, table_id, created_at", [newTagId(), r.businessId, tableId, now]),
        ]
      : []),
  ];
}

/** The ticket's restaurant on a free trial, all or nothing, then logs its owner in. */
export async function createTrial(restaurant: string, managerName: string, secure: boolean): Promise<"ok" | "expired"> {
  const t = await ticket();
  if (!t) return "expired";
  const base = slugFor(restaurant);
  for (let attempt = 0; attempt < 4; attempt++) {
    const r: NewRestaurant = {
      businessId: "biz_" + randomId(),
      staffId: randomId(),
      slug: slugAttempt(base, attempt),
      restaurant,
      name: managerName,
      email: t.email,
      googleSub: t.google_sub,
      passwordHash: t.password_hash,
      trialEndsAt: Date.now() + TRIAL_MS,
      firstTable: true,
    };
    try {
      await db().batch(restaurantStatements(r));
    } catch (e) {
      // This email got an account meanwhile (another tab): log that one in.
      if (emailTaken(e)) {
        const owner = await ownerByEmail(t.email);
        if (!owner) return "expired";
        await dropTicket(t.id);
        await startSession(owner.id, secure);
        return "ok";
      }
      continue; // the code or username was taken: try the next ending
    }
    await dropTicket(t.id);
    await startSession(r.staffId, secure);
    return "ok";
  }
  return "expired";
}
