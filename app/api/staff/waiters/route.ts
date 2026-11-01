import { NextResponse } from "next/server";
import { addStaff, currentStaff, isLoginName, MIN_PASSWORD } from "@/lib/staff";

/** Manager adds a waiter or manager. Body: { name, username, password, role }; username is the part after the restaurant's code. */
export async function POST(req: Request) {
  const staff = await currentStaff();
  if (staff?.role !== "manager") return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role === "manager" ? "manager" : "waiter";
  if (!name || name.length > 60) return NextResponse.json({ error: "Enter their name." }, { status: 400 });
  if (!isLoginName(username)) {
    return NextResponse.json(
      { error: "Username: 2 to 30 letters, numbers, dots or underscores, no dashes." },
      { status: 400 }
    );
  }
  if (password.length < MIN_PASSWORD || password.length > 200) {
    return NextResponse.json({ error: `Password: at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }
  const added = await addStaff(staff.business_id, name, username, password, role);
  if (added === "taken") return NextResponse.json({ error: "That username is taken." }, { status: 409 });
  if (added === "full") {
    return NextResponse.json(
      { error: "The free trial has room for 2 staff logins besides yours. Pick a plan to add more." },
      { status: 403 }
    );
  }
  return NextResponse.json({ ok: true, username: added });
}
