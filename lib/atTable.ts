// "At the table" (Settings > General): what guests can do from a table's menu,
// and the guards that keep a photographed table QR from ordering from home.
// Pure rules here (scripts/at-table-check.ts runs them); the database read is
// loadAtTable. Decided 2026-11-17, see ROADMAP.md.

export type AtTable = {
  /** Guests send orders to the Tables screen. Off: they show their list to staff. */
  send: boolean;
  call: boolean;
  bill: boolean;
  /** "HH:MM" restaurant time, or null for any time. */
  opensAt: string | null;
  closesAt: string | null;
  /** Null: no location check. */
  geo: { lat: number; lng: number; radius: number } | null;
};

/** What a phone reports: where it is and how sure, in metres. */
export type Fix = { lat: number; lng: number; acc: number };

export type SendCheck = "ok" | "off" | "closed" | "need_location" | "far" | "vague";

export const RADII = [50, 100, 200] as const;
export const isRadius = (v: unknown): v is (typeof RADII)[number] => RADII.includes(v as never);
export const isHhmm = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

const TZ = 8 * 60 * 60 * 1000; // Manila, no daylight saving
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Open at this moment? No hours set: always. Closing before opening runs past midnight. */
export function isOpen(r: Pick<AtTable, "opensAt" | "closesAt">, now = Date.now()): boolean {
  if (!r.opensAt || !r.closesAt) return true;
  const d = new Date(now + TZ);
  const m = d.getUTCHours() * 60 + d.getUTCMinutes();
  const o = minutes(r.opensAt), c = minutes(r.closesAt);
  if (o === c) return true;
  return o < c ? m >= o && m < c : m >= o || m < c;
}

/** Metres between two points (haversine). */
export function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Where the phone may be, given how rough its reading is:
 * - far: even the closest point the reading allows is outside the circle.
 * - ok: inside the circle, giving the reading at most one more circle's width
 *   of benefit (so a ±300 m reading can't pass from 300 m away).
 * - vague: neither. The phone should try again for a better reading.
 */
export function placeCheck(geo: NonNullable<AtTable["geo"]>, fix: Fix): "ok" | "far" | "vague" {
  const d = distance(geo, fix);
  if (d - fix.acc > geo.radius) return "far";
  if (d <= geo.radius + Math.min(fix.acc, geo.radius)) return "ok";
  return "vague";
}

/** May this phone send (an order, or a call) right now? */
export function sendCheck(r: AtTable, fix: Fix | null, now = Date.now()): SendCheck {
  if (!r.send) return "off";
  if (!isOpen(r, now)) return "closed";
  if (!r.geo) return "ok";
  if (!fix) return "need_location";
  return placeCheck(r.geo, fix);
}

/** A fix from a request body, or null if it isn't one. */
export function parseFix(v: unknown): Fix | null {
  const f = v as Fix | null;
  if (!f || typeof f !== "object") return null;
  const ok = (n: unknown, lo: number, hi: number) => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;
  return ok(f.lat, -90, 90) && ok(f.lng, -180, 180) && ok(f.acc, 0, 100000) ? { lat: f.lat, lng: f.lng, acc: f.acc } : null;
}

export type AtTableRow = {
  send_orders: number;
  call_staff: number;
  ask_bill: number;
  opens_at: string | null;
  closes_at: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_radius: number;
};

export const AT_TABLE_COLUMNS = "send_orders, call_staff, ask_bill, opens_at, closes_at, geo_lat, geo_lng, geo_radius";

export function toAtTable(r: AtTableRow): AtTable {
  return {
    send: r.send_orders === 1,
    call: r.call_staff === 1,
    bill: r.ask_bill === 1,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    geo: r.geo_lat !== null && r.geo_lng !== null ? { lat: r.geo_lat, lng: r.geo_lng, radius: r.geo_radius } : null,
  };
}
