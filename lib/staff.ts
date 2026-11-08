import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BASE_PATH, OPEN_COOKIE } from "./base";
import { db } from "./cf";
import { randomId } from "./ids";
import { addDays, GRACE_DAYS, today } from "./plans";
import { ON_TRIAL, PAID_UNTIL, TRIAL_STAFF } from "./trial";

// Waiter and manager logins. Passwords are PBKDF2-SHA256 (Web Crypto, which
// the Worker has; 100k is the most iterations Workers allow). The login
// cookie holds a random token; the database keeps only its SHA-256.

const ITERATIONS = 100_000;
const COOKIE = "tnd_staff";
/** Set while a manager walks through the guide: their screens show GUIDE_BUSINESS, and nothing saves. */
const GUIDE_COOKIE = "tnd_guide";
/** The restaurant the guide shows: Cove Café, the demo restaurant on live. */
export const GUIDE_BUSINESS = "biz_cove_cafe";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
/** Wrong passwords in a row before the account waits LOCK_MS. */
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

export type Role = "developer" | "owner" | "manager" | "waiter";
/**
 * Someone working in one restaurant. A developer with a restaurant open shows
 * up here as its manager, so every restaurant screen works for them as is.
 */
export type Staff = {
  id: string;
  business_id: string;
  username: string;
  name: string;
  role: "manager" | "waiter";
  developer: boolean;
  /** A self signed-up restaurant's last paid day, once it bought a plan; null otherwise (see Login). */
  paidUntil: string | null;
  /** In the guide: only look, never change (not even marking orders seen). */
  guide: boolean;
};
/**
 * Who is logged in. business_id: their restaurant, or the one a developer has open (null: none yet).
 * trialEndsAt: when their restaurant's free trial ends (unix ms), null when not on trial; always null for developers.
 */
export type Login = {
  id: string;
  business_id: string | null;
  username: string;
  name: string;
  role: Role;
  trialEndsAt: number | null;
  /** A self signed-up restaurant's last paid day (YYYY-MM-DD), once it bought a plan; null otherwise. */
  paidUntil: string | null;
  /** In the guide: business_id is GUIDE_BUSINESS, and currentStaff() refuses writes. */
  guide: boolean;
  /** Has finished or skipped the guide once. */
  guideSeen: boolean;
};

/**
 * Restaurant staff whose free trial has ended, or whose plan ran out more than
 * GRACE_DAYS ago: they see the trial-over page and nothing else.
 */
const trialOver = (login: Login) =>
  (login.trialEndsAt !== null && login.trialEndsAt <= Date.now()) ||
  (login.paidUntil !== null && login.paidUntil < addDays(today(), -GRACE_DAYS));

/** A developer's username. Restaurant logins are longer: "<code>-<name>". */
export const isUsername = (u: string) => /^[a-z0-9._-]{3,32}$/.test(u);
/** The part of a restaurant login after its code. No dashes, so the code always ends at the last dash. */
export const isLoginName = (u: string) => /^[a-z0-9._]{2,30}$/.test(u);
/** A restaurant login: its code, a dash, the name typed for it. */
export const restaurantLogin = (slug: string, name: string) => `${slug}-${name}`;
export const MIN_PASSWORD = 6;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  const got = await derive(password, unb64(salt), Number(iter));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const cookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: BASE_PATH || "/",
});

type StaffRow = {
  id: string;
  role: Role;
  password_hash: string;
  failed_logins: number;
  locked_until: number;
  /** Set when the login's restaurant is switched off. */
  off: number | null;
};

/** The password against the login's hash. Wrong ones count toward the lock. */
async function tryPassword(
  row: Pick<StaffRow, "id" | "password_hash" | "failed_logins" | "locked_until">,
  password: string,
  now: number
): Promise<"ok" | "wrong" | "locked"> {
  if (row.locked_until > now) return "locked";
  if (await verifyPassword(password, row.password_hash)) return "ok";
  const fails = row.failed_logins + 1;
  await db()
    .prepare("UPDATE staff SET failed_logins = ?, locked_until = ? WHERE id = ?")
    .bind(fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? now + LOCK_MS : 0, row.id)
    .run();
  return fails >= MAX_FAILS ? "locked" : "wrong";
}

/** Someone logged in types their password again before something that cannot be undone. */
export async function checkPassword(staffId: string, password: string): Promise<"ok" | "wrong" | "locked"> {
  const row = await db()
    .prepare("SELECT id, password_hash, failed_logins, locked_until FROM staff WHERE id = ? AND disabled_at IS NULL")
    .bind(staffId)
    .first<Pick<StaffRow, "id" | "password_hash" | "failed_logins" | "locked_until">>();
  if (!row) return "wrong";
  const checked = await tryPassword(row, password, Date.now());
  if (checked === "ok") await db().prepare("UPDATE staff SET failed_logins = 0 WHERE id = ?").bind(row.id).run();
  return checked;
}

/** Checks the password and, if right, sets the login cookie. `username`: a username, or an owner's email. */
export async function logIn(
  username: string,
  password: string,
  secure: boolean
): Promise<"ok" | "wrong" | "locked" | "off"> {
  const now = Date.now();
  const row = await db()
    .prepare(
      `SELECT s.id, s.role, s.password_hash, s.failed_logins, s.locked_until, b.disabled_at AS off
       FROM staff s LEFT JOIN businesses b ON b.id = s.business_id
       WHERE (s.username = ?1 OR s.email = ?1) AND s.disabled_at IS NULL`
    )
    .bind(username.trim().toLowerCase())
    .first<StaffRow>();
  if (!row) {
    // Same work as a real check, so timing does not reveal which usernames exist.
    await hashPassword(password);
    return "wrong";
  }
  const checked = await tryPassword(row, password, now);
  if (checked !== "ok") return checked;

  // Only after the right password, so it says nothing about the account to a guesser.
  if (row.off) return "off";

  await startSession(row.id, secure);
  return "ok";
}

/** Logs the staff member in on this browser: a new session and its cookie. The caller has checked who they are. */
export async function startSession(staffId: string, secure: boolean) {
  const now = Date.now();
  const token = randomId() + randomId();
  await db().batch([
    db().prepare("UPDATE staff SET failed_logins = 0, locked_until = 0 WHERE id = ?").bind(staffId),
    db().prepare("DELETE FROM staff_sessions WHERE expires_at < ?").bind(now),
    db()
      .prepare("INSERT INTO staff_sessions (id, staff_id, expires_at) VALUES (?, ?, ?)")
      .bind(await sha256(token), staffId, now + SESSION_MS),
  ]);
  const jar = await cookies();
  jar.set(COOKIE, token, { ...cookieOptions(secure), maxAge: SESSION_MS / 1000 });
  // A developer who used this browser before opened a restaurant; this login starts clean.
  jar.delete({ name: OPEN_COOKIE, path: BASE_PATH || "/" });
  jar.delete({ name: GUIDE_COOKIE, path: BASE_PATH || "/" });
}

export async function logOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db().prepare("DELETE FROM staff_sessions WHERE id = ?").bind(await sha256(token)).run();
  jar.delete({ name: COOKIE, path: BASE_PATH || "/" });
  jar.delete({ name: OPEN_COOKIE, path: BASE_PATH || "/" });
  jar.delete({ name: GUIDE_COOKIE, path: BASE_PATH || "/" });
}

/** Starts the guide on this browser, or ends it (and remembers this login has seen it). */
export async function setGuide(login: Login, on: boolean, secure: boolean) {
  const jar = await cookies();
  if (on) {
    jar.set(GUIDE_COOKIE, "1", cookieOptions(secure));
    return;
  }
  jar.delete({ name: GUIDE_COOKIE, path: BASE_PATH || "/" });
  await db().prepare("UPDATE staff SET guide_seen_at = ? WHERE id = ? AND guide_seen_at IS NULL").bind(Date.now(), login.id).run();
}

/** Whoever is logged in on this browser, or null. Staff of a switched-off restaurant are logged out. */
export async function currentLogin(): Promise<Login | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = await db()
    .prepare(
      `SELECT s.id, COALESCE(x.business_id, s.business_id) AS business_id, s.username, s.name, s.role, b.disabled_at AS off,
              s.guide_seen_at IS NOT NULL AS guideSeen,
              CASE WHEN ${ON_TRIAL} THEN b.trial_ends_at END AS trialEndsAt,
              ${PAID_UNTIL} AS paidUntil
       FROM staff_sessions x JOIN staff s ON s.id = x.staff_id
       LEFT JOIN businesses b ON b.id = s.business_id
       WHERE x.id = ? AND x.expires_at > ? AND s.disabled_at IS NULL`
    )
    .bind(await sha256(token), Date.now())
    .first<Omit<Login, "guide" | "guideSeen"> & { off: number | null; guideSeen: number }>();
  if (!row || row.off) return null;
  const { off: _, ...login } = row;
  // Waiters have no guide; for everyone else the guide swaps in its restaurant.
  const guide = login.role !== "waiter" && jar.get(GUIDE_COOKIE)?.value === "1";
  return { ...login, business_id: guide ? GUIDE_BUSINESS : login.business_id, guide, guideSeen: !!login.guideSeen };
}

/** The login as restaurant staff: null for nobody, or a developer with no restaurant open. */
function asStaff(login: Login | null): Staff | null {
  if (!login?.business_id) return null;
  const developer = login.role === "developer";
  // ponytail: an owner works as a manager until owners get their own screens.
  const role = login.role === "waiter" ? "waiter" : "manager";
  return { ...login, business_id: login.business_id, role, developer };
}

/**
 * Whoever is working in a restaurant on this browser, or null. Null too once their trial is over, so every staff API refuses.
 * In the guide only reads (`read`) get the staff member: nothing may change the guide's restaurant.
 */
export async function currentStaff(read = false): Promise<Staff | null> {
  const login = await currentLogin();
  if (login?.guide && !read) return null;
  return login && trialOver(login) ? null : asStaff(login);
}

/**
 * For staff pages: the login screen if nobody is logged in; a developer with
 * no restaurant open goes to theirs; staff whose trial is over to the page that says so.
 */
export async function requireStaff(role?: Staff["role"]): Promise<Staff> {
  const login = await currentLogin();
  if (!login) redirect("/login");
  if (trialOver(login)) redirect("/trial-over");
  const staff = asStaff(login);
  if (!staff) redirect("/admin/dev");
  if (role && staff.role !== role) redirect("/admin");
  return staff;
}

/** For developer pages. */
export async function requireDeveloper(): Promise<Login> {
  const login = await currentLogin();
  if (!login) redirect("/login");
  if (login.role !== "developer") redirect("/admin");
  return login;
}

/** A developer opens a restaurant: from now on this session works in it. Check it exists first. */
export async function openRestaurant(businessId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return;
  await db().prepare("UPDATE staff_sessions SET business_id = ? WHERE id = ?").bind(businessId, await sha256(token)).run();
}

// --- Manager: the people who can log in --------------------------------------

export type StaffListing = { id: string; username: string; name: string; role: Role };

export async function listStaff(businessId: string): Promise<StaffListing[]> {
  const r = await db()
    .prepare(
      `SELECT id, username, name, role FROM staff
       WHERE business_id = ? AND disabled_at IS NULL ORDER BY role, name`
    )
    .bind(businessId)
    .all<StaffListing>();
  return r.results;
}

/**
 * A waiter or manager; loginName is the part after the restaurant's code. Returns the full username,
 * "taken", or "full" when a free trial already has TRIAL_STAFF logins besides its manager.
 */
export async function addStaff(
  businessId: string,
  name: string,
  loginName: string,
  password: string,
  role: "waiter" | "manager"
): Promise<string | "taken" | "full"> {
  const biz = await db()
    .prepare(
      `SELECT b.slug, ${ON_TRIAL} AS trial,
              (SELECT COUNT(*) FROM staff s WHERE s.business_id = b.id AND s.disabled_at IS NULL) AS staff
       FROM businesses b WHERE b.id = ?`
    )
    .bind(businessId)
    .first<{ slug: string; trial: number; staff: number }>();
  if (!biz) return "taken";
  // ponytail: count-then-insert, so two adds at the same instant could make it 4; harmless on a trial.
  if (biz.trial && biz.staff >= 1 + TRIAL_STAFF) return "full";
  const username = restaurantLogin(biz.slug, loginName);
  const taken = await db().prepare("SELECT 1 FROM staff WHERE username = ?").bind(username).first();
  if (taken) return "taken";
  await db()
    .prepare(
      `INSERT INTO staff (id, business_id, username, name, role, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(randomId(), businessId, username, name, role, await hashPassword(password), Date.now())
    .run();
  return username;
}

/**
 * Disables a waiter or manager: hidden from the list, logged out everywhere,
 * and cannot log in. Nothing is deleted, so past orders still name them.
 * Never yourself, and never the restaurant's last manager. Someone already
 * gone (or not in this restaurant) is "ok": a double tap is not an error.
 */
export async function disableStaff(businessId: string, staffId: string, me: string): Promise<"ok" | "self" | "last"> {
  if (staffId === me) return "self";
  const r = await db()
    .prepare(
      `UPDATE staff SET disabled_at = ?
       WHERE id = ? AND business_id = ? AND disabled_at IS NULL
         AND (role = 'waiter' OR (role = 'manager' AND (
           SELECT COUNT(*) FROM staff WHERE business_id = ? AND role = 'manager' AND disabled_at IS NULL) > 1))`
    )
    .bind(Date.now(), staffId, businessId, businessId)
    .run();
  if (!r.meta.changes) {
    // Still here and a manager: the update was refused for being the last one.
    const kept = await db()
      .prepare("SELECT 1 FROM staff WHERE id = ? AND business_id = ? AND role = 'manager' AND disabled_at IS NULL")
      .bind(staffId, businessId)
      .first();
    return kept ? "last" : "ok";
  }
  await db().prepare("DELETE FROM staff_sessions WHERE staff_id = ?").bind(staffId).run();
  return "ok";
}
