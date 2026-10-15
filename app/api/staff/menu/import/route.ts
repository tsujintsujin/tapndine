import { NextResponse } from "next/server";
import { body, fail, managerOr } from "@/lib/manager";
import { readMenuCsv } from "@/lib/menu-csv";
import { importDishes, parseCategoryName, parseDishInput, type DishInput } from "@/lib/menu-admin";

/**
 * Adds every dish in the uploaded template, or none: any problem in any row
 * comes back as `errors` (still a 200, so the screen can list them) and nothing is saved. Body: { csv }.
 */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const csv = (await body(req))?.csv;
  if (typeof csv !== "string" || csv.length > 1_000_000) return fail("Upload the menu as a CSV file under 1 MB.");

  const { dishes: rows, errors } = readMenuCsv(csv);
  const dishes: { input: DishInput; categoryNames: string[] }[] = [];
  const names = new Map<string, number>();
  let hero: number | null = null;
  for (const r of rows) {
    const at = `Row ${r.row}${r.input.name ? ` (${r.input.name})` : ""}`;
    const input = parseDishInput(r.input);
    if (typeof input === "string") {
      errors.push(`${at}: ${input}`);
      continue;
    }
    const seen = names.get(input.name.toLowerCase());
    if (seen) errors.push(`${at}: the same name is on row ${seen}.`);
    else names.set(input.name.toLowerCase(), r.row);
    if (input.featured) {
      if (hero) errors.push(`${at}: only one dish can be the hero, and row ${hero} already is.`);
      else hero = r.row;
    }
    const bad = r.categoryNames.find((c) => !parseCategoryName(c));
    if (bad) errors.push(`${at}: category "${bad}" is too long (up to 30 characters).`);
    dishes.push({ input, categoryNames: r.categoryNames });
  }
  // Both passes add to the list, so put it back in row order.
  const rowOf = (e: string) => Number(/^Row (\d+)/.exec(e)?.[1] ?? 0);
  if (errors.length) return NextResponse.json({ errors: errors.sort((a, b) => rowOf(a) - rowOf(b)) });

  return NextResponse.json(await importDishes(me.business_id, dishes));
}
