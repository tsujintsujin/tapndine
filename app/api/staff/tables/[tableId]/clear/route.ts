import { NextResponse } from "next/server";
import { clearTable } from "@/lib/orders";
import { currentStaff } from "@/lib/staff";

/** Clear table (paid). */
export async function POST(_req: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "logged out" }, { status: 401 });
  await clearTable(staff.business_id, (await params).tableId);
  return NextResponse.json({ ok: true });
}
