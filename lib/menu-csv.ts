import { INGREDIENT_LABELS } from "@/app/components/Icons";

// Bulk menu upload: the CSV template a manager fills in, and reading it back.
// No database here, so the menu screen can build the template too.

export const CSV_COLUMNS = [
  "name",
  "short_description",
  "description",
  "price",
  "categories",
  "spice",
  "serves_from",
  "serves_up_to",
  "available",
  "hero",
  "featured",
  "new",
  "ingredients",
] as const;

const SAMPLE = [
  "Sinigang na Hipon",
  "Sour tamarind soup with shrimp",
  "Shrimp simmered in a sour tamarind broth with kangkong, radish and long beans. Best shared with rice.",
  "385",
  "Seafood; Soups",
  "1",
  "2",
  "3",
  "yes",
  "no",
  "yes",
  "no",
  "shrimp:seafood; kangkong:vegetable; tamarind:fruit",
];

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The template: the header row and one sample dish. The BOM makes Excel read it as UTF-8. */
export const csvTemplate = () => "﻿" + [CSV_COLUMNS, SAMPLE].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

/** Splits CSV text into rows of cells (quoted cells may hold commas, quotes and line breaks). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let v = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (v += '"'), i++;
      else if (c === '"') quoted = false;
      else v += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(v), (v = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(v), rows.push(row), (row = []), (v = "");
    } else v += c;
  }
  if (v || row.length) row.push(v), rows.push(row);
  // Spreadsheets leave fully blank lines behind.
  return rows.filter((r) => r.some((x) => x.trim()));
}

export type CsvDish = {
  /** The spreadsheet row it came from (the header is row 1). */
  row: number;
  /** Fields for parseDishInput, categoryIds still to fill in. */
  input: Record<string, unknown>;
  categoryNames: string[];
};

const yesNo = (v: string, blank: boolean): boolean | string => {
  const s = v.trim().toLowerCase();
  if (!s) return blank;
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return `"${v}" should be yes or no.`;
};

const whole = (v: string, blank: number): number => (v.trim() ? (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN) : blank);

/** Reads the filled-in template: the rows that read cleanly, and what's wrong with the rest. */
export function readMenuCsv(text: string): { dishes: CsvDish[]; errors: string[] } {
  const no = (e: string) => ({ dishes: [], errors: [e] });
  const rows = parseCsv(text);
  if (rows.length === 0) return no("The file is empty.");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((c) => !head.includes(c));
  if (missing.length) return no(`Use the template: these columns are missing: ${missing.join(", ")}.`);
  if (rows.length === 1) return no("The file has no dishes under the header row.");
  if (rows.length > 301) return no("Upload up to 300 dishes at a time.");

  const out: CsvDish[] = [];
  const errors: string[] = [];
  rows.slice(1).forEach((r, n) => {
    const row = n + 2;
    const get = (c: (typeof CSV_COLUMNS)[number]) => (r[head.indexOf(c)] ?? "").trim();
    const bad = (msg: string) => errors.push(`Row ${row}${get("name") ? ` (${get("name")})` : ""}: ${msg}`);

    const price = get("price").replace(/[₱,\s]|php/gi, "");
    const priceCents = /^\d+(\.\d{1,2})?$/.test(price) ? Math.round(Number(price) * 100) : NaN;
    if (Number.isNaN(priceCents)) return bad(`price "${get("price")}" should be a number, like 385 or 385.50.`);

    const spiceRaw = get("spice").toLowerCase();
    const spiceLevel = spiceRaw === "n/a" || spiceRaw === "na" ? null : whole(spiceRaw, 0);
    if (Number.isNaN(spiceLevel)) return bad(`spice "${get("spice")}" should be 0 to 5, or n/a for drinks.`);

    const servesMin = whole(get("serves_from"), 1);
    const servesMax = whole(get("serves_up_to"), servesMin);

    const flags = { available: yesNo(get("available"), true), featured: yesNo(get("hero"), false), bestSeller: yesNo(get("featured"), false), isNew: yesNo(get("new"), false) };
    const flagError = Object.values(flags).find((f) => typeof f === "string");
    if (flagError) return bad(flagError as string);

    const ingredients = [];
    for (const part of get("ingredients").split(";").map((s) => s.trim()).filter(Boolean)) {
      const [name, kind = ""] = part.split(":").map((s) => s.trim());
      if (!(kind.toLowerCase() in INGREDIENT_LABELS))
        return bad(`ingredient "${part}" needs a kind after a colon, one of: ${Object.keys(INGREDIENT_LABELS).join(", ")}.`);
      ingredients.push({ name, kind: kind.toLowerCase() });
    }

    out.push({
      row,
      input: {
        name: get("name"),
        shortDescription: get("short_description"),
        description: get("description"),
        priceCents,
        imageUrl: null,
        spiceLevel,
        servesMin,
        servesMax,
        ...flags,
        ingredients,
      },
      categoryNames: [...new Set(get("categories").split(";").map((s) => s.trim()).filter(Boolean))],
    });
  });
  return { dishes: out, errors };
}
