import { NextResponse } from "next/server";
import { cleanNickname, guestOrders, openCalls, sendOrder, type Requested } from "@/lib/orders";
import { liveVisit } from "@/lib/visits";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** What this phone has already sent to the waiter (with whether the waiter has seen it), and the table's open calls. */
export async function GET(_req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const visit = await liveVisit((await params).visitId);
  if (!visit) return json({ alive: false }, 410);
  const [sent, calls] = await Promise.all([guestOrders(visit), openCalls(visit)]);
  return json({ alive: true, sent, calls });
}

/** Send to waiter. Body: { key, items: [{ dishId, qty, note? }], nickname? }. */
export async function POST(req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const visit = await liveVisit((await params).visitId);
  if (!visit) return json({ alive: false }, 410);
  const body = (await req.json().catch(() => null)) as { key?: unknown; items?: unknown; nickname?: unknown } | null;
  if (!body || typeof body.key !== "string" || !Array.isArray(body.items)) return json({ error: "bad request" }, 400);
  const result = await sendOrder(visit, body.key, body.items as Requested, cleanNickname(body.nickname));
  if (result === "closed") return json({ alive: false }, 410);
  if (result === "invalid") return json({ error: "Some of these dishes can no longer be ordered." }, 422);
  return json({ alive: true, sent: await guestOrders(visit) });
}
