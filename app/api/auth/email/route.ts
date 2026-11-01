import { NextResponse } from "next/server";
import { body, fail } from "@/lib/manager";
import { parseEmail, sendCode } from "@/lib/signup";

/** Emails a sign-in code. Body: { email }. */
export async function POST(req: Request) {
  const email = parseEmail((await body(req))?.email);
  if (!email) return fail("Enter your email address.");
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
