import { NextResponse } from "next/server";
import { parseFix, sendCheck } from "@/lib/atTable";
import { callWaiter, cleanNickname, isCallKind, loadAtTable, openCalls } from "@/lib/orders";
import { liveVisit } from "@/lib/visits";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * "Call waiter" or "Bill, please". Body: { kind: "waiter" | "bill", nickname?, loc? }.
 * Refused with { blocked } when the restaurant switched that button off, or,
 * while it takes orders, it is closed or the phone is not there.
 */
export async function POST(req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const visit = await liveVisit((await params).visitId);
  if (!visit) return json({ alive: false }, 410);
  const body = (await req.json().catch(() => null)) as { kind?: unknown; nickname?: unknown; loc?: unknown } | null;
  if (!body || !isCallKind(body.kind)) return json({ error: "bad request" }, 400);
  const rules = await loadAtTable(visit.business_id);
  if (!(body.kind === "bill" ? rules.bill : rules.call)) return json({ blocked: "off" }, 403);
  // Sending off: the hours and location guard only orders being sent, so calls pass.
  const check = sendCheck(rules, parseFix(body.loc));
  if (check !== "ok" && check !== "off") return json({ blocked: check }, 403);
  if (!(await callWaiter(visit, body.kind, cleanNickname(body.nickname)))) {
    return json({ error: "This menu is not at a table." }, 422);
  }
  return json({ alive: true, calls: await openCalls(visit) });
}
