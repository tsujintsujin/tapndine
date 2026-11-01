import { NextResponse, type NextRequest } from "next/server";
import { body, fail } from "@/lib/manager";
import { checkCode, parseEmail, verified } from "@/lib/signup";

/** The emailed code. Body: { email, code }. Answers { next: "in" } (logged in) or { next: "new" } (name the restaurant). */
export async function POST(req: NextRequest) {
  const b = await body(req);
  const email = parseEmail(b?.email);
  const code = typeof b?.code === "string" ? b.code.replace(/\D/g, "") : "";
  if (!email) return fail("Enter your email address.");
  if (code.length !== 6) return fail("Enter the 6-digit code from the email.");
  const checked = await checkCode(email, code);
  if (checked === "wrong") return fail("That code isn't right. Check the email and try again.", 401);
  if (checked === "expired") return fail("That code has expired. Send a new one.", 410);
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const next = await verified(email, null, secure);
  if (next === "off") return fail("This restaurant is switched off. Ask tapndine to switch it back on.", 403);
  return NextResponse.json({ next });
}
