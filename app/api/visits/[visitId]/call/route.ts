import { NextResponse } from "next/server";
import { callWaiter, cleanNickname, isCallKind, openCalls } from "@/lib/orders";
import { liveVisit } from "@/lib/visits";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** "Call waiter" or "Bill, please". Body: { kind: "waiter" | "bill", nickname? }. */
export async function POST(req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const visit = await liveVisit((await params).visitId);
  if (!visit) return json({ alive: false }, 410);
  const body = (await req.json().catch(() => null)) as { kind?: unknown; nickname?: unknown } | null;
  if (!body || !isCallKind(body.kind)) return json({ error: "bad request" }, 400);
  if (!(await callWaiter(visit, body.kind, cleanNickname(body.nickname)))) {
    return json({ error: "This menu is not at a table." }, 422);
  }
  return json({ alive: true, calls: await openCalls(visit) });
}
