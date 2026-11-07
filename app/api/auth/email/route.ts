import { NextResponse } from "next/server";
import { body, fail } from "@/lib/manager";
import { ownerByEmail, parseEmail, sendCode } from "@/lib/signup";
import { OWNER_MIN_PASSWORD } from "@/lib/trial";

/**
 * Creating an account with an email and password: emails the code that proves
 * the address. Body: { email, password }. The password is only checked here;
 * it is sent again with the code (./verify), which stores it.
 */
export async function POST(req: Request) {
  const b = await body(req);
  const email = parseEmail(b?.email);
  if (!email) return fail("Enter your email address.");
  if (typeof b?.password !== "string" || b.password.length < OWNER_MIN_PASSWORD) {
    return fail(`Pick a password of at least ${OWNER_MIN_PASSWORD} characters.`);
  }
  if (b.password.length > 200) return fail("Keep the password under 200 characters.");
  if (await ownerByEmail(email)) return fail("There's already an account with this email. Log in instead.", 409);
  const r = await sendCode(email);
  // recent: the code sent a moment ago still works, so the form can go on to typing it.
  if (r === "wait") {
    return NextResponse.json(
      { error: "We just sent you a code. Use that one, or wait a minute before asking for another.", recent: true },
      { status: 429 }
    );
  }
  if (r === "limit") return fail("Too many codes sent to this email. Try again in an hour.", 429);
  if (r === "mail") return fail("We couldn't send the email. Try again, or continue with Google.", 502);
  return NextResponse.json({ ok: true });
}
