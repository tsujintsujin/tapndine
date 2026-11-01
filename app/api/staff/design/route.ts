import { NextResponse } from "next/server";
import { setDesign } from "@/lib/dev";
import { body, fail, managerOr } from "@/lib/manager";

/** Manager picks the look of the guests' menu. Body: { design: "a" | "b" | "c" }. */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const design = (await body(req))?.design;
  if (design !== "a" && design !== "b" && design !== "c") return fail("Pick Design A, B or C.");
  if (!(await setDesign(me.business_id, design))) return fail("No such restaurant.", 404);
  return NextResponse.json({ ok: true });
}
