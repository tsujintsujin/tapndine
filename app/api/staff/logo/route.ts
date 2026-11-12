import { NextResponse } from "next/server";
import { restaurantSlug, setLogo } from "@/lib/dev";
import { body, fail, ownerOr } from "@/lib/manager";

/** Owner sets or removes the logo on the guests' menu. Body: { logoUrl: string | null }. */
export async function POST(req: Request) {
  const me = await ownerOr();
  if (me instanceof NextResponse) return me;
  const raw = (await body(req))?.logoUrl;
  if (raw !== null && typeof raw !== "string") return fail("Upload the logo again.");
  const slug = await restaurantSlug(me.business_id);
  if (!slug) return fail("No such restaurant.", 404);
  if (!(await setLogo(me.business_id, slug, raw || null))) return fail("Upload the logo again.");
  return NextResponse.json({ ok: true });
}
