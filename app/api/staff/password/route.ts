import { NextResponse } from "next/server";
import { body, fail } from "@/lib/manager";
import { changePassword, currentLogin } from "@/lib/staff";
import { OWNER_MIN_PASSWORD } from "@/lib/trial";

/** The owner changes their own password. Body: { current, password }. Not for a Google-only login, which has none. */
export async function POST(req: Request) {
  const login = await currentLogin();
  if (!login) return fail("logged out", 401);
  if (login.role !== "owner" || !login.hasPassword) return fail("Only an owner who logs in with a password can change it.", 403);
  const b = await body(req);
  const current = typeof b?.current === "string" ? b.current : "";
  const next = typeof b?.password === "string" ? b.password : "";
  if (next.length < OWNER_MIN_PASSWORD) return fail(`Pick a new password of at least ${OWNER_MIN_PASSWORD} characters.`);
  if (next.length > 200) return fail("Keep the password under 200 characters.");
  const r = await changePassword(login, current, next);
  if (r === "locked") return fail("Too many wrong tries. Wait 5 minutes and try again.", 429);
  if (r === "wrong") return fail("Your current password isn't right.", 403);
  return NextResponse.json({ ok: true });
}
