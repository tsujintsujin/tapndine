import { NextResponse } from "next/server";
import { BASE_PATH, OPEN_COOKIE } from "@/lib/base";
import { deletePhotos } from "@/lib/cloudinary";
import { deleteRestaurant, parseName, renameRestaurant, restaurantSlug, setRestaurantOff } from "@/lib/dev";
import { body, developerOr, fail } from "@/lib/manager";
import { checkPassword } from "@/lib/staff";

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

/**
 * Deletes the restaurant for good, with its dish photos. Body: { password },
 * the developer's own. photos: false when the rows are gone but Cloudinary
 * refused, so the photos are still there.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  const { id } = await params;
  const password = (await body(req))?.password;
  const checked = typeof password === "string" && password ? await checkPassword(me.id, password) : "wrong";
  if (checked === "locked") return fail("Too many wrong tries. Wait 5 minutes, then try again.", 429);
  if (checked !== "ok") return fail("Wrong password. Nothing was deleted.", 403);
  const slug = await restaurantSlug(id);
  if (!slug || !(await deleteRestaurant(id))) return fail("No such restaurant.", 404);
  let photos = true;
  try {
    await deletePhotos(slug);
  } catch {
    photos = false;
  }
  const res = NextResponse.json({ ok: true, photos });
  // It was open in this browser: drop the hint so pages do not point at it.
  if (me.business_id === id) res.cookies.delete({ name: OPEN_COOKIE, path: BASE_PATH || "/" });
  return res;
}
