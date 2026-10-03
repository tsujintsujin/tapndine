import { NextResponse } from "next/server";
import { currentStaff, disableWaiter } from "@/lib/staff";

/** Manager disables a waiter. Nothing is deleted. */
export async function POST(_req: Request, { params }: { params: Promise<{ staffId: string }> }) {
  const staff = await currentStaff();
  if (staff?.role !== "manager") return NextResponse.json({ error: "Managers only." }, { status: 403 });
  await disableWaiter(staff.business_id, (await params).staffId);
  return NextResponse.json({ ok: true });
}
