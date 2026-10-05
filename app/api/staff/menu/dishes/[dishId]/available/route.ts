import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { setDishAvailable } from "@/lib/menu-admin";

/** Sold out, or back on. Body: { available }. */
export async function POST(req: Request, { params }: { params: Promise<{ dishId: string }> }) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const b = await body(req);
  if (typeof b?.available !== "boolean") return fail("Say whether the dish is available.");
  return (await setDishAvailable(me.business_id, (await params).dishId, b.available))
    ? NextResponse.json({ ok: true })
    : fail("That dish is no longer on the menu.", 404);
}
