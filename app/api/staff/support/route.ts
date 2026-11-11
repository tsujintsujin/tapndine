import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { currentStaff } from "@/lib/staff";
import { markSeen, parseMessage, sendMessage, thread } from "@/lib/support";

/** The Support chat polls this while it is on screen, so asking also marks our replies read. */
export async function GET() {
  const me = await currentStaff(true);
  if (!me) return NextResponse.json({ error: "logged out" }, { status: 401 });
  // Developers answer from Tickets; here they would be writing as the restaurant.
  if (me.role !== "manager" || me.developer) return fail("Managers only.", 403);
  const messages = await thread(me.business_id);
  if (!me.guide) await markSeen(me.business_id, true);
  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

/** A manager writes to tappetite. Body: { text }. */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  if (me.developer) return fail("Managers only.", 403);
  const text = parseMessage((await body(req))?.text);
  if (!text) return fail("Write a message of up to 2000 characters.");
  await sendMessage(me.business_id, false, me.name, text);
  return NextResponse.json({ ok: true });
}
