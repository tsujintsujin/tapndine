import { NextResponse, type NextRequest } from "next/server";
import { BASE_PATH, OPEN_COOKIE } from "@/lib/base";
import { restaurantExists } from "@/lib/dev";
import { body, developerOr, fail } from "@/lib/manager";
import { openRestaurant } from "@/lib/staff";

/** A developer opens a restaurant: this session now works in it. Body: { id }. */
export async function POST(req: NextRequest) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  const id = (await body(req))?.id;
  if (typeof id !== "string" || !(await restaurantExists(id))) return fail("No such restaurant.", 404);
  await openRestaurant(id);
  const res = NextResponse.json({ ok: true });
  // Not a key to anything: the session decides the restaurant. Pages opened
  // before the switch read it to warn instead of acting on a stale screen.
  res.cookies.set(OPEN_COOKIE, id, { path: BASE_PATH || "/", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 });
  return res;
}
