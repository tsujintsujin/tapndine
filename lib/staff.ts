import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BASE_PATH, OPEN_COOKIE } from "./base";
import { db } from "./cf";
import { randomId } from "./ids";

// Waiter and manager logins. Passwords are PBKDF2-SHA256 (Web Crypto, which
// the Worker has; 100k is the most iterations Workers allow). The login
// cookie holds a random token; the database keeps only its SHA-256.

const ITERATIONS = 100_000;
const COOKIE = "tnd_staff";
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
};
/** Who is logged in. business_id: their restaurant, or the one a developer has open (null: none yet). */
export type Login = { id: string; business_id: string | null; username: string; name: string; role: Role };

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

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const cookieOptions = (secure: boolean) => ({
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

/** Checks the password and, if right, sets the login cookie. */
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
       WHERE s.username = ? AND s.disabled_at IS NULL`
    )
    .bind(username.trim().toLowerCase())
    .first<StaffRow>();
  if (!row) {
    // Same work as a real check, so timing does not reveal which usernames exist.
    await hashPassword(password);
    return "wrong";
  }
  if (row.locked_until > now) return "locked";

  if (!(await verifyPassword(password, row.password_hash))) {
    const fails = row.failed_logins + 1;
    await db()
      .prepare("UPDATE staff SET failed_logins = ?, locked_until = ? WHERE id = ?")
      .bind(fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? now + LOCK_MS : 0, row.id)
      .run();
    return fails >= MAX_FAILS ? "locked" : "wrong";
  }

  // Only after the right password, so it says nothing about the account to a guesser.
  if (row.off) return "off";

  const token = randomId() + randomId();
  await db().batch([
    db().prepare("UPDATE staff SET failed_logins = 0, locked_until = 0 WHERE id = ?").bind(row.id),
    db().prepare("DELETE FROM staff_sessions WHERE expires_at < ?").bind(now),
    db()
      .prepare("INSERT INTO staff_sessions (id, staff_id, expires_at) VALUES (?, ?, ?)")
      .bind(await sha256(token), row.id, now + SESSION_MS),
  ]);
  const jar = await cookies();
  jar.set(COOKIE, token, { ...cookieOptions(secure), maxAge: SESSION_MS / 1000 });
  // A developer who used this browser before opened a restaurant; this login starts clean.
  jar.delete({ name: OPEN_COOKIE, path: BASE_PATH || "/" });
  return "ok";
}

export async function logOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db().prepare("DELETE FROM staff_sessions WHERE id = ?").bind(await sha256(token)).run();
  jar.delete({ name: COOKIE, path: BASE_PATH || "/" });
  jar.delete({ name: OPEN_COOKIE, path: BASE_PATH || "/" });
}

/** Whoever is logged in on this browser, or null. Staff of a switched-off restaurant are logged out. */
export async function currentLogin(): Promise<Login | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await db()
    .prepare(
      `SELECT s.id, COALESCE(x.business_id, s.business_id) AS business_id, s.username, s.name, s.role, b.disabled_at AS off
       FROM staff_sessions x JOIN staff s ON s.id = x.staff_id
       LEFT JOIN businesses b ON b.id = s.business_id
       WHERE x.id = ? AND x.expires_at > ? AND s.disabled_at IS NULL`
    )
    .bind(await sha256(token), Date.now())
    .first<Login & { off: number | null }>();
  if (!row || row.off) return null;
  const { off: _, ...login } = row;
  return login;
}

/** The login as restaurant staff: null for nobody, or a developer with no restaurant open. */
function asStaff(login: Login | null): Staff | null {
  if (!login?.business_id) return null;
  const developer = login.role === "developer";
  // ponytail: an owner works as a manager until owners get their own screens.
  const role = login.role === "waiter" ? "waiter" : "manager";
  return { ...login, business_id: login.business_id, role, developer };
}

/** Whoever is working in a restaurant on this browser, or null. */
export async function currentStaff(): Promise<Staff | null> {
  return asStaff(await currentLogin());
}

/** For staff pages: the login screen if nobody is logged in; a developer with no restaurant open goes to theirs. */
export async function requireStaff(role?: Staff["role"]): Promise<Staff> {
  const login = await currentLogin();
  if (!login) redirect("/login");
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

/** A waiter; loginName is the part after the restaurant's code. Returns the full username, or "taken". */
export async function addWaiter(
  businessId: string,
  name: string,
  loginName: string,
  password: string
): Promise<string | "taken"> {
  const biz = await db().prepare("SELECT slug FROM businesses WHERE id = ?").bind(businessId).first<{ slug: string }>();
  if (!biz) return "taken";
  const username = restaurantLogin(biz.slug, loginName);
  const taken = await db().prepare("SELECT 1 FROM staff WHERE username = ?").bind(username).first();
  if (taken) return "taken";
  await db()
    .prepare(
      `INSERT INTO staff (id, business_id, username, name, role, password_hash, created_at)
       VALUES (?, ?, ?, ?, 'waiter', ?, ?)`
    )
    .bind(randomId(), businessId, username, name, await hashPassword(password), Date.now())
    .run();
  return username;
}

/**
 * Disables a waiter: hidden from the list, logged out everywhere, and cannot
 * log in. Nothing is deleted, so past orders still name them. Managers stay.
 */
export async function disableWaiter(businessId: string, staffId: string): Promise<boolean> {
  const r = await db()
    .prepare(
      `UPDATE staff SET disabled_at = ? WHERE id = ? AND business_id = ? AND role = 'waiter' AND disabled_at IS NULL`
    )
    .bind(Date.now(), staffId, businessId)
    .run();
  if (!r.meta.changes) return false;
  await db().prepare("DELETE FROM staff_sessions WHERE staff_id = ?").bind(staffId).run();
  return true;
}
