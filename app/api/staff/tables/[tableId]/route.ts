import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { tableOrders } from "@/lib/orders";
import { currentStaff } from "@/lib/staff";
import { parseLabel, removeTable, renameTable } from "@/lib/tables";

type Ctx = { params: Promise<{ tableId: string }> };

/** One table's orders; the table screen polls this. */
export async function GET(_req: Request, { params }: Ctx) {
  const staff = await currentStaff(true);
  if (!staff) return NextResponse.json({ error: "logged out" }, { status: 401 });
  const table = await tableOrders(staff.business_id, (await params).tableId, !staff.guide);
  if (!table) return NextResponse.json({ error: "no such table" }, { status: 404 });
  return NextResponse.json({ table }, { headers: { "Cache-Control": "no-store" } });
}

/** Manager renames it. Body: { label }. */
export async function PUT(req: Request, { params }: Ctx) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const label = parseLabel((await body(req))?.label);
  if (!label) return fail("Name the table (up to 40 characters).");
  return (await renameTable(me.business_id, (await params).tableId, label))
    ? NextResponse.json({ ok: true })
    : fail("That table no longer exists.", 404);
}

/** Manager deletes it and its links. Past orders keep it. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const r = await removeTable(me.business_id, (await params).tableId);
  if (r === "missing") return fail("That table no longer exists.", 404);
  if (r === "open") return fail("Guests are still at this table. Clear it on the Tables page first.", 409);
  return NextResponse.json({ ok: true });
}
