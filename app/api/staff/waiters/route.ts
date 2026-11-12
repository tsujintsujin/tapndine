import { NextResponse } from "next/server";
import { ownerOr } from "@/lib/manager";
import { addStaff, isLoginName, MIN_PASSWORD } from "@/lib/staff";
import { tableLimit } from "@/lib/tables";

/** Owner adds a waiter or manager. Body: { name, username, password, role }; username is the part after the restaurant's code. */
export async function POST(req: Request) {
  const staff = await ownerOr();
  if (staff instanceof NextResponse) return staff;
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
  // The Single plan is menu only: no tables, so no ordering and no waiters.
  if (role === "waiter" && (await tableLimit(staff.business_id)) === 0) {
    return NextResponse.json({ error: "Your plan is menu only, so it has no staff logins. Add a manager instead." }, { status: 403 });
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
