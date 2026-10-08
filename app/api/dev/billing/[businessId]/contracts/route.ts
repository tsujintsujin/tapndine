import { NextResponse } from "next/server";
import { addContract, parseContract } from "@/lib/billing";
import { body, developerOr, fail } from "@/lib/manager";

/** A developer records a contract the restaurant signed. */
export async function POST(req: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  const x = parseContract(await body(req));
  if (typeof x === "string") return fail(x);
  return (await addContract((await params).businessId, x)) ? NextResponse.json({ ok: true }) : fail("No such restaurant.", 404);
}
