import { NextResponse } from "next/server";
import { tableOrders } from "@/lib/orders";
import { currentStaff } from "@/lib/staff";

/** One table's orders; the table screen polls this. */
export async function GET(_req: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "logged out" }, { status: 401 });
  const table = await tableOrders(staff.business_id, (await params).tableId);
  if (!table) return NextResponse.json({ error: "no such table" }, { status: 404 });
  return NextResponse.json({ table }, { headers: { "Cache-Control": "no-store" } });
}
