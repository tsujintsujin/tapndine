/**
 * The yearly plans, in whole pesos. The landing page's Pricing shows these, and
 * a new contract starts from one. A contract keeps its own copy of the name,
 * tables and price, so changing a price here never rewrites a signed contract.
 */
export const PLANS = [
  { name: "Standard Cafe Plan", tables: 10, price: 2100 },
  { name: "Growth Plan", tables: 15, price: 2600 },
  { name: "Growth Plan (Full)", tables: 20, price: 3000 },
];

/** How a restaurant can pay us; a payment records one. */
export const METHODS = ["GCash", "Maya", "Bank transfer", "Cash", "Other"] as const;
