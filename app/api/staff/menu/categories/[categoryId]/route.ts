import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { deleteCategory, parseCategoryName, renameCategory } from "@/lib/menu-admin";

type Ctx = { params: Promise<{ categoryId: string }> };

/** Renames it. Body: { name }. */
export async function PUT(req: Request, { params }: Ctx) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const name = parseCategoryName((await body(req))?.name);
  if (!name) return fail("Name the category (up to 30 characters).");
  return (await renameCategory(me.business_id, (await params).categoryId, name))
    ? NextResponse.json({ ok: true })
    : fail("That category no longer exists.", 404);
}

/** Deletes it. Its dishes stay on the menu. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  return (await deleteCategory(me.business_id, (await params).categoryId))
    ? NextResponse.json({ ok: true })
    : fail("That category no longer exists.", 404);
}
