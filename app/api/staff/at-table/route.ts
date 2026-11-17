import { NextResponse } from "next/server";
import { isHhmm, isRadius, parseFix } from "@/lib/atTable";
import { db } from "@/lib/cf";
import { body, fail, managerOr } from "@/lib/manager";

/**
 * Settings > General > At the table. Any manager may change it (it is how the
 * floor runs, not how the brand looks). Body: any of
 *   { send, call, bill }: booleans
 *   { hours: { opensAt, closesAt } | null }: "HH:MM" each, or null for any time
 *   { radius }: 50 | 100 | 200
 *   { here: { lat, lng, acc } }: the manager's phone, inside the restaurant
 * Saves only what it was given.
 */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const b = (await body(req)) ?? {};
  const set: string[] = [];
  const vals: (string | number | null)[] = [];
  const put = (col: string, v: string | number | null) => {
    set.push(`${col} = ?`);
    vals.push(v);
  };

  for (const [key, col] of [["send", "send_orders"], ["call", "call_staff"], ["bill", "ask_bill"]] as const) {
    if (key in b) {
      if (typeof b[key] !== "boolean") return fail("Say on or off.");
      put(col, b[key] ? 1 : 0);
    }
  }
  if ("hours" in b) {
    const h = b.hours as { opensAt?: unknown; closesAt?: unknown } | null;
    if (h === null) {
      put("opens_at", null);
      put("closes_at", null);
    } else if (h && isHhmm(h.opensAt) && isHhmm(h.closesAt)) {
      put("opens_at", h.opensAt);
      put("closes_at", h.closesAt);
    } else return fail("Give an opening and a closing time.");
  }
  if ("radius" in b) {
    if (!isRadius(b.radius)) return fail("Pick 50, 100 or 200 m.");
    put("geo_radius", b.radius);
  }
  if ("here" in b) {
    const fix = parseFix(b.here);
    if (!fix) return fail("Couldn't read this phone's location.");
    // A reading this rough would put the restaurant in the wrong place.
    if (fix.acc > 100) return fail(`This phone's location is too rough right now (within ${Math.round(fix.acc)} m). Turn on Wi-Fi or step near a window, then try again.`);
    put("geo_lat", fix.lat);
    put("geo_lng", fix.lng);
    put("geo_accuracy", Math.round(fix.acc));
    put("geo_set_at", Date.now());
  }
  if (!set.length) return fail("Nothing to save.");
  await db()
    .prepare(`UPDATE businesses SET ${set.join(", ")} WHERE id = ?`)
    .bind(...vals, me.business_id)
    .run();
  return NextResponse.json({ ok: true });
}
