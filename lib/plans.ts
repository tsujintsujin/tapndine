/**
 * The plans, in whole pesos: `price` a year, `monthly` a month. Paying yearly
 * is the discount (Hostinger style: the per-month price of a year is the big
 * number, the monthly price struck through). Set by Justin 2026-11-08.
 * The landing page's Pricing shows these, and a new contract starts from one.
 * A contract keeps its own copy of the name, tables and price, so changing a
 * price here never rewrites a signed contract.
 */
export const PLANS = [
  // Menu only: no tables, so no ordering (tableLimit is 0).
  { name: "Single", tables: 0, price: 2988, monthly: 299, blurb: "Your menu online", includes: ["Online menu", "Full customizable menu", "Manager account"], without: ["No ordering"] },
  { name: "Standard", tables: 10, price: 4788, monthly: 599, blurb: "Ordering for 10 tables", includes: ["Online menu", "Full customizable menu", "10 tables", "Ordering", "Staff accounts", "Manager accounts"] },
  { name: "Grand", tables: 20, price: 6588, monthly: 949, blurb: "Ordering for 20 tables", includes: ["Online menu", "Full customizable menu", "20 tables", "Ordering", "Staff accounts", "Manager accounts"] },
];

export type Plan = (typeof PLANS)[number];

/** The plan most restaurants pick: drawn as the highlighted one. */
export const POPULAR = "Standard";

/** A table beyond the plan's count, added to Standard or Grand: ₱35 a month, in whole pesos a year. */
export const EXTRA_TABLE = 420;

/** How a restaurant can pay us; a payment records one. "QR Ph" is a plan bought on the site (lib/checkout.ts). */
export const METHODS = ["QR Ph", "GCash", "Maya", "Bank transfer", "Cash", "Other"] as const;

/** How long a plan bought on the site runs: a year (plus BONUS_DAYS) or a month. Each new one is bought again. */
export type Term = "year" | "month";
export const isTerm = (v: unknown): v is Term => v === "year" || v === "month";

// A test price: every plan bought on the site charges this many pesos instead
// of its own. null charges the plan prices above (real prices since 2026-11-07,
// after Justin's ₱1 test: "the qr works. now move to proper amount").
export const CHARGE_PESOS: number | null = null;

/** The plan's own price for a term, in whole pesos. */
export const termPrice = (p: Plan, term: Term) => (term === "year" ? p.price : p.monthly);

/** What buying a plan on the site charges, in centavos. */
export const chargeCents = (p: Plan, term: Term = "year") => (CHARGE_PESOS ?? termPrice(p, term)) * 100;

/** A year bought on the site runs these extra days free. A month has none. */
export const BONUS_DAYS = 7;

/** A year's price per month, rounded down to the peso: the big number on a yearly card. */
export const yearlyPerMonth = (p: Plan) => Math.floor(p.price / 12);

/** How much cheaper a year is than 12 months, in whole percent. */
export const yearlyOff = (p: Plan) => Math.round((1 - p.price / (p.monthly * 12)) * 100);

/** Days a plan keeps working after its last paid day, before the restaurant closes. */
export const GRACE_DAYS = 3;

// Restaurant days, YYYY-MM-DD.
const DAY = 86_400_000;
const TZ = 8 * 60 * 60 * 1000; // Manila, no daylight saving
/** Today in the restaurant's time, YYYY-MM-DD. */
export const today = (now = Date.now()) => new Date(now + TZ).toISOString().slice(0, 10);
/** A day n days on, YYYY-MM-DD. */
export const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);
/** The same day n months on; a day the month doesn't have becomes its last (31 Jan + 1 month: 28 Feb). */
export const addMonths = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
};
/** The last day a term starting on `starts` covers: a year plus BONUS_DAYS, or a month. */
export const termEnds = (starts: string, term: Term) =>
  term === "year" ? addDays(addMonths(starts, 12), BONUS_DAYS - 1) : addDays(addMonths(starts, 1), -1);

/** Whole days from day `a` to day `b` (negative when b is earlier). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/**
 * How close a restaurant's free trial or paid plan is to ending, for the
 * Subscription link's dot and the pop-up on opening the app.
 * left: whole days left counting today (1 on the last day; 0 or less once it
 * ended). closesIn: for a plan that ended, the grace days left counting today.
 * level: "soon" at 7 days or fewer, "urgent" at 3 or fewer and through the grace days.
 */
export type Due = { kind: "trial" | "plan"; left: number; closesIn: number; level: "soon" | "urgent" | null; endsOn: string | null };

export function due(trialEndsAt: number | null, paidUntil: string | null, now = Date.now()): Due | null {
  let kind: Due["kind"], left: number;
  if (trialEndsAt !== null) {
    kind = "trial";
    left = Math.max(0, Math.ceil((trialEndsAt - now) / DAY));
  } else if (paidUntil !== null) {
    kind = "plan";
    left = daysBetween(today(now), paidUntil) + 1;
  } else return null;
  const closesIn = kind === "plan" && left <= 0 ? Math.max(0, GRACE_DAYS + left) : 0;
  const level = left <= 3 ? "urgent" : left <= 7 ? "soon" : null;
  return { kind, left, closesIn, level, endsOn: kind === "plan" ? paidUntil : null };
}

export const planByName = (name: unknown) => PLANS.find((p) => p.name === name);
