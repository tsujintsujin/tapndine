import { NextResponse } from "next/server";
import { addWaiter, currentStaff, isLoginName, MIN_PASSWORD } from "@/lib/staff";

/** Manager adds a waiter. Body: { name, username, password }; username is the part after the restaurant's code. */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (staff?.role !== "manager") return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name || name.length > 60) return NextResponse.json({ error: "Enter the waiter's name." }, { status: 400 });
  if (!isLoginName(username)) {
    return NextResponse.json(
      { error: "Username: 2 to 30 letters, numbers, dots or underscores, no dashes." },
      { status: 400 }
    );
  }
  if (password.length < MIN_PASSWORD || password.length > 200) {
    return NextResponse.json({ error: `Password: at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }
  const added = await addWaiter(staff.business_id, name, username, password);
  if (added === "taken") return NextResponse.json({ error: "That username is taken." }, { status: 409 });
  return NextResponse.json({ ok: true, username: added });
}
