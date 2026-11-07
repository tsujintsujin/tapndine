/**
 * The yearly plans, in whole pesos. The landing page's Pricing shows these, and
 * a new contract starts from one. A contract keeps its own copy of the name,
 * tables and price, so changing a price here never rewrites a signed contract.
 */
export const PLANS = [
  // Menu only: no tables, so no ordering (tableLimit is 0).
  { name: "Single", tables: 0, price: 3000, includes: ["Online menu", "Full customizable menu", "Manager account"], without: ["No ordering"] },
  { name: "Standard", tables: 10, price: 5000, includes: ["Online menu", "Full customizable menu", "10 tables", "Ordering", "Waiter accounts", "Manager accounts"] },
  { name: "Grand", tables: 20, price: 8500, includes: ["Online menu", "Full customizable menu", "20 tables", "Ordering", "Waiter accounts", "Manager accounts"] },
];


/** A table beyond the plan's count, added to Standard or Grand: ₱35 a month, in whole pesos a year. */
export const EXTRA_TABLE = 420;

/** How a restaurant can pay us; a payment records one. "QR Ph" is a plan bought on the site (lib/checkout.ts). */
export const METHODS = ["QR Ph", "GCash", "Maya", "Bank transfer", "Cash", "Other"] as const;

// ponytail: every plan bought on the site charges this many pesos while
// checkout is being tested. Justin set ₱1 on 2026-11-07, "keep it at 1 peso
// until i say to change". Set to null to charge the plan prices above.
export const CHARGE_PESOS: number | null = 1;

/** What buying a plan on the site charges, in centavos. */
export const chargeCents = (p: { price: number }) => (CHARGE_PESOS ?? p.price) * 100;

/** A plan bought on the site runs a year, plus this free week. */
export const BONUS_DAYS = 7;

export const planByName = (name: unknown) => PLANS.find((p) => p.name === name);
