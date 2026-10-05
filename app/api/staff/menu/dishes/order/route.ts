import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { reorderDishes } from "@/lib/menu-admin";

/** The whole menu in its new order. Body: { ids }. */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const ids = (await body(req))?.ids;
  const ok = Array.isArray(ids) && ids.every((i) => typeof i === "string") && (await reorderDishes(me.business_id, ids));
  return ok ? NextResponse.json({ ok: true }) : fail("The menu changed meanwhile. Reload and try again.", 409);
}
