import { NextResponse } from "next/server";
import { currentStaff, type Staff } from "./staff";

/** For manager-only API routes: the manager, or the response to send instead. */
export async function managerOr(): Promise<Staff | NextResponse> {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "logged out" }, { status: 401 });
  if (staff.role !== "manager") return NextResponse.json({ error: "Managers only." }, { status: 403 });
  return staff;
}

export const body = async (req: Request) => (await req.json().catch(() => null)) as Record<string, unknown> | null;
export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
