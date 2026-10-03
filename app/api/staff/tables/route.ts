import { NextResponse } from "next/server";
import { tablesOverview } from "@/lib/orders";
import { currentStaff } from "@/lib/staff";

/** The tables screen polls this. */
export async function GET() {
  const staff = await currentStaff();
  if (!staff) return NextResponse.json({ error: "logged out" }, { status: 401 });
  return NextResponse.json(
    { tables: await tablesOverview(staff.business_id) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
