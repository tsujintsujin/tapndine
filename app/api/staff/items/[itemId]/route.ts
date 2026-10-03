import { NextResponse } from "next/server";
import { setLineQty } from "@/lib/orders";
import { currentStaff } from "@/lib/staff";

/** The waiter changes a line's quantity; 0 removes it. Body: { qty }. */
export async function POST(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "logged out" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { qty?: unknown } | null;
  const ok =
    !!body && typeof body.qty === "number" && (await setLineQty(staff.business_id, staff.id, (await params).itemId, body.qty));
  if (!ok) return NextResponse.json({ error: "That item could not be changed." }, { status: 422 });
  return NextResponse.json({ ok: true });
}
