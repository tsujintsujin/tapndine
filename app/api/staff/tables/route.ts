import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { tablesOverview } from "@/lib/orders";
import { currentStaff } from "@/lib/staff";
import { addTable, parseLabel } from "@/lib/tables";

/** The tables screen polls this. */
export async function GET() {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "logged out" }, { status: 401 });
  return NextResponse.json(
    { tables: await tablesOverview(staff.business_id) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Manager adds a table; it gets its NFC link straight away. Body: { label }. */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const label = parseLabel((await body(req))?.label);
  if (!label) return fail("Name the table (up to 40 characters).");
  if ((await addTable(me.business_id, label)) === "full") {
    return fail("Your plan's tables are all used. Delete a table, or contact tapndine to move to a bigger plan.", 409);
  }
  return NextResponse.json({ ok: true });
}
