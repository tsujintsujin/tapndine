import { NextResponse } from "next/server";
import { ownerOr } from "@/lib/manager";
import { disableStaff } from "@/lib/staff";

/** Owner removes a waiter or manager. Nothing is deleted. */
export async function POST(_req: Request, { params }: { params: Promise<{ staffId: string }> }) {
  const staff = await ownerOr();
  if (staff instanceof NextResponse) return staff;
  await disableStaff(staff.business_id, (await params).staffId);
  return NextResponse.json({ ok: true });
}
