// The "At the table" rules (lib/atTable.ts) on known cases.
// Run: node scripts/at-table-check.ts
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs this .ts file as is, so the import names the .ts file.
import { distance, isOpen, parseFix, placeCheck, sendCheck, type AtTable } from "../lib/atTable.ts";

// Manila 2026-11-17 at hh:mm, as a timestamp (UTC+8).
const at = (hh: number, mm = 0) => Date.UTC(2026, 10, 17, hh - 8, mm);

assert.equal(isOpen({ opensAt: null, closesAt: null }, at(3)), true, "no hours: always open");
assert.equal(isOpen({ opensAt: "10:00", closesAt: "22:00" }, at(10)), true, "opening minute");
assert.equal(isOpen({ opensAt: "10:00", closesAt: "22:00" }, at(21, 59)), true);
assert.equal(isOpen({ opensAt: "10:00", closesAt: "22:00" }, at(22)), false, "closing minute is closed");
assert.equal(isOpen({ opensAt: "10:00", closesAt: "22:00" }, at(9, 59)), false);
assert.equal(isOpen({ opensAt: "18:00", closesAt: "02:00" }, at(1)), true, "past midnight");
assert.equal(isOpen({ opensAt: "18:00", closesAt: "02:00" }, at(12)), false);

// A point and others north of it: 0.001 degree of latitude is about 111 m.
const cafe = { lat: 14.5995, lng: 120.9842 };
const north = (m: number) => ({ lat: cafe.lat + m / 111195, lng: cafe.lng });
assert.ok(Math.abs(distance(cafe, north(100)) - 100) < 1, "distance");

const geo = { ...cafe, radius: 50 };
assert.equal(placeCheck(geo, { ...north(10), acc: 20 }), "ok", "inside, good reading");
assert.equal(placeCheck(geo, { ...north(80), acc: 40 }), "ok", "just outside, reading covers it");
assert.equal(placeCheck(geo, { ...north(2000), acc: 30 }), "far", "across town");
assert.equal(placeCheck(geo, { ...north(2000), acc: 500 }), "far", "rough but clearly far");
assert.equal(placeCheck(geo, { ...north(150), acc: 300 }), "vague", "rough and near: try again");
assert.equal(placeCheck(geo, { ...north(101), acc: 1000 }), "vague", "a huge circle never passes past one radius extra");

const r: AtTable = { send: true, call: true, bill: true, opensAt: "10:00", closesAt: "22:00", geo };
assert.equal(sendCheck({ ...r, send: false }, null, at(12)), "off");
assert.equal(sendCheck(r, { ...north(0), acc: 5 }, at(23)), "closed");
assert.equal(sendCheck(r, null, at(12)), "need_location");
assert.equal(sendCheck(r, { ...north(0), acc: 5 }, at(12)), "ok");
assert.equal(sendCheck({ ...r, geo: null }, null, at(12)), "ok", "no pin: no location needed");

assert.deepEqual(parseFix({ lat: 1, lng: 2, acc: 3 }), { lat: 1, lng: 2, acc: 3 });
assert.equal(parseFix({ lat: 91, lng: 2, acc: 3 }), null);
assert.equal(parseFix({ lat: "1", lng: 2, acc: 3 }), null);
assert.equal(parseFix(null), null);

console.log("at-table-check: all good");
