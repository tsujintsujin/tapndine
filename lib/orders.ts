import { db } from "./cf";
import { randomId } from "./ids";
import { toOption, type OptionRow } from "./menu";
import { extraCents, optionsLabel, resolvePicks, type DishOption } from "./options";
import { isVisitId, type Visit } from "./visits";

// Orders as the waiter sees them: a table's open sitting, its guests, and
// each guest's batches. See migrations/0002 for how the tables fit together.

/**
 * options: what was picked ("Sharing · Extra egg"), already in the price; null if none.
 * note: what the guest typed for this line ("no egg"); null if nothing.
 */
export type Line = { id: string; name: string; priceCents: number; qty: number; options: string | null; note: string | null };
/** seenAt: when a waiter first opened the table after it came in; null = not yet. */
export type Batch = { id: string; sentAt: number; seenAt: number | null; lines: Line[]; subtotal: number };
export type GuestOrders = { number: number; nickname: string | null; batches: Batch[]; subtotal: number };
/** A line a waiter added, with who added it. */
export type Additional = Line & { addedAt: number; addedBy: string | null };

/** options: the picked option ids (lib/options.ts). */
export type Requested = { dishId: string; qty: number; note?: unknown; options?: unknown }[];

export const MAX_NOTE = 100;

/** A guest's note on a line: single-spaced, no control characters, at most MAX_NOTE; empty becomes null. */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_NOTE).trim();
  return s || null;
}

const MAX_QTY = 50;
export const MAX_NICKNAME = 24;

/** Trimmed, single-spaced, no control characters, at most MAX_NICKNAME; empty becomes null. */
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NICKNAME).trim();
  return s || null;
}
const MAX_LINES = 60;

const sum = (lines: { priceCents: number; qty: number }[]) => lines.reduce((s, l) => s + l.priceCents * l.qty, 0);

const MAX_PICKS = 30;

type Priced = { id: string; name: string; price_cents: number; qty: number; options: string | null; note: string | null };

/**
 * Prices and names the request against the business's own, available dishes,
 * with each line's picks checked against that dish's options. Null if any
 * line is not orderable as asked.
 */
async function price(businessId: string, items: Requested): Promise<Priced[] | null> {
  if (items.length === 0 || items.length > MAX_LINES) return null;
  const pickIds = (o: unknown) => (o === undefined ? [] : o);
  if (
    !items.every(
      (i) =>
        typeof i.dishId === "string" &&
        Number.isInteger(i.qty) &&
        i.qty >= 1 &&
        i.qty <= MAX_QTY &&
        Array.isArray(pickIds(i.options)) &&
        (pickIds(i.options) as unknown[]).length <= MAX_PICKS &&
        (pickIds(i.options) as unknown[]).every((x) => typeof x === "string")
    )
  ) {
    return null;
  }
  const d = db();
  const ids = JSON.stringify(items.map((i) => i.dishId));
  const [dishes, options] = await d.batch([
    d
      .prepare(
        `SELECT id, name, price_cents, spice_level, size_required FROM dishes
         WHERE business_id = ? AND available = 1 AND removed_at IS NULL AND id IN (SELECT value FROM json_each(?))`
      )
      .bind(businessId, ids),
    d
      .prepare(
        `SELECT id, dish_id, kind, name, price_cents FROM dish_options
         WHERE dish_id IN (SELECT value FROM json_each(?)) ORDER BY sort`
      )
      .bind(ids),
  ]);
  type Row = { id: string; name: string; price_cents: number; spice_level: number | null; size_required: number };
  const byId = new Map((dishes.results as Row[]).map((x) => [x.id, { ...x, options: [] as DishOption[] }]));
  for (const o of options.results as OptionRow[]) byId.get(o.dish_id)?.options.push(toOption(o));
  const out: Priced[] = [];
  for (const i of items) {
    const dish = byId.get(i.dishId);
    if (!dish) return null;
    const picks = resolvePicks(
      { options: dish.options, sizeRequired: dish.size_required === 1, spiceLevel: dish.spice_level },
      pickIds(i.options) as string[]
    );
    if (!picks) return null;
    out.push({
      id: dish.id,
      name: dish.name,
      price_cents: dish.price_cents + extraCents(picks),
      qty: i.qty,
      options: optionsLabel(picks),
      note: cleanNote(i.note),
    });
  }
  return out;
}

function insertBatch(
  batchId: string,
  sittingId: string,
  guestId: string | null,
  staffId: string | null,
  lines: Priced[]
) {
  const d = db();
  const now = Date.now();
  return [
    // A waiter's own addition is seen by definition; a guest's waits for a waiter.
    d
      .prepare("INSERT INTO batches (id, sitting_id, guest_id, staff_id, sent_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(batchId, sittingId, guestId, staffId, now, staffId ? now : null),
    ...lines.map((l, i) =>
      d
        .prepare(
          "INSERT INTO batch_items (id, batch_id, dish_id, name, price_cents, qty, options, note, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(randomId(), batchId, l.id, l.name, l.price_cents, l.qty, l.options, l.note, i)
    ),
  ];
}

// --- Customer ----------------------------------------------------------------

/**
 * Send to waiter: the phone's list becomes one batch. The phone becomes the
 * next Guest # on its first send. `key` is made by the phone once per send
 * and becomes the batch id, so a double tap or a retry cannot send it twice.
 */
export async function sendOrder(
  visit: Visit,
  key: string,
  items: Requested,
  nickname: string | null
): Promise<"ok" | "invalid" | "closed"> {
  if (!visit.sitting_id || !visit.phone_id || !isVisitId(key)) return "invalid";
  const d = db();
  /** Already sent? Only this phone's own key counts. */
  const alreadySent = async () => {
    const b = await d
      .prepare("SELECT g.phone_id FROM batches b LEFT JOIN guests g ON g.id = b.guest_id WHERE b.id = ?")
      .bind(key)
      .first<{ phone_id: string | null }>();
    return b ? (b.phone_id === visit.phone_id ? "ok" : "invalid") : null;
  };
  const before = await alreadySent();
  if (before) return before;
  const open = await d
    .prepare("SELECT 1 FROM sittings WHERE id = ? AND closed_at IS NULL")
    .bind(visit.sitting_id)
    .first();
  if (!open) return "closed";
  const lines = await price(visit.business_id, items);
  if (!lines) return "invalid";

  // One statement picks the number, so two phones sending at once still get
  // different numbers. The nickname follows the latest send, so a rename shows.
  const [, , guest] = await d.batch([
    d
      .prepare(
        `INSERT OR IGNORE INTO guests (id, sitting_id, phone_id, number, created_at)
         SELECT ?1, ?2, ?3, COALESCE(MAX(number), 0) + 1, ?4 FROM guests WHERE sitting_id = ?2`
      )
      .bind(randomId(), visit.sitting_id, visit.phone_id, Date.now()),
    d
      .prepare("UPDATE guests SET nickname = ? WHERE sitting_id = ? AND phone_id = ?")
      .bind(nickname, visit.sitting_id, visit.phone_id),
    d.prepare("SELECT id FROM guests WHERE sitting_id = ? AND phone_id = ?").bind(visit.sitting_id, visit.phone_id),
  ]);
  const guestId = (guest.results as { id: string }[])[0].id;
  try {
    await d.batch(insertBatch(key, visit.sitting_id, guestId, null, lines));
  } catch (e) {
    // The same key arriving twice at once: the first one already went in.
    const after = await alreadySent();
    if (after) return after;
    throw e;
  }
  return "ok";
}

type BatchRow = {
  batch_id: string;
  guest_id: string | null;
  guest_number: number | null;
  nickname: string | null;
  sent_at: number;
  seen_at: number | null;
  added_by: string | null;
  item_id: string;
  name: string;
  price_cents: number;
  qty: number;
  options: string | null;
  note: string | null;
};

async function sittingRows(sittingId: string, phoneId?: string): Promise<BatchRow[]> {
  const r = await db()
    .prepare(
      `SELECT b.id AS batch_id, b.guest_id, g.number AS guest_number, g.nickname, b.sent_at, b.seen_at, s.name AS added_by,
              i.id AS item_id, i.name, i.price_cents, i.qty, i.options, i.note
       FROM batches b
       JOIN batch_items i ON i.batch_id = b.id
       LEFT JOIN guests g ON g.id = b.guest_id
       LEFT JOIN staff s ON s.id = b.staff_id
       WHERE b.sitting_id = ?1 AND (?2 IS NULL OR g.phone_id = ?2)
       ORDER BY b.sent_at, b.id, i.sort`
    )
    .bind(sittingId, phoneId ?? null)
    .all<BatchRow>();
  return r.results;
}

/** Rows into guests (in Guest # order) with their batches, plus the waiter's additions. */
function group(rows: BatchRow[]) {
  const guests = new Map<string, GuestOrders>();
  const batches = new Map<string, Batch>();
  const additionals: Additional[] = [];
  for (const r of rows) {
    const line = { id: r.item_id, name: r.name, priceCents: r.price_cents, qty: r.qty, options: r.options, note: r.note };
    if (!r.guest_id) {
      additionals.push({ ...line, addedAt: r.sent_at, addedBy: r.added_by });
      continue;
    }
    let guest = guests.get(r.guest_id);
    if (!guest) {
      guest = { number: r.guest_number!, nickname: r.nickname, batches: [], subtotal: 0 };
      guests.set(r.guest_id, guest);
    }
    let batch = batches.get(r.batch_id);
    if (!batch) {
      batch = { id: r.batch_id, sentAt: r.sent_at, seenAt: r.seen_at, lines: [], subtotal: 0 };
      batches.set(r.batch_id, batch);
      guest.batches.push(batch);
    }
    batch.lines.push(line);
    batch.subtotal += r.price_cents * r.qty;
    guest.subtotal += r.price_cents * r.qty;
  }
  return {
    guests: [...guests.values()].sort((a, b) => a.number - b.number),
    additionals,
  };
}

/** What this phone has sent so far in its sitting. */
export async function guestOrders(visit: Visit): Promise<GuestOrders | null> {
  if (!visit.sitting_id || !visit.phone_id) return null;
  const { guests } = group(await sittingRows(visit.sitting_id, visit.phone_id));
  return guests[0] ?? null;
}

// --- Waiter ------------------------------------------------------------------

export type TableSummary = {
  id: string;
  label: string;
  guests: number;
  items: number;
  totalCents: number;
  lastOrderAt: number | null;
  /** Guest batches no waiter has opened the table for yet. */
  newOrders: number;
  /** Open guest calls, oldest first. */
  calls: CallKind[];
};

export type CallKind = "waiter" | "bill";
export const isCallKind = (v: unknown): v is CallKind => v === "waiter" || v === "bill";

/** Every table, with what its open sitting has ordered so far. */
export async function tablesOverview(businessId: string): Promise<TableSummary[]> {
  const r = await db()
    .prepare(
      `SELECT t.id, t.label,
              (SELECT COUNT(*) FROM guests g WHERE g.sitting_id = s.id) AS guests,
              COALESCE((SELECT SUM(i.qty) FROM batch_items i JOIN batches b ON b.id = i.batch_id
                        WHERE b.sitting_id = s.id), 0) AS items,
              COALESCE((SELECT SUM(i.qty * i.price_cents) FROM batch_items i JOIN batches b ON b.id = i.batch_id
                        WHERE b.sitting_id = s.id), 0) AS total_cents,
              (SELECT MAX(b.sent_at) FROM batches b WHERE b.sitting_id = s.id) AS last_order_at,
              (SELECT COUNT(*) FROM batches b WHERE b.sitting_id = s.id AND b.seen_at IS NULL) AS new_orders,
              (SELECT group_concat(kind) FROM (SELECT c.kind FROM calls c
                 WHERE c.sitting_id = s.id AND c.seen_at IS NULL ORDER BY c.created_at)) AS calls
       FROM tables t
       LEFT JOIN sittings s ON s.table_id = t.id AND s.closed_at IS NULL
       WHERE t.business_id = ? AND t.removed_at IS NULL
       ORDER BY t.sort, t.label`
    )
    .bind(businessId)
    .all<{
      id: string;
      label: string;
      guests: number;
      items: number;
      total_cents: number;
      last_order_at: number | null;
      new_orders: number;
      calls: string | null;
    }>();
  return r.results.map((t) => ({
    id: t.id,
    label: t.label,
    guests: t.guests,
    items: t.items,
    totalCents: t.total_cents,
    lastOrderAt: t.last_order_at,
    newOrders: t.new_orders,
    calls: (t.calls ? t.calls.split(",") : []).filter(isCallKind),
  }));
}

/** A guest's call as the waiter sees it: what, who, when. */
export type Call = { id: string; kind: CallKind; name: string | null; createdAt: number };

export type TableOrders = {
  label: string;
  guests: GuestOrders[];
  additionals: Additional[];
  additionalsSubtotal: number;
  totalCents: number;
  /** Calls that were open when the waiter opened the table (opening clears them). */
  calls: Call[];
};

/**
 * One table's open sitting, for the waiter. Null if the table is not this
 * business's. A waiter opening the table counts as seeing it: every new
 * batch and open call is marked seen, which clears "New" on the Tables
 * screen and tells the guest their waiter has it. What was new comes back
 * with seenAt null and in `calls`, so the screen can point at it.
 */
export async function tableOrders(businessId: string, tableId: string): Promise<TableOrders | null> {
  const d = db();
  const [table, sitting] = await d.batch([
    d.prepare("SELECT label FROM tables WHERE id = ? AND business_id = ? AND removed_at IS NULL").bind(tableId, businessId),
    d.prepare("SELECT id FROM sittings WHERE table_id = ? AND closed_at IS NULL").bind(tableId),
  ]);
  const label = (table.results as { label: string }[])[0]?.label;
  if (!label) return null;
  const sittingId = (sitting.results as { id: string }[])[0]?.id;
  let calls: Call[] = [];
  let rows: BatchRow[] = [];
  if (sittingId) {
    const now = Date.now();
    const [open] = await d.batch([
      d
        .prepare("SELECT id, kind, name, created_at FROM calls WHERE sitting_id = ? AND seen_at IS NULL ORDER BY created_at")
        .bind(sittingId),
      d.prepare("UPDATE calls SET seen_at = ? WHERE sitting_id = ? AND seen_at IS NULL").bind(now, sittingId),
    ]);
    calls = (open.results as { id: string; kind: CallKind; name: string | null; created_at: number }[]).map((c) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      createdAt: c.created_at,
    }));
    rows = await sittingRows(sittingId);
    if (rows.some((r) => r.seen_at === null)) {
      await d.prepare("UPDATE batches SET seen_at = ? WHERE sitting_id = ? AND seen_at IS NULL").bind(now, sittingId).run();
    }
  }
  const { guests, additionals } = group(rows);
  const additionalsSubtotal = sum(additionals);
  return {
    label,
    guests,
    additionals,
    additionalsSubtotal,
    totalCents: guests.reduce((s, g) => s + g.subtotal, 0) + additionalsSubtotal,
    calls,
  };
}

// --- Guest calls -------------------------------------------------------------

/**
 * "Call waiter" or "Bill, please" from a guest's phone. Asking again while
 * the same kind is still open does nothing, so a tap-happy guest cannot
 * flood the waiter. Menus not at a table (no sitting) cannot call.
 */
export async function callWaiter(visit: Visit, kind: CallKind, nickname: string | null): Promise<boolean> {
  if (!visit.sitting_id || !visit.phone_id) return false;
  const d = db();
  const guest = await d
    .prepare("SELECT number, nickname FROM guests WHERE sitting_id = ? AND phone_id = ?")
    .bind(visit.sitting_id, visit.phone_id)
    .first<{ number: number; nickname: string | null }>();
  const name = nickname ?? guest?.nickname ?? (guest ? `Guest ${guest.number}` : null);
  await d
    .prepare(
      `INSERT INTO calls (id, sitting_id, kind, name, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5
       WHERE NOT EXISTS (SELECT 1 FROM calls WHERE sitting_id = ?2 AND kind = ?3 AND seen_at IS NULL)`
    )
    .bind(randomId(), visit.sitting_id, kind, name, Date.now())
    .run();
  return true;
}

/** The table's open calls, for the guest's buttons: which kinds are waiting, and since when. */
export async function openCalls(visit: Visit): Promise<{ kind: CallKind; createdAt: number }[]> {
  if (!visit.sitting_id) return [];
  const r = await db()
    .prepare("SELECT kind, created_at FROM calls WHERE sitting_id = ? AND seen_at IS NULL ORDER BY created_at")
    .bind(visit.sitting_id)
    .all<{ kind: CallKind; created_at: number }>();
  return r.results.map((c) => ({ kind: c.kind, createdAt: c.created_at }));
}

/** One Send to waiter, or one waiter addition, in a past sitting. */
export type LogEntry = { id: string; sentAt: number; by: string; lines: Line[] };
export type PastSitting = { id: string; openedAt: number; closedAt: number; totalCents: number; items: number; guests: number; log: LogEntry[] };

const HISTORY_LIMIT = 60;

/** A table's cleared sittings, newest first, each with its orders in the order they came in. */
export async function tableHistory(
  businessId: string,
  tableId: string
): Promise<{ label: string; sittings: PastSitting[] } | null> {
  const d = db();
  const table = await d
    .prepare("SELECT label FROM tables WHERE id = ? AND business_id = ?")
    .bind(tableId, businessId)
    .first<{ label: string }>();
  if (!table) return null;
  // ponytail: last 60 sittings only; page by closed_at if a table ever needs more.
  const r = await d
    .prepare(
      `WITH past AS (
         SELECT id, opened_at, closed_at FROM sittings
         WHERE table_id = ?1 AND business_id = ?2 AND closed_at IS NOT NULL
           AND EXISTS (SELECT 1 FROM batches b WHERE b.sitting_id = sittings.id)
         ORDER BY closed_at DESC LIMIT ?3)
       SELECT p.id AS sitting_id, p.opened_at, p.closed_at, b.id AS batch_id, b.guest_id, g.number AS guest_number,
              g.nickname, b.sent_at, b.seen_at, s.name AS added_by, i.id AS item_id, i.name, i.price_cents, i.qty, i.options, i.note
       FROM past p
       JOIN batches b ON b.sitting_id = p.id
       JOIN batch_items i ON i.batch_id = b.id
       LEFT JOIN guests g ON g.id = b.guest_id
       LEFT JOIN staff s ON s.id = b.staff_id
       ORDER BY p.closed_at DESC, b.sent_at, b.id, i.sort`
    )
    .bind(tableId, businessId, HISTORY_LIMIT)
    .all<BatchRow & { sitting_id: string; opened_at: number; closed_at: number }>();

  const sittings = new Map<string, PastSitting & { guestIds: Set<string> }>();
  const entries = new Map<string, LogEntry>();
  for (const row of r.results) {
    let s = sittings.get(row.sitting_id);
    if (!s) {
      s = { id: row.sitting_id, openedAt: row.opened_at, closedAt: row.closed_at, totalCents: 0, items: 0, guests: 0, log: [], guestIds: new Set() };
      sittings.set(row.sitting_id, s);
    }
    let e = entries.get(row.batch_id);
    if (!e) {
      const by = row.guest_id
        ? row.nickname
          ? `${row.nickname} (Guest ${row.guest_number})`
          : `Guest ${row.guest_number}`
        : `Added by ${row.added_by ?? "staff"}`;
      e = { id: row.batch_id, sentAt: row.sent_at, by, lines: [] };
      entries.set(row.batch_id, e);
      s.log.push(e);
    }
    e.lines.push({ id: row.item_id, name: row.name, priceCents: row.price_cents, qty: row.qty, options: row.options, note: row.note });
    s.totalCents += row.price_cents * row.qty;
    s.items += row.qty;
    if (row.guest_id) s.guestIds.add(row.guest_id);
  }
  return {
    label: table.label,
    sittings: [...sittings.values()].map(({ guestIds, ...s }) => ({ ...s, guests: guestIds.size })),
  };
}

/** The waiter adds a dish to the table's Additionals. Opens a sitting if the table has none. */
export async function addAdditional(
  businessId: string,
  tableId: string,
  staffId: string,
  dishId: string,
  qty: number,
  options: unknown
): Promise<boolean> {
  const d = db();
  const table = await d.prepare("SELECT 1 FROM tables WHERE id = ? AND business_id = ? AND removed_at IS NULL").bind(tableId, businessId).first();
  if (!table) return false;
  const lines = await price(businessId, [{ dishId, qty, options }]);
  if (!lines) return false;
  const [, found] = await d.batch([
    d
      .prepare("INSERT OR IGNORE INTO sittings (id, business_id, table_id, opened_at) VALUES (?, ?, ?, ?)")
      .bind(randomId(), businessId, tableId, Date.now()),
    d.prepare("SELECT id FROM sittings WHERE table_id = ? AND closed_at IS NULL").bind(tableId),
  ]);
  const sittingId = (found.results as { id: string }[])[0].id;
  await d.batch(insertBatch(randomId(), sittingId, null, staffId, lines));
  return true;
}

/**
 * The waiter changes how many of a line there are; 0 removes it. Open sittings
 * only. Each change is logged in item_changes, since the line is overwritten.
 */
export async function setLineQty(businessId: string, staffId: string, itemId: string, qty: number): Promise<boolean> {
  if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return false;
  const d = db();
  const item = await d
    .prepare(
      `SELECT i.batch_id, i.dish_id, i.name, i.options, i.qty, b.sitting_id, b.guest_id IS NOT NULL AS from_guest
       FROM batch_items i
       JOIN batches b ON b.id = i.batch_id
       JOIN sittings s ON s.id = b.sitting_id
       WHERE i.id = ? AND s.business_id = ? AND s.closed_at IS NULL`
    )
    .bind(itemId, businessId)
    .first<{ batch_id: string; dish_id: string; name: string; options: string | null; qty: number; sitting_id: string; from_guest: number }>();
  if (!item) return false;
  if (qty === item.qty) return true;
  const log = d
    .prepare(
      `INSERT INTO item_changes (id, item_id, sitting_id, dish_id, name, old_qty, new_qty, from_guest, staff_id, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    // The name as the waiter saw it, picks included, so two ways of one dish stay apart in Stats.
    .bind(
      randomId(),
      itemId,
      item.sitting_id,
      item.dish_id,
      item.options ? `${item.name} (${item.options})` : item.name,
      item.qty,
      qty,
      item.from_guest,
      staffId,
      Date.now()
    );
  if (qty > 0) {
    await d.batch([d.prepare("UPDATE batch_items SET qty = ? WHERE id = ?").bind(qty, itemId), log]);
  } else {
    // A batch with nothing left in it would show as an empty heading.
    await d.batch([
      d.prepare("DELETE FROM batch_items WHERE id = ?").bind(itemId),
      d
        .prepare("DELETE FROM batches WHERE id = ? AND NOT EXISTS (SELECT 1 FROM batch_items WHERE batch_id = ?)")
        .bind(item.batch_id, item.batch_id),
      log,
    ]);
  }
  return true;
}

/**
 * Clear table (paid): closes the sitting and kills its menu links, so the
 * next group to tap starts fresh as Guest 1.
 */
export async function clearTable(businessId: string, tableId: string): Promise<boolean> {
  const d = db();
  const now = Date.now();
  const closed = await d
    .prepare(
      `UPDATE sittings SET closed_at = ? WHERE table_id = ? AND business_id = ? AND closed_at IS NULL RETURNING id`
    )
    .bind(now, tableId, businessId)
    .first<{ id: string }>();
  if (!closed) return false;
  await d.prepare("UPDATE visits SET expires_at = ? WHERE sitting_id = ?").bind(now, closed.id).run();
  return true;
}

/** A dish in the waiter's add box. */
export type WaiterDish = Awaited<ReturnType<typeof dishList>>[number];

/** Every orderable dish with its options, for the waiter's add box. */
export async function dishList(businessId: string) {
  const d = db();
  const [dishes, options] = await d.batch([
    d
      .prepare(
        `SELECT id, name, price_cents, spice_level, size_required FROM dishes
         WHERE business_id = ? AND available = 1 AND removed_at IS NULL ORDER BY name`
      )
      .bind(businessId),
    d
      .prepare(
        `SELECT o.id, o.dish_id, o.kind, o.name, o.price_cents FROM dish_options o
         JOIN dishes x ON x.id = o.dish_id WHERE x.business_id = ? ORDER BY o.sort`
      )
      .bind(businessId),
  ]);
  type Row = { id: string; name: string; price_cents: number; spice_level: number | null; size_required: number };
  const list = (dishes.results as Row[]).map((x) => ({
    id: x.id,
    name: x.name,
    priceCents: x.price_cents,
    spiceLevel: x.spice_level,
    sizeRequired: x.size_required === 1,
    options: [] as DishOption[],
  }));
  const byId = new Map(list.map((x) => [x.id, x]));
  for (const o of options.results as OptionRow[]) byId.get(o.dish_id)?.options.push(toOption(o));
  return list;
}
