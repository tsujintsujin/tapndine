import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { reorderCategories } from "@/lib/menu-admin";

/** Every category in its new order. Body: { ids }. */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const ids = (await body(req))?.ids;
  const ok = Array.isArray(ids) && ids.every((i) => typeof i === "string") && (await reorderCategories(me.business_id, ids));
  return ok ? NextResponse.json({ ok: true }) : fail("The categories changed meanwhile. Reload and try again.", 409);
}
