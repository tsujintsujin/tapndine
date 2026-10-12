import { NextResponse } from "next/server";
import { deleteContract } from "@/lib/billing";
import { developerOr, fail } from "@/lib/manager";

/** Deletes a contract typed by mistake. Refused once it has payments. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  const r = await deleteContract((await params).id);
  if (r === "paid") return fail("It has payments. Delete those first.", 409);
  return r === "ok" ? NextResponse.json({ ok: true }) : fail("No such contract.", 404);
}
