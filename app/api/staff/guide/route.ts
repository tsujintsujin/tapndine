import { NextResponse, type NextRequest } from "next/server";
import { body } from "@/lib/manager";
import { currentLogin, setGuide } from "@/lib/staff";

/** Starts ({ on: true }) or ends ({ on: false }) the guide on this browser. Not for waiters. */
export async function POST(req: NextRequest) {
  const login = await currentLogin();
  if (!login) return NextResponse.json({ error: "logged out" }, { status: 401 });
  if (login.role === "waiter") return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  await setGuide(login, (await body(req))?.on === true, secure);
  return NextResponse.json({ ok: true });
}
