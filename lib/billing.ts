import { db } from "./cf";
import { randomId } from "./ids";
import { METHODS } from "./plans";

// Contracts and payments: what each restaurant signed with tapndine and what
// it has paid. Developers type these in on the Billing pages; the routes and
// pages check for a developer before calling anything here.
//
// Dates are restaurant days, "YYYY-MM-DD", which compare correctly as text.

export type Payment = {
  id: string;
  contractId: string;
  paidOn: string;
  amountCents: number;
  method: string;
  reference: string | null;
  note: string | null;
};

export type Contract = {
  id: string;
  plan: string;
  tables: number;
  priceCents: number;
  signedOn: string;
  startsOn: string;
  endsOn: string;
  note: string | null;
  paidCents: number;
  payments: Payment[];
};

/** Where a restaurant stands, worst first: what a developer has to act on. */
export type Standing =
  | { kind: "due"; owedCents: number }
  | { kind: "expired"; endedOn: string }
  | { kind: "renew"; endsOn: string; days: number }
  | { kind: "none" }
  | { kind: "starts"; startsOn: string }
  | { kind: "paid"; endsOn: string };

/** A contract ending this many days from now or sooner, with no next one signed, needs renewing. */
export const RENEW_DAYS = 30;

const DAY = 86_400_000;
const TZ = 8 * 60 * 60 * 1000; // Manila, no daylight saving
/** Today in the restaurant's time, YYYY-MM-DD. */
export const today = (now = Date.now()) => new Date(now + TZ).toISOString().slice(0, 10);
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/** Where a restaurant stands on day `on`, from its contracts, newest first. */
function standing(contracts: Contract[], on: string): Standing {
  // Money owed on any contract that has already started, this term or an earlier one.
  const owedCents = contracts
    .filter((c) => c.startsOn <= on)
    .reduce((n, c) => n + Math.max(0, c.priceCents - c.paidCents), 0);
  if (owedCents > 0) return { kind: "due", owedCents };
  if (contracts.length === 0) return { kind: "none" };
  const current = contracts.find((c) => c.startsOn <= on && on <= c.endsOn);
  const next = contracts.find((c) => c.startsOn > on);
  if (!current) {
    if (next) return { kind: "starts", startsOn: next.startsOn };
    return { kind: "expired", endedOn: contracts[0].endsOn };
  }
  const left = days(on, current.endsOn);
  if (!next && left <= RENEW_DAYS) return { kind: "renew", endsOn: current.endsOn, days: left };
  // "Paid until" reaches into the next term only once that term is paid too.
  return { kind: "paid", endsOn: next && next.paidCents >= next.priceCents ? next.endsOn : current.endsOn };
}

type ContractRow = {
  id: string;
  business_id: string;
  plan: string;
  tables: number;
  price_cents: number;
  signed_on: string;
  starts_on: string;
  ends_on: string;
  note: string | null;
};
type PaymentRow = {
  id: string;
  contract_id: string;
  paid_on: string;
  amount_cents: number;
  method: string;
  reference: string | null;
  note: string | null;
};

/** Contracts with their payments, newest first, grouped by restaurant. */
async function contractsBy(businessId: string | null): Promise<Map<string, Contract[]>> {
  const d = db();
  const [cs, ps] = await d.batch([
    d
      .prepare(
        `SELECT id, business_id, plan, tables, price_cents, signed_on, starts_on, ends_on, note FROM contracts
         WHERE ?1 IS NULL OR business_id = ?1 ORDER BY starts_on DESC, created_at DESC`
      )
      .bind(businessId),
    d
      .prepare(
        `SELECT p.id, p.contract_id, p.paid_on, p.amount_cents, p.method, p.reference, p.note
         FROM payments p JOIN contracts c ON c.id = p.contract_id
         WHERE ?1 IS NULL OR c.business_id = ?1 ORDER BY p.paid_on DESC, p.created_at DESC`
      )
      .bind(businessId),
  ]);
  const byContract = new Map<string, Payment[]>();
  for (const p of ps.results as PaymentRow[]) {
    const payment: Payment = {
      id: p.id,
      contractId: p.contract_id,
      paidOn: p.paid_on,
      amountCents: p.amount_cents,
      method: p.method,
      reference: p.reference,
      note: p.note,
    };
    byContract.set(p.contract_id, [...(byContract.get(p.contract_id) ?? []), payment]);
  }
  const out = new Map<string, Contract[]>();
  for (const c of cs.results as ContractRow[]) {
    const payments = byContract.get(c.id) ?? [];
    const contract: Contract = {
      id: c.id,
      plan: c.plan,
      tables: c.tables,
      priceCents: c.price_cents,
      signedOn: c.signed_on,
      startsOn: c.starts_on,
      endsOn: c.ends_on,
      note: c.note,
      paidCents: payments.reduce((n, p) => n + p.amountCents, 0),
      payments,
    };
    out.set(c.business_id, [...(out.get(c.business_id) ?? []), contract]);
  }
  return out;
}

export type BillingRow = {
  id: string;
  name: string;
  off: boolean;
  /** Tables in use now, against what the plan covers. */
  tablesUsed: number;
  current: Contract | null;
  standing: Standing;
};

/** Every restaurant's billing, worst standing first, for the Billing page and the restaurant list. */
export async function billingOverview(now = Date.now()) {
  const on = today(now);
  const [biz, contracts] = await Promise.all([
    db()
      .prepare(
        `SELECT b.id, b.name, b.disabled_at IS NOT NULL AS off,
                (SELECT COUNT(*) FROM tables t WHERE t.business_id = b.id AND t.removed_at IS NULL) AS tables_used
         FROM businesses b ORDER BY b.name`
      )
      .all<{ id: string; name: string; off: number; tables_used: number }>(),
    contractsBy(null),
  ]);
  const order: Standing["kind"][] = ["due", "expired", "renew", "none", "starts", "paid"];
  const rows: BillingRow[] = biz.results
    .map((b) => {
      const cs = contracts.get(b.id) ?? [];
      return {
        id: b.id,
        name: b.name,
        off: b.off === 1,
        tablesUsed: b.tables_used,
        current: cs.find((c) => c.startsOn <= on && on <= c.endsOn) ?? null,
        standing: standing(cs, on),
      };
    })
    .sort((a, b) => order.indexOf(a.standing.kind) - order.indexOf(b.standing.kind));

  const all = [...contracts.values()].flat();
  const payments = all.flatMap((c) => c.payments);
  const since = today(now - 30 * DAY);
  const year = on.slice(0, 4);
  return {
    rows,
    collected30: payments.filter((p) => p.paidOn > since && p.paidOn <= on).reduce((n, p) => n + p.amountCents, 0),
    collectedYear: payments.filter((p) => p.paidOn.startsWith(year)).reduce((n, p) => n + p.amountCents, 0),
    owedCents: rows.reduce((n, r) => n + (r.standing.kind === "due" ? r.standing.owedCents : 0), 0),
    renewSoon: rows.filter((r) => r.standing.kind === "renew").length,
  };
}

/** One restaurant's contracts (newest first) with payments, and where it stands. Null if there is no such restaurant. */
export async function restaurantBilling(businessId: string, now = Date.now()) {
  const biz = await db()
    .prepare(
      `SELECT b.id, b.name, b.slug, b.disabled_at IS NOT NULL AS off,
              (SELECT COUNT(*) FROM tables t WHERE t.business_id = b.id AND t.removed_at IS NULL) AS tables_used
       FROM businesses b WHERE b.id = ?`
    )
    .bind(businessId)
    .first<{ id: string; name: string; slug: string; off: number; tables_used: number }>();
  if (!biz) return null;
  const contracts = (await contractsBy(businessId)).get(businessId) ?? [];
  const on = today(now);
  return {
    id: biz.id,
    name: biz.name,
    slug: biz.slug,
    off: biz.off === 1,
    tablesUsed: biz.tables_used,
    today: on,
    contracts,
    current: contracts.find((c) => c.startsOn <= on && on <= c.endsOn) ?? null,
    standing: standing(contracts, on),
  };
}

export type RestaurantBilling = NonNullable<Awaited<ReturnType<typeof restaurantBilling>>>;

// --- Input ---------------------------------------------------------------------

const str = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length <= max ? s : null;
};
/** A real calendar day, YYYY-MM-DD. */
const isDay = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + "T00:00:00Z").toISOString().startsWith(v);
/** Pesos as typed (whole or with centavos) to centavos; NaN if not money. */
const cents = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(/[₱,\s]/g, "")) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export type ContractInput = {
  plan: string;
  tables: number;
  priceCents: number;
  signedOn: string;
  startsOn: string;
  endsOn: string;
  note: string | null;
};

/** Checks a contract from the form. Returns the cleaned contract, or what to fix. */
export function parseContract(b: Record<string, unknown> | null): ContractInput | string {
  if (!b) return "Nothing was sent.";
  const plan = str(b.plan, 60);
  if (!plan) return "Pick or name the plan.";
  const tables = Number(b.tables);
  if (!Number.isInteger(tables) || tables < 1 || tables > 500) return "Tables: a whole number from 1.";
  const priceCents = cents(b.price);
  if (!(priceCents >= 0 && priceCents <= 100_000_000)) return "Enter the price in pesos.";
  if (!isDay(b.signedOn)) return "Pick the day it was signed.";
  if (!isDay(b.startsOn) || !isDay(b.endsOn)) return "Pick the first and last day it covers.";
  if (b.endsOn < b.startsOn) return "The last day comes before the first.";
  const note = str(b.note, 500);
  if (note === null) return "Keep the note under 500 characters.";
  return { plan, tables, priceCents, signedOn: b.signedOn, startsOn: b.startsOn, endsOn: b.endsOn, note: note || null };
}

export type PaymentInput = { paidOn: string; amountCents: number; method: string; reference: string | null; note: string | null };

export function parsePayment(b: Record<string, unknown> | null): PaymentInput | string {
  if (!b) return "Nothing was sent.";
  if (!isDay(b.paidOn)) return "Pick the day it was paid.";
  const amountCents = cents(b.amount);
  if (!(amountCents > 0 && amountCents <= 100_000_000)) return "Enter the amount in pesos.";
  if (typeof b.method !== "string" || !(METHODS as readonly string[]).includes(b.method)) return "Pick how it was paid.";
  const reference = str(b.reference, 80);
  if (reference === null) return "Keep the reference under 80 characters.";
  const note = str(b.note, 300);
  if (note === null) return "Keep the note under 300 characters.";
  return { paidOn: b.paidOn, amountCents, method: b.method, reference: reference || null, note: note || null };
}

// --- Changes -------------------------------------------------------------------

export async function addContract(businessId: string, x: ContractInput): Promise<boolean> {
  const exists = await db().prepare("SELECT 1 FROM businesses WHERE id = ?").bind(businessId).first();
  if (!exists) return false;
  await db()
    .prepare(
      `INSERT INTO contracts (id, business_id, plan, tables, price_cents, signed_on, starts_on, ends_on, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(randomId(), businessId, x.plan, x.tables, x.priceCents, x.signedOn, x.startsOn, x.endsOn, x.note, Date.now())
    .run();
  return true;
}

/** Only a contract with no payments: payments must not lose what they paid for. */
export async function deleteContract(id: string): Promise<"ok" | "missing" | "paid"> {
  const d = db();
  if (await d.prepare("SELECT 1 FROM payments WHERE contract_id = ?").bind(id).first()) return "paid";
  const r = await d.prepare("DELETE FROM contracts WHERE id = ?").bind(id).run();
  return r.meta.changes ? "ok" : "missing";
}

export async function addPayment(contractId: string, x: PaymentInput): Promise<boolean> {
  const exists = await db().prepare("SELECT 1 FROM contracts WHERE id = ?").bind(contractId).first();
  if (!exists) return false;
  await db()
    .prepare(
      `INSERT INTO payments (id, contract_id, paid_on, amount_cents, method, reference, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(randomId(), contractId, x.paidOn, x.amountCents, x.method, x.reference, x.note, Date.now())
    .run();
  return true;
}

export async function deletePayment(id: string): Promise<boolean> {
  const r = await db().prepare("DELETE FROM payments WHERE id = ?").bind(id).run();
  return r.meta.changes > 0;
}
