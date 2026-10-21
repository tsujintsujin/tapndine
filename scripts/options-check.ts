// The dish-option rules (lib/options.ts) on a small known dish.
// Run: node scripts/options-check.ts
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs this .ts file as is, so the import names the .ts file.
import { lineKey, optionsLabel, parseLineKey, resolvePicks, startPicks, togglePick, type DishOption } from "../lib/options.ts";

const o = (id: string, kind: DishOption["kind"], priceCents = 0): DishOption => ({ id, kind, name: id, priceCents });
const options = [o("solo", "size"), o("sharing", "size", 16000), o("egg", "addon", 2000), o("rice", "addon", 4500), o("less", "spice"), o("extra", "spice")];
const sisig = { options, sizeRequired: true, spiceLevel: 3 };
const ids = (p: DishOption[] | null) => p && p.map((x) => x.id);

assert.equal(resolvePicks(sisig, []), null, "required size missing");
assert.deepEqual(ids(resolvePicks(sisig, ["egg", "sharing", "less"])), ["sharing", "egg", "less"], "ordered size, add-ons, spice");
assert.equal(resolvePicks(sisig, ["solo", "sharing"]), null, "two sizes");
assert.equal(resolvePicks(sisig, ["solo", "less", "extra"]), null, "two spice choices");
assert.equal(resolvePicks(sisig, ["solo", "nope"]), null, "unknown id");
assert.deepEqual(ids(resolvePicks({ ...sisig, sizeRequired: false }, [])), ["solo"], "optional size picks the first");
assert.equal(resolvePicks({ ...sisig, spiceLevel: 0 }, ["solo", "less"]), null, "no spice choices on a mild dish");
assert.deepEqual(resolvePicks({ options: [], sizeRequired: true, spiceLevel: null }, []), [], "no options at all");

const picks = resolvePicks(sisig, ["sharing", "egg"])!;
assert.equal(optionsLabel(picks), "sharing · egg");
assert.deepEqual(parseLineKey(lineKey("d_sisig", picks)), { dishId: "d_sisig", optionIds: ["sharing", "egg"] });
assert.deepEqual(parseLineKey("d_adobo"), { dishId: "d_adobo", optionIds: [] });
assert.deepEqual([...startPicks(sisig)], [], "required size starts empty");
assert.deepEqual([...startPicks({ ...sisig, sizeRequired: false })], ["solo"], "optional size starts on the first");
let p = togglePick(sisig, new Set(), options[1]);
p = togglePick(sisig, p, options[0]);
assert.deepEqual([...p], ["solo"], "a second size replaces the first");
assert.deepEqual([...togglePick(sisig, p, options[0])], ["solo"], "tapping the picked size keeps it");
p = togglePick(sisig, togglePick(sisig, p, options[2]), options[3]);
assert.deepEqual([...togglePick(sisig, p, options[2])].sort(), ["rice", "solo"], "add-ons toggle");
p = togglePick(sisig, p, options[4]);
assert.deepEqual([...togglePick(sisig, p, options[4])].includes("less"), false, "spice can be un-picked");
console.log("options-check: all good");
