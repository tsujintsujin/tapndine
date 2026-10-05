import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { createCategory, parseCategoryName } from "@/lib/menu-admin";

/** Adds a category. Body: { name }. */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const name = parseCategoryName((await body(req))?.name);
  if (!name) return fail("Name the category (up to 30 characters).");
  return NextResponse.json({ id: await createCategory(me.business_id, name) });
}
