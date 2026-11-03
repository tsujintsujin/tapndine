// Dish search for the guest menu. Guests type what they want, not the menu's
// exact words: "coffee" for an Americano, "drinks" for the whole Drinks list,
// "kape", "capuccino". So a dish matches on its name, its category and
// sub-category, its choices and its description; on whole-word starts ("iced"
// is not inside "sliced"); through a short list of synonyms in English and
// Filipino; and with a typo or two in longer words.
// Check: node scripts/search-check.ts

/** What search needs of a menu: the dishes, and the categories they sit in. */
export type Searchable = {
  dishOrder: string[];
  dishes: Record<string, { name: string; shortDescription: string; description: string; options: { name: string }[] }>;
  categories: { name: string; dishIds: string[]; subs: { name: string; dishIds: string[] }[] }[];
};

/** Accents and case don't matter: "creme" finds "Crème". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * The words of a text. "Kare-Kare" gives "kare-kare" and "kare"; a word made
 * with "non-" stays whole, so "Non-Espresso" is not found by "espresso".
 */
export function words(s: string): string[] {
  const out: string[] = [];
  for (const w of fold(s).split(/[^a-z0-9'-]+/)) {
    const t = w.replace(/^[-']+|[-']+$/g, "");
    if (!t) continue;
    out.push(t);
    if (t.includes("-") && !/^non?-/.test(t)) out.push(...t.split("-").filter(Boolean));
  }
  return out;
}

// Each line is one set of words that find each other. Kept to what guests at a
// Philippine restaurant or café type. No "latte" with coffee: a mango latte has
// none; a Café Latte is still found through "espresso".
const SYNONYMS = [
  "coffee kape espresso expresso americano cappuccino macchiato mocha brew",
  "drink drinks inumin beverage beverages",
  "softdrink softdrinks soda sodas coke pepsi sprite royal",
  "beer beers serbesa",
  "water tubig",
  "juice juices cooler coolers",
  "shake shakes smoothie smoothies",
  "tea teas tsaa",
  "chicken manok",
  "pork baboy",
  "beef baka",
  "fish isda",
  "shrimp shrimps hipon prawn prawns",
  "squid pusit calamares",
  "vegetable vegetables veggie veggies gulay",
  "rice kanin",
  "noodle noodles pancit pansit",
  "soup soups sabaw",
  "dessert desserts sweets matamis",
].map((l) => l.split(" "));

const synonymsOf = (t: string) => SYNONYMS.find((set) => set.includes(t))?.filter((w) => w !== t) ?? [];

/** Edits to turn a into b: insert, delete, change, or swap two neighbours. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * How many typos a typed word may have: none up to 5 letters, where one is
 * another dish ("pasta" and "pata", "sisig" and "sinig-ang").
 */
const typosAllowed = (t: string) => (t.length >= 9 ? 2 : t.length >= 6 ? 1 : 0);

/**
 * 3 for a word that starts with what was typed, 2 for a synonym, 1 for a near
 * miss (only where `typos`: names and categories, not descriptions, where
 * "pasta" would find "shrimp paste"), 0 for none.
 */
function wordMatch(typed: string, word: string, typos: boolean): number {
  if (word.startsWith(typed)) return 3;
  if (synonymsOf(typed).some((s) => word === s || (s.length >= 4 && word.startsWith(s)))) return 2;
  const k = typos ? typosAllowed(typed) : 0;
  if (k && distance(typed, word) <= k) return 1;
  // Still typing a long word with a typo in it: "capucc" is too short to judge, "capuccin" isn't.
  if (k && typed.length >= 8 && word.length > typed.length && distance(typed, word.slice(0, typed.length)) <= 1) return 1;
  return 0;
}

// Where a word was found counts too: the name most, then the category, the
// choices, and last the description.
const FIELD_WEIGHT = { name: 8, category: 5, option: 3, description: 2 } as const;
type Field = keyof typeof FIELD_WEIGHT;

/**
 * The dishes matching what was typed, best first, then in menu order. Every
 * typed word has to match somewhere. Empty when nothing was typed.
 */
export function searchDishes(menu: Searchable, query: string): string[] {
  const typed = words(query);
  if (!typed.length) return [];

  const placesOf = new Map<string, string[]>();
  const place = (id: string, name: string) => placesOf.set(id, [...(placesOf.get(id) ?? []), name]);
  for (const c of menu.categories) {
    for (const id of c.dishIds) place(id, c.name);
    for (const s of c.subs) for (const id of s.dishIds) place(id, s.name);
  }

  const scored: { id: string; score: number; at: number }[] = [];
  menu.dishOrder.forEach((id, at) => {
    const d = menu.dishes[id];
    const fields: [Field, string[]][] = [
      ["name", words(d.name)],
      ["category", (placesOf.get(id) ?? []).flatMap(words)],
      ["option", d.options.flatMap((o) => words(o.name))],
      ["description", words(`${d.shortDescription} ${d.description}`)],
    ];
    let score = 0;
    for (const t of typed) {
      let best = 0;
      for (const [field, ws] of fields) {
        for (const w of ws) best = Math.max(best, wordMatch(t, w, field !== "description") * FIELD_WEIGHT[field]);
      }
      if (!best) return;
      score += best;
    }
    // The name starting with exactly what was typed comes first of all.
    if (fold(d.name).startsWith(fold(query.trim()))) score += 100;
    scored.push({ id, score, at });
  });
  return scored.sort((a, b) => b.score - a.score || a.at - b.at).map((s) => s.id);
}
