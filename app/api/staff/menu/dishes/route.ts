import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { parseDishInput, saveDish } from "@/lib/menu-admin";

/** Adds a dish. Body: the editor's fields. */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const x = parseDishInput(await body(req));
  if (typeof x === "string") return fail(x);
  return NextResponse.json({ id: await saveDish(me.business_id, null, x) });
}
