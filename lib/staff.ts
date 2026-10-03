import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BASE_PATH } from "./base";
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

export type Role = "manager" | "waiter";
export type Staff = { id: string; business_id: string; username: string; name: string; role: Role };

export const isUsername = (u: string) => /^[a-z0-9._-]{3,32}$/.test(u);
export const MIN_PASSWORD = 8;

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

type StaffRow = Staff & { password_hash: string; failed_logins: number; locked_until: number };

/** Checks the password and, if right, sets the login cookie. */
export async function logIn(
  username: string,
  password: string,
  secure: boolean
): Promise<"ok" | "wrong" | "locked"> {
  const now = Date.now();
  const row = await db()
    .prepare(
      `SELECT id, business_id, username, name, role, password_hash, failed_logins, locked_until
       FROM staff WHERE username = ? AND disabled_at IS NULL`
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

  const token = randomId() + randomId();
  await db().batch([
    db().prepare("UPDATE staff SET failed_logins = 0, locked_until = 0 WHERE id = ?").bind(row.id),
    db().prepare("DELETE FROM staff_sessions WHERE expires_at < ?").bind(now),
    db()
      .prepare("INSERT INTO staff_sessions (id, staff_id, expires_at) VALUES (?, ?, ?)")
      .bind(await sha256(token), row.id, now + SESSION_MS),
  ]);
  (await cookies()).set(COOKIE, token, { ...cookieOptions(secure), maxAge: SESSION_MS / 1000 });
  return "ok";
}

export async function logOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db().prepare("DELETE FROM staff_sessions WHERE id = ?").bind(await sha256(token)).run();
  jar.delete({ name: COOKIE, path: BASE_PATH || "/" });
}

/** Whoever is logged in on this browser, or null. */
export async function currentStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return db()
    .prepare(
      `SELECT s.id, s.business_id, s.username, s.name, s.role
       FROM staff_sessions x JOIN staff s ON s.id = x.staff_id
       WHERE x.id = ? AND x.expires_at > ? AND s.disabled_at IS NULL`
    )
    .bind(await sha256(token), Date.now())
    .first<Staff>();
}

/** For staff pages: the login screen if nobody is logged in. */
export async function requireStaff(role?: Role): Promise<Staff> {
  const staff = await currentStaff();
  if (!staff) redirect("/staff/login");
  if (role && staff.role !== role) redirect("/staff");
  return staff;
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

export async function addWaiter(
  businessId: string,
  name: string,
  username: string,
  password: string
): Promise<"ok" | "taken"> {
  const taken = await db().prepare("SELECT 1 FROM staff WHERE username = ?").bind(username).first();
  if (taken) return "taken";
  await db()
    .prepare(
      `INSERT INTO staff (id, business_id, username, name, role, password_hash, created_at)
       VALUES (?, ?, ?, ?, 'waiter', ?, ?)`
    )
    .bind(randomId(), businessId, username, name, await hashPassword(password), Date.now())
    .run();
  return "ok";
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
