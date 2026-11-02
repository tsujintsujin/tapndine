// When the staff screens chime (lib/alerts.ts), on small known tables.
// Run: node scripts/alerts-check.ts
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs this .ts file as is, so the import names the .ts file.
import { seenNow, somethingNew, tablesNeedingYou } from "../lib/alerts.ts";

const t = (id: string, newOrders = 0, calls: string[] = []) => ({ id, newOrders, calls });
const before = seenNow([t("a", 1), t("b", 0, ["bill"]), t("c")]);

assert.equal(somethingNew(before, [t("a", 1), t("b", 0, ["bill"]), t("c")]), false, "nothing changed");
assert.equal(somethingNew(before, [t("a", 2), t("b", 0, ["bill"]), t("c")]), true, "another order at a table");
assert.equal(somethingNew(before, [t("a", 1), t("b", 0, ["bill"]), t("c", 1)]), true, "first order at a table");
assert.equal(somethingNew(before, [t("a", 1), t("b", 0, ["bill", "waiter"]), t("c")]), true, "a guest calls");
assert.equal(somethingNew(before, [t("a"), t("b"), t("c")]), false, "a waiter opened the tables");
assert.equal(somethingNew(before, [t("a"), t("b"), t("c", 1)]), true, "one opened, another arrived");
assert.equal(somethingNew(before, [t("a", 1), t("new", 1)]), true, "an order at a table added since");
assert.equal(tablesNeedingYou([t("a", 2), t("b", 0, ["bill"]), t("c")]), 2, "counts tables, not orders");

console.log("alerts-check: all good");
