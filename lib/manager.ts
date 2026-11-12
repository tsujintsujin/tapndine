import { NextResponse } from "next/server";
import { currentLogin, currentStaff, type Login, type Staff } from "./staff";

/** For manager-only API routes: the manager, or the response to send instead. */
export async function managerOr(): Promise<Staff | NextResponse> {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "logged out" }, { status: 401 });
  if (staff.role !== "manager") return NextResponse.json({ error: "Managers only." }, { status: 403 });
  return staff;
}

/** For owner-only API routes (a developer working in the restaurant counts): the owner, or the response to send instead. */
export async function ownerOr(): Promise<Staff | NextResponse> {
  const staff = await managerOr();
  if (staff instanceof NextResponse || staff.owner) return staff;
  return NextResponse.json({ error: "Only the account owner can change this." }, { status: 403 });
}

/** For developer-only API routes: the developer, or the response to send instead. */
export async function developerOr(): Promise<Login | NextResponse> {
  const login = await currentLogin();
  if (!login) return NextResponse.json({ error: "logged out" }, { status: 401 });
  if (login.role !== "developer") return NextResponse.json({ error: "Developers only." }, { status: 403 });
  return login;
}

export const body = async (req: Request) => (await req.json().catch(() => null)) as Record<string, unknown> | null;
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
