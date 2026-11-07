import { NextResponse } from "next/server";
import { body, fail } from "@/lib/manager";
import { ownerByEmail, parseEmail, sendCode } from "@/lib/signup";

/**
 * "Forgot password?" for an owner, who logs in with an email: emails a code to
 * set a new password (./verify). Body: { email }. The answer is the same
 * whether or not the email has an account, so it reveals nothing.
 * Staff log in with a username and ask their manager (app/api/staff/forgot).
 */
export async function POST(req: Request) {
  const email = parseEmail((await body(req))?.email);
  if (!email) return fail("Enter your email address.");
  if (await ownerByEmail(email)) {
    const r = await sendCode(email);
    if (r === "limit") return fail("Too many codes sent to this email. Try again in an hour.", 429);
    if (r === "mail") return fail("We couldn't send the email. Try again in a bit.", 502);
  }
  return NextResponse.json({ ok: true });
}
