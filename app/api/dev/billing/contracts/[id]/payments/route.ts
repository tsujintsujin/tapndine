import { NextResponse } from "next/server";
import { addPayment, parsePayment } from "@/lib/billing";
import { body, developerOr, fail } from "@/lib/manager";

/** A developer records money received for a contract. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  const x = parsePayment(await body(req));
  if (typeof x === "string") return fail(x);
  return (await addPayment((await params).id, x)) ? NextResponse.json({ ok: true }) : fail("No such contract.", 404);
}
