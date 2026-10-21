import { NextResponse } from "next/server";
import { addAdditional } from "@/lib/orders";
import { currentStaff } from "@/lib/staff";

/** The waiter adds a dish to the table's Additionals. Body: { dishId, qty, options? } (option ids). */
export async function POST(req: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "logged out" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { dishId?: unknown; qty?: unknown; options?: unknown } | null;
  const ok =
    !!body &&
    typeof body.dishId === "string" &&
    typeof body.qty === "number" &&
    (await addAdditional(staff.business_id, (await params).tableId, staff.id, body.dishId, body.qty, body.options));
  if (!ok) return NextResponse.json({ error: "That dish could not be added." }, { status: 422 });
  return NextResponse.json({ ok: true });
}
