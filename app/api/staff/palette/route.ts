import { NextResponse } from "next/server";
import { setPalette } from "@/lib/dev";
import { body, fail, ownerOr } from "@/lib/manager";
import { palette } from "@/lib/palettes";

/** Owner picks the colours of the guests' menu. Body: { palette: PaletteId | null } (null = default). */
export async function POST(req: Request) {
  const me = await ownerOr();
  if (me instanceof NextResponse) return me;
  const id = (await body(req))?.palette;
  if (id !== null && !palette(typeof id === "string" ? id : null)) return fail("Pick one of the colour schemes.");
  if (!(await setPalette(me.business_id, (id as string | null) ?? null))) return fail("No such restaurant.", 404);
  return NextResponse.json({ ok: true });
}
