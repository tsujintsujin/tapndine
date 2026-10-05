import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { parseDishInput, removeDish, saveDish } from "@/lib/menu-admin";

type Ctx = { params: Promise<{ dishId: string }> };

/** Saves the editor's changes to a dish. */
export async function PUT(req: Request, { params }: Ctx) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const x = parseDishInput(await body(req));
  if (typeof x === "string") return fail(x);
  const id = await saveDish(me.business_id, (await params).dishId, x);
  return id ? NextResponse.json({ id }) : fail("That dish is no longer on the menu.", 404);
}

/** Takes the dish off the menu. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  return (await removeDish(me.business_id, (await params).dishId))
    ? NextResponse.json({ ok: true })
    : fail("That dish is no longer on the menu.", 404);
}
