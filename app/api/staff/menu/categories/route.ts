import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { createCategory, isMainCategory, parseCategoryName } from "@/lib/menu-admin";

/** Adds a category, under a main one if parentId is sent. Body: { name, parentId? }. */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const b = await body(req);
  const name = parseCategoryName(b?.name);
  if (!name) return fail("Name the category (up to 30 characters).");
  const parentId = typeof b?.parentId === "string" && b.parentId ? b.parentId : null;
  if (parentId && !(await isMainCategory(me.business_id, parentId))) return fail("Pick a main category for it to sit under.");
  return NextResponse.json({ id: await createCategory(me.business_id, name, parentId) });
}
