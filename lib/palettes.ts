// The colour schemes a manager can give the guests' menu. Each one fills the
// same roles as the themes in app/globals.css ("r g b" so Tailwind can add
// opacity): forest and leaf are the dark main colour (white text on it),
// mango the bright accent (forest text on it, and mango text on forest).
// scripts/palettes-check.ts checks those pairs are readable.

export type PaletteId =
  | "cocoa"
  | "ube"
  | "forest"
  | "adobo"
  | "navy"
  | "teal"
  | "charcoal"
  | "berry"
  | "terracotta"
  | "indigo";

export type Palette = {
  id: PaletteId;
  name: string;
  ink: string;
  muted: string;
  line: string;
  wash: string;
  paper: string;
  forest: string;
  forestSoft: string;
  leaf: string;
  leafDark: string;
  leafTint: string;
  mango: string;
  mangoSoft: string;
};

const p = (
  id: PaletteId,
  name: string,
  [ink, muted, line, wash, paper]: string[],
  [forest, forestSoft, leafDark, leafTint]: string[],
  [mango, mangoSoft]: string[]
): Palette => ({ id, name, ink, muted, line, wash, paper, forest, forestSoft, leaf: forest, leafDark, leafTint, mango, mangoSoft });

export const PALETTES: Palette[] = [
  p("cocoa", "Cocoa & orange", ["59 46 37", "112 96 82", "236 223 192", "244 234 206", "255 249 231"], ["59 46 37", "84 68 58", "42 32 25", "252 233 200"], ["241 154 51", "250 214 138"]),
  p("ube", "Ube & calamansi", ["30 21 48", "104 94 120", "230 224 238", "240 234 247", "248 247 251"], ["61 35 88", "82 52 112", "44 24 66", "240 234 247"], ["212 225 87", "236 243 190"]),
  p("forest", "Forest & mango", ["26 26 26", "94 102 96", "225 229 223", "238 241 236", "245 246 242"], ["16 52 42", "26 69 56", "10 38 30", "227 238 231"], ["242 178 51", "252 239 203"]),
  p("adobo", "Adobo & gold", ["58 22 20", "122 92 88", "238 218 210", "248 233 226", "255 247 242"], ["122 31 31", "145 50 46", "92 22 22", "250 228 220"], ["242 179 61", "250 222 160"]),
  p("navy", "Navy & coral", ["20 34 52", "88 102 120", "220 229 238", "231 238 245", "245 248 251"], ["22 58 95", "36 78 120", "14 42 70", "226 236 246"], ["255 155 128", "255 214 201"]),
  p("teal", "Teal & saffron", ["18 44 46", "84 106 106", "214 231 229", "227 239 238", "244 248 247"], ["15 82 87", "26 104 109", "10 62 66", "222 239 237"], ["247 183 51", "252 228 170"]),
  p("charcoal", "Charcoal & lemon", ["28 28 28", "100 100 96", "228 228 222", "239 239 234", "250 250 247"], ["35 35 35", "58 58 58", "18 18 18", "246 240 205"], ["245 213 71", "250 236 170"]),
  p("berry", "Berry & blush", ["56 20 38", "120 88 102", "240 220 228", "248 230 236", "255 246 248"], ["123 30 74", "146 48 94", "94 20 56", "251 228 236"], ["246 166 184", "251 212 221"]),
  p("terracotta", "Terracotta & sand", ["60 32 22", "120 96 84", "236 221 204", "245 232 218", "253 247 240"], ["138 54 32", "160 72 48", "106 40 22", "248 230 212"], ["240 201 135", "248 228 192"]),
  p("indigo", "Indigo & mint", ["28 28 60", "96 96 126", "224 224 240", "233 233 246", "246 246 252"], ["43 45 110", "60 62 134", "30 32 84", "228 246 240"], ["142 227 200", "204 243 230"]),
];

export const palette = (id: string | null | undefined): Palette | null => PALETTES.find((x) => x.id === id) ?? null;

/** "59 46 37" as "#3b2e25", for the phone's status bar and the focus ring. */
export const hex = (rgb: string) => "#" + rgb.split(" ").map((n) => Number(n).toString(16).padStart(2, "0")).join("");

/**
 * The palette as CSS that replaces the theme's colours on the whole page
 * (sheets and dialogs too). .theme-warm and .theme-ube are named because they
 * set the colours on their own wrapper; fonts are left as the design has them.
 */
export function paletteCss(c: Palette): string {
  const vars = [
    ["ink", c.ink],
    ["muted", c.muted],
    ["line", c.line],
    ["wash", c.wash],
    ["paper", c.paper],
    ["forest", c.forest],
    ["forest-soft", c.forestSoft],
    ["leaf", c.leaf],
    ["leaf-dark", c.leafDark],
    ["leaf-tint", c.leafTint],
    ["mango", c.mango],
    ["mango-soft", c.mangoSoft],
  ]
    .map(([k, v]) => `--${k}:${v};`)
    .join("");
  return `:root,.theme-warm,.theme-ube{${vars}--focus:${hex(c.forest)};}html,body{background:rgb(${c.paper});}`;
}
