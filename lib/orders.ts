import { db } from "./cf";
import { randomId } from "./ids";
import { isVisitId, type Visit } from "./visits";

// Orders as the waiter sees them: a table's open sitting, its guests, and
// each guest's batches. See migrations/0002 for how the tables fit together.

export type Line = { id: string; name: string; priceCents: number; qty: number };
export type Batch = { id: string; sentAt: number; lines: Line[]; subtotal: number };
export type GuestOrders = { number: number; nickname: string | null; batches: Batch[]; subtotal: number };
/** A line a waiter added, with who added it. */
export type Additional = Line & { addedAt: number; addedBy: string | null };

export type Requested = { dishId: string; qty: number }[];

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

/** Prices and names the request against the business's own, available dishes. */
async function price(businessId: string, items: Requested) {
  if (items.length === 0 || items.length > MAX_LINES) return null;
  if (!items.every((i) => typeof i.dishId === "string" && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= MAX_QTY)) {
    return null;
  }
  const r = await db()
    .prepare(
      `SELECT id, name, price_cents FROM dishes
       WHERE business_id = ? AND available = 1 AND removed_at IS NULL AND id IN (SELECT value FROM json_each(?))`
    )
    .bind(businessId, JSON.stringify(items.map((i) => i.dishId)))
    .all<{ id: string; name: string; price_cents: number }>();
  const byId = new Map(r.results.map((d) => [d.id, d]));
  if (!items.every((i) => byId.has(i.dishId))) return null;
  return items.map((i) => ({ ...byId.get(i.dishId)!, qty: i.qty }));
}

function insertBatch(
  batchId: string,
  sittingId: string,
  guestId: string | null,
  staffId: string | null,
  lines: { id: string; name: string; price_cents: number; qty: number }[]
) {
  const d = db();
  return [
    d
      .prepare("INSERT INTO batches (id, sitting_id, guest_id, staff_id, sent_at) VALUES (?, ?, ?, ?, ?)")
      .bind(batchId, sittingId, guestId, staffId, Date.now()),
    ...lines.map((l, i) =>
      d
        .prepare(
          "INSERT INTO batch_items (id, batch_id, dish_id, name, price_cents, qty, sort) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(randomId(), batchId, l.id, l.name, l.price_cents, l.qty, i)
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
  added_by: string | null;
  item_id: string;
  name: string;
  price_cents: number;
  qty: number;
};

async function sittingRows(sittingId: string, phoneId?: string): Promise<BatchRow[]> {
  const r = await db()
    .prepare(
      `SELECT b.id AS batch_id, b.guest_id, g.number AS guest_number, g.nickname, b.sent_at, s.name AS added_by,
              i.id AS item_id, i.name, i.price_cents, i.qty
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
    const line = { id: r.item_id, name: r.name, priceCents: r.price_cents, qty: r.qty };
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
      batch = { id: r.batch_id, sentAt: r.sent_at, lines: [], subtotal: 0 };
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
};

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
              (SELECT MAX(b.sent_at) FROM batches b WHERE b.sitting_id = s.id) AS last_order_at
       FROM tables t
       LEFT JOIN sittings s ON s.table_id = t.id AND s.closed_at IS NULL
       WHERE t.business_id = ? AND t.removed_at IS NULL
       ORDER BY t.sort, t.label`
    )
    .bind(businessId)
    .all<{ id: string; label: string; guests: number; items: number; total_cents: number; last_order_at: number | null }>();
  return r.results.map((t) => ({
    id: t.id,
    label: t.label,
    guests: t.guests,
    items: t.items,
    totalCents: t.total_cents,
    lastOrderAt: t.last_order_at,
  }));
}

export type TableOrders = {
  label: string;
  guests: GuestOrders[];
  additionals: Additional[];
  additionalsSubtotal: number;
  totalCents: number;
};

/** One table's open sitting, for the waiter. Null if the table is not this business's. */
export async function tableOrders(businessId: string, tableId: string): Promise<TableOrders | null> {
  const d = db();
  const [table, sitting] = await d.batch([
    d.prepare("SELECT label FROM tables WHERE id = ? AND business_id = ? AND removed_at IS NULL").bind(tableId, businessId),
    d.prepare("SELECT id FROM sittings WHERE table_id = ? AND closed_at IS NULL").bind(tableId),
  ]);
  const label = (table.results as { label: string }[])[0]?.label;
  if (!label) return null;
  const sittingId = (sitting.results as { id: string }[])[0]?.id;
  const { guests, additionals } = group(sittingId ? await sittingRows(sittingId) : []);
  const additionalsSubtotal = sum(additionals);
  return {
    label,
    guests,
    additionals,
    additionalsSubtotal,
    totalCents: guests.reduce((s, g) => s + g.subtotal, 0) + additionalsSubtotal,
  };
}

/** The waiter adds a dish to the table's Additionals. Opens a sitting if the table has none. */
export async function addAdditional(
  businessId: string,
  tableId: string,
  staffId: string,
  dishId: string,
  qty: number
): Promise<boolean> {
  const d = db();
  const table = await d.prepare("SELECT 1 FROM tables WHERE id = ? AND business_id = ? AND removed_at IS NULL").bind(tableId, businessId).first();
  if (!table) return false;
  const lines = await price(businessId, [{ dishId, qty }]);
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
      `SELECT i.batch_id, i.dish_id, i.name, i.qty, b.sitting_id, b.guest_id IS NOT NULL AS from_guest
       FROM batch_items i
       JOIN batches b ON b.id = i.batch_id
       JOIN sittings s ON s.id = b.sitting_id
       WHERE i.id = ? AND s.business_id = ? AND s.closed_at IS NULL`
    )
    .bind(itemId, businessId)
    .first<{ batch_id: string; dish_id: string; name: string; qty: number; sitting_id: string; from_guest: number }>();
  if (!item) return false;
  if (qty === item.qty) return true;
  const log = d
    .prepare(
      `INSERT INTO item_changes (id, item_id, sitting_id, dish_id, name, old_qty, new_qty, from_guest, staff_id, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(randomId(), itemId, item.sitting_id, item.dish_id, item.name, item.qty, qty, item.from_guest, staffId, Date.now());
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

/** Name and price of every dish, for the waiter's add box. */
export async function dishList(businessId: string) {
  const r = await db()
    .prepare("SELECT id, name, price_cents FROM dishes WHERE business_id = ? AND available = 1 AND removed_at IS NULL ORDER BY name")
    .bind(businessId)
    .all<{ id: string; name: string; price_cents: number }>();
  return r.results.map((x) => ({ id: x.id, name: x.name, priceCents: x.price_cents }));
}
