// Every menu palette (lib/palettes.ts) keeps its text readable: WCAG AA,
// 4.5:1, for each pair the menu actually puts together.
// Run: node scripts/palettes-check.ts
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs this .ts file as is, so the import names the .ts file.
import { PALETTES, palette, paletteCss } from "../lib/palettes.ts";

const lum = (rgb: string) => {
  const [r, g, b] = rgb.split(" ").map((n) => {
    const v = Number(n) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const WHITE = "255 255 255";
assert.equal(PALETTES.length, 10);
assert.equal(new Set(PALETTES.map((c: { id: string }) => c.id)).size, 10);
const bad: string[] = [];
for (const c of PALETTES) {
  const pairs: [string, string, string][] = [
    ["ink on paper", c.ink, c.paper],
    ["muted on paper", c.muted, c.paper],
    ["muted on wash", c.muted, c.wash],
    ["white on forest", WHITE, c.forest],
    ["white on leaf-dark", WHITE, c.leafDark],
    ["forest on paper", c.forest, c.paper],
    ["forest on mango", c.forest, c.mango],
    ["forest on mango-soft", c.forest, c.mangoSoft],
    ["forest on leaf-tint", c.forest, c.leafTint],
    ["mango on forest", c.mango, c.forest],
  ];
  for (const [what, a, b] of pairs) {
    const r = ratio(a, b);
    if (r < 4.5) bad.push(`${c.name}: ${what} is ${r.toFixed(2)}:1`);
  }
}
assert.deepEqual(bad, []);
assert.equal(palette("nope"), null);
assert.equal(palette(null), null);
assert.match(paletteCss(palette("cocoa")!), /--focus:#3b2e25;/);
console.log("palettes ok");
