import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/cf";
import { sendMail } from "@/lib/mail";

const NOTIFY = "justin.masiga.94@gmail.com";

/**
 * "Forgot password?" on the login page. There is no self-serve reset: the
 * request is emailed to Justin, who resets it and sends the new password to
 * the contact given. The reply never says whether the username exists; only
 * the email does.
 */
// ponytail: no rate limit, so the form can flood Justin's inbox; add a per-IP cap if it gets abused.
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const username = str(b?.username, 60).toLowerCase();
  const contact = str(b?.contact, 200);
  if (!username) return NextResponse.json({ error: "Enter your username." }, { status: 400 });
  if (!contact) return NextResponse.json({ error: "Enter a phone number or email we can reach you on." }, { status: 400 });

  const who = await db()
    .prepare(
      `SELECT s.name, s.role, b.name AS restaurant
       FROM staff s LEFT JOIN businesses b ON b.id = s.business_id
       WHERE s.username = ? AND s.disabled_at IS NULL`
    )
    .bind(username)
    .first<{ name: string; role: string; restaurant: string | null }>();

  const sent = await sendMail({
    to: NOTIFY,
    replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : undefined,
    subject: `tappetite password reset: ${username}`,
    text:
      `Password reset request\n\nUsername: ${username}\n` +
      (who
        ? `Account: ${who.name} (${who.role}${who.restaurant ? `, ${who.restaurant}` : ""})\n`
        : `Account: NO ACTIVE LOGIN WITH THIS USERNAME\n`) +
      `Reach them on: ${contact}\n`,
  });
  if (!sent.delivered) return NextResponse.json({ error: "Couldn't send the request. Try again in a bit." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
