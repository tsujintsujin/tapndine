import { NextResponse, type NextRequest } from "next/server";
import { logIn } from "@/lib/staff";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Enter your email or username, and your password." }, { status: 400 });
  }
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const result = await logIn(body.username, body.password.slice(0, 200), secure);
  if (result === "locked") {
    return NextResponse.json({ error: "Too many wrong tries. Wait 5 minutes, then try again." }, { status: 429 });
  }
  if (result === "off") return NextResponse.json({ error: "This restaurant is switched off. Ask tapndine to switch it back on." }, { status: 403 });
  if (result === "wrong") return NextResponse.json({ error: "Wrong email, username or password." }, { status: 401 });
  return NextResponse.json({ ok: true });
}
