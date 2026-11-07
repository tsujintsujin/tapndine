import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/cf";
import { body, fail } from "@/lib/manager";
import { checkCode, ownerByEmail, parseEmail } from "@/lib/signup";
import { hashPassword, startSession } from "@/lib/staff";
import { OWNER_MIN_PASSWORD } from "@/lib/trial";

/** Sets an owner's new password with the emailed code, then logs them in. Body: { email, code, password }. */
export async function POST(req: NextRequest) {
  const b = await body(req);
  const email = parseEmail(b?.email);
  const code = typeof b?.code === "string" ? b.code.replace(/\D/g, "") : "";
  const password = typeof b?.password === "string" ? b.password : "";
  if (!email) return fail("Enter your email address.");
  if (code.length !== 6) return fail("Enter the 6-digit code from the email.");
  if (password.length < OWNER_MIN_PASSWORD) return fail(`Pick a password of at least ${OWNER_MIN_PASSWORD} characters.`);
  if (password.length > 200) return fail("Keep the password under 200 characters.");
  const checked = await checkCode(email, code);
  if (checked === "wrong") return fail("That code isn't right. Check the email and try again.", 401);
  if (checked === "expired") return fail("That code has expired. Send a new one.", 410);
  const owner = await ownerByEmail(email);
  if (!owner) return fail("That code has expired. Send a new one.", 410);
  const off = await db()
    .prepare("SELECT b.disabled_at FROM staff s JOIN businesses b ON b.id = s.business_id WHERE s.id = ?")
    .bind(owner.id)
    .first<{ disabled_at: number | null }>();
  await db().prepare("UPDATE staff SET password_hash = ?, failed_logins = 0, locked_until = 0 WHERE id = ?").bind(await hashPassword(password), owner.id).run();
  if (off?.disabled_at) return fail("Password saved, but this restaurant is switched off. Ask tapndine to switch it back on.", 403);
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  await startSession(owner.id, secure);
  return NextResponse.json({ ok: true });
}
