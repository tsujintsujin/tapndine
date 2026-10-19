/**
 * The yearly plans, in whole pesos. The landing page's Pricing shows these, and
 * a new contract starts from one. A contract keeps its own copy of the name,
 * tables and price, so changing a price here never rewrites a signed contract.
 */
export const PLANS = [
  { name: "Starter", tables: 5, price: 3000 },
  { name: "Small Cafe", tables: 10, price: 5000 },
  { name: "Standard", tables: 15, price: 7100 },
  { name: "High-end", tables: 20, price: 8500 },
];

/** A table beyond the plan's count, added to any plan: ₱35 a month, in whole pesos a year. */
export const EXTRA_TABLE = 420;

/** How a restaurant can pay us; a payment records one. */
export const METHODS = ["GCash", "Maya", "Bank transfer", "Cash", "Other"] as const;
