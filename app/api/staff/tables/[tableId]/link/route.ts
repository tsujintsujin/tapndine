import { NextResponse } from "next/server";
import { fail, managerOr } from "@/lib/manager";
import { newLink } from "@/lib/tables";

/** Manager gives the table a new NFC link. Its old links stop working. */
export async function POST(_req: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  return (await newLink(me.business_id, (await params).tableId))
    ? NextResponse.json({ ok: true })
    : fail("That table no longer exists.", 404);
}
