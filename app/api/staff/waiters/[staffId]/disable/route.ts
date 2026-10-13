import { NextResponse } from "next/server";
import { currentStaff, disableStaff } from "@/lib/staff";

/** Manager removes a waiter or another manager. Nothing is deleted. */
export async function POST(_req: Request, { params }: { params: Promise<{ staffId: string }> }) {
  const staff = await currentStaff();
  if (staff?.role !== "manager") return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const r = await disableStaff(staff.business_id, (await params).staffId, staff.id);
  if (r === "self") return NextResponse.json({ error: "You can't remove yourself." }, { status: 409 });
  if (r === "last") return NextResponse.json({ error: "Keep at least one manager." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
