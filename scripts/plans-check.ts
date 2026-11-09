// Checks the plan arithmetic: term end dates and the yearly discount. Run: node scripts/plans-check.ts
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs this .ts file as is, so the import names the .ts file.
import { addMonths, PLANS, termEnds, yearlyOff, yearlyPerMonth } from "../lib/plans.ts";

assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
assert.equal(addMonths("2028-02-29", 12), "2029-02-28");
assert.equal(termEnds("2026-11-08", "month"), "2026-12-07");
assert.equal(termEnds("2026-01-31", "month"), "2026-02-27");
assert.equal(termEnds("2026-11-08", "year"), "2027-11-14"); // a year plus 7 days, counting the start
const [single, standard, grand] = PLANS;
assert.deepEqual([yearlyPerMonth(single), yearlyPerMonth(standard), yearlyPerMonth(grand)], [249, 399, 549]);
assert.deepEqual([yearlyOff(single), yearlyOff(standard), yearlyOff(grand)], [17, 33, 42]);
console.log("plans-check: all good");
