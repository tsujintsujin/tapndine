// The dish-option rules (lib/options.ts) on a small known dish.
// Run: node scripts/options-check.ts
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs this .ts file as is, so the import names the .ts file.
import { lineKey, missingPick, mustPick, optionsLabel, parseLineKey, resolvePicks, sizeTitle, startPicks, togglePick, type DishOption } from "../lib/options.ts";

const o = (id: string, kind: DishOption["kind"], priceCents = 0, group: string | null = null): DishOption => ({ id, kind, group, name: id, priceCents });
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
// Set meals: one pick from each choose-one list, always required.
const meal = {
  options: [o("tea", "choice", 0, "Drink"), o("coke", "choice", 0, "Drink"), o("shake", "choice", 3000, "Drink"), o("plain", "choice", 0, "Side"), o("garlic", "choice", 1500, "Side")],
  sizeRequired: false,
  spiceLevel: 0,
};
assert.equal(mustPick(meal), true, "a set meal opens the sheet");
assert.equal(resolvePicks(meal, ["tea"]), null, "a list left unpicked");
assert.equal(resolvePicks(meal, ["tea", "coke", "plain"]), null, "two from one list");
assert.deepEqual(ids(resolvePicks(meal, ["garlic", "shake"])), ["shake", "garlic"], "one from each list, in list order");
assert.equal(optionsLabel(resolvePicks(meal, ["coke", "plain"])!), "Drink: coke · Side: plain");
assert.equal(missingPick(meal, new Set()), "drink");
assert.equal(missingPick(meal, new Set(["coke"])), "side");
assert.equal(missingPick(meal, new Set(["coke", "plain"])), null);
let m = togglePick(meal, new Set(), meal.options[0]);
m = togglePick(meal, m, meal.options[3]);
m = togglePick(meal, m, meal.options[1]);
assert.deepEqual([...m].sort(), ["coke", "plain"], "picking in one list leaves the other list alone");
assert.deepEqual([...startPicks({ ...meal, options: [o("reg", "size"), ...meal.options] })], ["reg"], "an optional size still starts picked");
// Sizes the manager called something else ("Meat") are asked for by that name.
assert.equal(missingPick(sisig, new Set()), "size");
assert.equal(missingPick({ ...sisig, sizeLabel: "Meat" }, new Set()), "meat");
assert.equal(sizeTitle({ sizeLabel: " " }), "Size", "a blank name is Size");
console.log("options-check: all good");
