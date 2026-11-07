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

/** Shown after the plans: no fixed price, the restaurant contacts us. */
export const ENTERPRISE = {
  name: "Enterprise",
  includes: ["Online menu", "Full customizable menu", "Unlimited tables", "Ordering", "Waiter accounts", "Manager accounts", "Priority support"],
};

/** A table beyond the plan's count, added to Standard or Grand: ₱35 a month, in whole pesos a year. */
export const EXTRA_TABLE = 420;

/** How a restaurant can pay us; a payment records one. */
export const METHODS = ["GCash", "Maya", "Bank transfer", "Cash", "Other"] as const;
