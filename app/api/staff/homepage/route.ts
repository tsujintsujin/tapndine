import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { setHomepage } from "@/lib/menu-admin";

const ids = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 500 && v.every((i) => typeof i === "string");

/** Manager sets the menu home. Body: { hero: dishId | null, featured: dishId[], fresh: dishId[] }. */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const b = await body(req);
  const [hero, featured, fresh] = [b?.hero, b?.featured, b?.fresh];
  if (hero !== null && typeof hero !== "string") return fail("Pick the hero again.");
  if (!ids(featured) || !ids(fresh)) return fail("Pick the dishes again.");
  if (!(await setHomepage(me.business_id, hero, featured, fresh))) return fail("That dish is no longer on the menu.", 404);
  return NextResponse.json({ ok: true });
}
