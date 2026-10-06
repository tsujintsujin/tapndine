import { db } from "./cf";

// The manager's Statistics page. Everything comes from what the NFC flow
// records: what guests sent, when, at which table, and what the waiter
// corrected. Money here is "orders sent", not money collected: the cashier's
// own POS is the till.
//
// Days and hours are restaurant time. Manila is UTC+8 with no daylight
// saving, so a fixed offset is exact.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const TZ = 8 * HOUR;
/** A send this long after the table's first one counts as a second round. */
const ROUND_GAP = 15 * 60 * 1000;

export const RANGES = { today: 1, "7d": 7, "30d": 30 } as const;
export type Range = keyof typeof RANGES;
export const isRange = (r: unknown): r is Range => typeof r === "string" && r in RANGES;

/** Restaurant-time day number (days since 1 Jan 1970 in Manila). */
export const dayOf = (ms: number) => Math.floor((ms + TZ) / DAY);
/** 0 = Sunday. Day 0 was a Thursday. */
export const weekdayOf = (day: number) => (day + 4) % 7;

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

type Totals = { total: number; tables: number; phones: number; guestTotal: number };

async function totals(businessId: string, tableId: string | null, from: number, to: number): Promise<Totals> {
  const r = await db()
    .prepare(
      `SELECT COALESCE(SUM(i.price_cents * i.qty), 0) AS total,
              COUNT(DISTINCT b.sitting_id) AS tables,
              COUNT(DISTINCT b.guest_id) AS phones,
              COALESCE(SUM(CASE WHEN b.guest_id IS NOT NULL THEN i.price_cents * i.qty END), 0) AS guestTotal
       FROM batches b
       JOIN batch_items i ON i.batch_id = b.id
       JOIN sittings s ON s.id = b.sitting_id
       WHERE s.business_id = ?1 AND b.sent_at >= ?2 AND b.sent_at < ?3 AND (?4 IS NULL OR s.table_id = ?4)`
    )
    .bind(businessId, from, to, tableId)
    .first<Totals>();
  return r!;
}

/** `tableId`: just that table's orders; null for the whole restaurant. Check it belongs to the business first. */
export async function report(businessId: string, range: Range, tableId: string | null, now = Date.now()) {
  const days = RANGES[range];
  const today = dayOf(now);
  const from = (today - days + 1) * DAY - TZ;
  // The same stretch of time one period back, so "today so far" compares
  // with "yesterday up to the same time".
  const span = days * DAY;
  const d = db();

  const [cur, prev, byDay, byHour, dishes, unordered, sittings, tables, corrections] = await Promise.all([
    totals(businessId, tableId, from, now),
    totals(businessId, tableId, from - span, now - span),
    d
      .prepare(
        `SELECT CAST((b.sent_at + ?4) / ?5 AS INTEGER) AS day, SUM(i.price_cents * i.qty) AS total
         FROM batches b JOIN batch_items i ON i.batch_id = b.id JOIN sittings s ON s.id = b.sitting_id
         WHERE s.business_id = ?1 AND b.sent_at >= ?2 AND b.sent_at < ?3 AND (?6 IS NULL OR s.table_id = ?6)
         GROUP BY day`
      )
      .bind(businessId, from, now, TZ, DAY, tableId)
      .all<{ day: number; total: number }>(),
    // Sends, not lines: one Send to waiter is one order to look at.
    d
      .prepare(
        `SELECT CAST((b.sent_at + ?4) / ?5 AS INTEGER) AS day,
                CAST(((b.sent_at + ?4) % ?5) / ?6 AS INTEGER) AS hour,
                COUNT(*) AS orders
         FROM batches b JOIN sittings s ON s.id = b.sitting_id
         WHERE s.business_id = ?1 AND b.sent_at >= ?2 AND b.sent_at < ?3 AND (?7 IS NULL OR s.table_id = ?7)
         GROUP BY day, hour`
      )
      .bind(businessId, from, now, TZ, DAY, HOUR, tableId)
      .all<{ day: number; hour: number; orders: number }>(),
    d
      .prepare(
        `SELECT i.dish_id AS id, dd.name, SUM(i.qty) AS qty, SUM(i.price_cents * i.qty) AS total,
                dd.featured, dd.best_seller AS bestSeller, dd.image_url AS imageUrl
         FROM batches b JOIN batch_items i ON i.batch_id = b.id JOIN sittings s ON s.id = b.sitting_id
         JOIN dishes dd ON dd.id = i.dish_id
         WHERE s.business_id = ?1 AND b.sent_at >= ?2 AND b.sent_at < ?3 AND (?4 IS NULL OR s.table_id = ?4)
         GROUP BY i.dish_id
         ORDER BY qty DESC, total DESC`
      )
      .bind(businessId, from, now, tableId)
      .all<{ id: string; name: string; qty: number; total: number; featured: number; bestSeller: number; imageUrl: string | null }>(),
    d
      .prepare(
        `SELECT id, name, featured, best_seller AS bestSeller FROM dishes
         WHERE business_id = ?1 AND available = 1 AND removed_at IS NULL AND id NOT IN (
           SELECT i.dish_id FROM batches b JOIN batch_items i ON i.batch_id = b.id JOIN sittings s ON s.id = b.sitting_id
           WHERE s.business_id = ?1 AND b.sent_at >= ?2 AND b.sent_at < ?3 AND (?4 IS NULL OR s.table_id = ?4))
         ORDER BY name`
      )
      .bind(businessId, from, now, tableId)
      .all<{ id: string; name: string; featured: number; bestSeller: number }>(),
    // Tables that tapped but never sent anything are left out: nothing was ordered.
    d
      .prepare(
        `SELECT s.id, s.table_id AS tableId, s.opened_at AS openedAt, s.closed_at AS closedAt,
                MIN(CASE WHEN b.guest_id IS NOT NULL THEN b.sent_at END) AS firstGuestSend,
                MIN(b.sent_at) AS firstSend, MAX(b.sent_at) AS lastSend,
                SUM(i.price_cents * i.qty) AS total
         FROM sittings s JOIN batches b ON b.sitting_id = s.id JOIN batch_items i ON i.batch_id = b.id
         WHERE s.business_id = ?1 AND s.opened_at >= ?2 AND s.opened_at < ?3 AND (?4 IS NULL OR s.table_id = ?4)
         GROUP BY s.id`
      )
      .bind(businessId, from, now, tableId)
      .all<{
        id: string;
        tableId: string;
        openedAt: number;
        closedAt: number | null;
        firstGuestSend: number | null;
        firstSend: number;
        lastSend: number;
        total: number;
      }>(),
    d
      .prepare("SELECT id, label FROM tables WHERE business_id = ?1 AND (?2 IS NULL OR id = ?2) ORDER BY sort, label")
      .bind(businessId, tableId)
      .all<{ id: string; label: string }>(),
    // Guest lines only: a waiter fixing their own addition is not a guest misunderstanding.
    d
      .prepare(
        `SELECT c.item_id AS itemId, c.sitting_id AS sittingId, c.dish_id AS dishId, c.name, c.old_qty AS oldQty, c.new_qty AS newQty
         FROM item_changes c JOIN sittings s ON s.id = c.sitting_id
         WHERE s.business_id = ?1 AND s.opened_at >= ?2 AND s.opened_at < ?3 AND c.from_guest = 1
           AND (?4 IS NULL OR s.table_id = ?4)
         ORDER BY c.changed_at`
      )
      .bind(businessId, from, now, tableId)
      .all<{ itemId: string; sittingId: string; dishId: string; name: string; oldQty: number; newQty: number }>(),
  ]);

  // --- Tables and stays ---
  const rows = sittings.results;
  const stays = rows.filter((s) => s.closedAt !== null).map((s) => s.closedAt! - s.openedAt);
  const tapToSend = rows.filter((s) => s.firstGuestSend !== null).map((s) => s.firstGuestSend! - s.openedAt);
  const reordered = rows.filter((s) => s.lastSend - s.firstSend >= ROUND_GAP).length;

  const perTable = tables.results.map((t) => {
    const mine = rows.filter((s) => s.tableId === t.id);
    const total = mine.reduce((n, s) => n + s.total, 0);
    return {
      id: t.id,
      label: t.label,
      sittings: mine.length,
      total,
      avg: mine.length ? total / mine.length : null,
      medianStay: median(mine.filter((s) => s.closedAt !== null).map((s) => s.closedAt! - s.openedAt)),
    };
  }).sort((a, b) => b.total - a.total);

  // --- Corrections ---
  // Net per line: + then - on the same line is no correction at all.
  const net = new Map<string, { sittingId: string; dishId: string; name: string; first: number; last: number }>();
  for (const c of corrections.results) {
    const e = net.get(c.itemId);
    if (e) e.last = c.newQty;
    else net.set(c.itemId, { sittingId: c.sittingId, dishId: c.dishId, name: c.name, first: c.oldQty, last: c.newQty });
  }
  const real = [...net.values()].filter((e) => e.last !== e.first);
  const byDish = new Map<string, { name: string; removed: number; changed: number; tables: Set<string> }>();
  for (const c of real) {
    const e = byDish.get(c.dishId) ?? { name: c.name, removed: 0, changed: 0, tables: new Set<string>() };
    if (c.last === 0) e.removed++;
    else e.changed++;
    e.tables.add(c.sittingId);
    byDish.set(c.dishId, e);
  }
  const correctedTables = new Set(real.map((c) => c.sittingId)).size;

  // --- Charts ---
  const totalByDay = new Map(byDay.results.map((r) => [r.day, r.total]));
  const dayList = Array.from({ length: days }, (_, i) => today - days + 1 + i);

  return {
    range,
    days,
    /** Restaurant-time day and hour right now, so today counts only the hours it has had. */
    today,
    hourNow: Math.floor(((now + TZ) % DAY) / HOUR),
    current: cur,
    previous: prev,
    byDay: dayList.map((day) => ({ day, total: totalByDay.get(day) ?? 0 })),
    byHour: byHour.results,
    dishes: dishes.results.map((x, i) => ({ ...x, rank: i + 1 })),
    unordered: unordered.results,
    tables: {
      served: rows.length,
      medianStay: median(stays),
      medianTapToSend: median(tapToSend),
      reorderRate: rows.length ? reordered / rows.length : null,
      turnsPerDay: tables.results.length ? rows.length / tables.results.length / days : null,
      perTable,
    },
    corrections: {
      tables: correctedTables,
      rate: rows.length ? correctedTables / rows.length : null,
      dishes: [...byDish.entries()]
        .map(([id, e]) => ({ id, name: e.name, removed: e.removed, changed: e.changed, tables: e.tables.size }))
        .sort((a, b) => b.tables - a.tables || b.removed + b.changed - (a.removed + a.changed))
        .slice(0, 8),
    },
  };
}

/** Every table still in use, for the table picker. */
export async function tableList(businessId: string) {
  const r = await db()
    .prepare("SELECT id, label FROM tables WHERE business_id = ? AND removed_at IS NULL ORDER BY sort, label")
    .bind(businessId)
    .all<{ id: string; label: string }>();
  return r.results;
}

export type Report = Awaited<ReturnType<typeof report>>;
