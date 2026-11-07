import { NextResponse, type NextRequest } from "next/server";
import { body, fail } from "@/lib/manager";
import { checkCode, newTicket, ownerByEmail, parseEmail } from "@/lib/signup";
import { hashPassword } from "@/lib/staff";
import { OWNER_MIN_PASSWORD } from "@/lib/trial";

/**
 * The code that proves a new account's email. Body: { email, code, password }.
 * A right code gives a sign-up ticket holding the hashed password; the next
 * step names the restaurant. It never logs anyone in: an owner with an
 * account logs in with their password or Google.
 */
export async function POST(req: NextRequest) {
  const b = await body(req);
  const email = parseEmail(b?.email);
  const code = typeof b?.code === "string" ? b.code.replace(/\D/g, "") : "";
  const password = typeof b?.password === "string" ? b.password : "";
  if (!email) return fail("Enter your email address.");
  if (code.length !== 6) return fail("Enter the 6-digit code from the email.");
  if (password.length < OWNER_MIN_PASSWORD || password.length > 200) return fail("Go back and pick a password again.");
  if (await ownerByEmail(email)) return fail("There's already an account with this email. Log in instead.", 409);
  const checked = await checkCode(email, code);
  if (checked === "wrong") return fail("That code isn't right. Check the email and try again.", 401);
  if (checked === "expired") return fail("That code has expired. Send a new one.", 410);
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  await newTicket(email, null, await hashPassword(password), secure);
  return NextResponse.json({ ok: true });
}
