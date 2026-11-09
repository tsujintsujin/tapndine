import { NextResponse } from "next/server";
import { restaurantExists } from "@/lib/dev";
import { body, developerOr, fail } from "@/lib/manager";
import { markSeen, parseMessage, sendMessage, thread } from "@/lib/support";

type Ctx = { params: Promise<{ id: string }> };

/** The open conversation polls this while it is on screen, so asking also marks the restaurant's messages read. */
export async function GET(_: Request, { params }: Ctx) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  const { id } = await params;
  const messages = await thread(id);
  await markSeen(id, false);
  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

/** A developer replies. Body: { text }. */
export async function POST(req: Request, { params }: Ctx) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  const { id } = await params;
  if (!(await restaurantExists(id))) return fail("No such restaurant.", 404);
  const text = parseMessage((await body(req))?.text);
  if (!text) return fail("Write a message of up to 2000 characters.");
  await sendMessage(id, true, me.name, text);
  return NextResponse.json({ ok: true });
}
