import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { deleteCategory, parseCategoryName, renameCategory, setCategoryDishes, setCategoryParent } from "@/lib/menu-admin";

type Ctx = { params: Promise<{ categoryId: string }> };

/** Renames it and, if sent, sets which dishes are in it and what it sits under. Body: { name, dishIds?, parentId? }. */
export async function PUT(req: Request, { params }: Ctx) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const b = await body(req);
  const name = parseCategoryName(b?.name);
  if (!name) return fail("Name the category (up to 30 characters).");
  const dishIds = b?.dishIds;
  if (dishIds !== undefined && !(Array.isArray(dishIds) && dishIds.every((i) => typeof i === "string"))) {
    return fail("Pick the dishes again.");
  }
  const parentId = b?.parentId;
  if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
    return fail("Pick a main category for it to sit under.");
  }
  const { categoryId } = await params;
  if (parentId !== undefined && !(await setCategoryParent(me.business_id, categoryId, parentId))) {
    return fail("Pick a main category for it to sit under.");
  }
  const ok =
    (await renameCategory(me.business_id, categoryId, name)) &&
    (dishIds === undefined || (await setCategoryDishes(me.business_id, categoryId, dishIds)));
  return ok ? NextResponse.json({ ok: true }) : fail("That category no longer exists.", 404);
}

/** Deletes it. Its dishes stay on the menu. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  return (await deleteCategory(me.business_id, (await params).categoryId))
    ? NextResponse.json({ ok: true })
    : fail("That category no longer exists.", 404);
}
