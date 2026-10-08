import { NextResponse } from "next/server";
import { parseName, renameRestaurant, setRestaurantOff } from "@/lib/dev";
import { body, developerOr, fail } from "@/lib/manager";

/** Rename ({ name }) or switch off and on ({ off }). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  const { id } = await params;
  const b = await body(req);
  if (typeof b?.off === "boolean") {
    return (await setRestaurantOff(id, b.off)) ? NextResponse.json({ ok: true }) : fail("No such restaurant.", 404);
  }
  const name = parseName(b?.name);
  if (!name) return fail("Name the restaurant (up to 60 characters).");
  return (await renameRestaurant(id, name)) ? NextResponse.json({ ok: true }) : fail("No such restaurant.", 404);
}
