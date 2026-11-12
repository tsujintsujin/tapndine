import { NextResponse } from "next/server";
import { parseName, renameRestaurant } from "@/lib/dev";
import { body, fail, ownerOr } from "@/lib/manager";

/**
 * Longest name an owner can give (NameCard's input says the same). A 390px
 * phone's menu header shows about 20 characters of it, ~16 with a logo, and
 * cuts the rest with "…".
 */
const MAX = 35;

/** Owner renames their own restaurant, as guests see it at the top of the menu. Body: { name }. */
export async function POST(req: Request) {
  const me = await ownerOr();
  if (me instanceof NextResponse) return me;
  const name = parseName((await body(req))?.name, MAX);
  if (!name) return fail(`Type your café's name (up to ${MAX} characters).`);
  if (!(await renameRestaurant(me.business_id, name))) return fail("No such restaurant.", 404);
  return NextResponse.json({ ok: true });
}
