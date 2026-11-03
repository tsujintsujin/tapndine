// The guest menu search (lib/search.ts) on a small café menu, with the
// searches that used to fail. Run: node scripts/search-check.ts
import assert from "node:assert/strict";
// @ts-expect-error -- Node runs this .ts file as is, so the import names the .ts file.
import { searchDishes, words } from "../lib/search.ts";

const dish = (name: string, description: string, options: string[] = []) => ({
  name,
  shortDescription: description,
  description,
  options: options.map((n) => ({ name: n })),
});
const dishes = {
  americano: dish("Americano", "Espresso and water, hot or iced."),
  latte: dish("Café Latte", "Espresso and steamed milk."),
  cappuccino: dish("Cappuccino", "Espresso with foamed milk."),
  mangoLatte: dish("Mango Latte", "Iced mango and milk."),
  matcha: dish("Matcha", "Matcha and milk, hot or iced."),
  biscoffFrappe: dish("Biscoff Espresso Frappe", "Blended espresso and Biscoff."),
  chocoFrappe: dish("Hershey's Choco Frappe", "Blended chocolate."),
  coke: dish("Coke", "Chilled soft drink."),
  mangoSmoothie: dish("Mango Smoothie", "Creamy mango smoothie."),
  shrimpPasta: dish("Shrimp Aglio e Olio", "Garlic pasta with shrimp, served with sliced bread."),
  binagoongan: dish("Binagoongan Rice", "A platter of rice fried with shrimp paste."),
  canton: dish("Canton Guisado", "Stir-fried noodles.", ["Pork", "Chicken", "Seafood"]),
  kareKare: dish("Pork Kare-Kare", "Pork in peanut sauce."),
  pata: dish("Crispy Pata", "Fried pork knuckle."),
  bicol: dish("Bicol Express", "Pork in coconut milk."),
  sinigang: dish("Pork Sinigang", "Sour tamarind soup."),
  sisig: dish("Sizzling Pork Sisig", "Chopped pork on a hot plate."),
  tinola: dish("Tinolang Manok", "Chicken soup with ginger."),
};
const ids = Object.keys(dishes);
const menu = {
  dishOrder: ids,
  dishes,
  categories: [
    { name: "Pasta", dishIds: ["shrimpPasta"], subs: [] },
    { name: "Rice", dishIds: ["binagoongan"], subs: [] },
    { name: "Noodles", dishIds: ["canton"], subs: [] },
    { name: "Pork", dishIds: ["bicol", "kareKare", "pata", "sinigang", "sisig"], subs: [] },
    { name: "Soup", dishIds: ["tinola"], subs: [] },
    {
      name: "Drinks",
      dishIds: ["mangoSmoothie", "coke", "americano", "latte", "cappuccino", "mangoLatte", "matcha", "biscoffFrappe", "chocoFrappe"],
      subs: [
        { name: "Beverage", dishIds: ["coke"] },
        { name: "Espresso Based", dishIds: ["americano", "latte", "cappuccino"] },
        { name: "Non-Espresso Based", dishIds: ["mangoLatte", "matcha"] },
        { name: "Frappe", dishIds: ["biscoffFrappe", "chocoFrappe"] },
      ],
    },
  ],
};
const find = (q: string) => searchDishes(menu, q);
const same = (q: string, want: string[]) => assert.deepEqual(new Set(find(q)), new Set(want), q);

assert.deepEqual(words("Non-Espresso Based"), ["non-espresso", "based"], "non- stays whole");
assert.deepEqual(words("Pork Kare-Kare"), ["pork", "kare-kare", "kare", "kare"]);

same("coffee", ["americano", "latte", "cappuccino", "biscoffFrappe"]);
same("kape", ["americano", "latte", "cappuccino", "biscoffFrappe"]);
assert.equal(find("drinks").length, 9, "a category name finds its dishes");
same("frappe", ["biscoffFrappe", "chocoFrappe"]);
same("softdrinks", ["coke"]);
same("capuccino", ["cappuccino"]);
same("cappucino", ["cappuccino"]);
same("iced", ["americano", "mangoLatte", "matcha"]); // not "sliced" bread
same("latte", ["latte", "mangoLatte"]); // not a "platter"
same("pasta", ["shrimpPasta"]); // not "shrimp paste", not Crispy "Pata"
same("sisig", ["sisig"]); // not "Sinigang"
assert.equal(find("expresso").at(-1), "bicol", "the usual misspelling finds the espresso drinks before Bicol Express");
same("chiken", ["canton"]); // one typo in a 6-letter word (not in descriptions)
same("seafood", ["canton"]); // a choice on the dish
same("kare", ["kareKare"]);
same("manok", ["canton", "tinola"]); // Filipino for chicken: a Chicken choice, and in the name
same("baka", []);
assert.deepEqual(find("mango"), ["mangoLatte", "mangoSmoothie"], "names starting with it, in menu order");
assert.deepEqual(find("smoothie"), ["mangoSmoothie"], "the name before the description");
assert.equal(find("smoothie")[0], "mangoSmoothie");
assert.deepEqual(find("  "), []);
assert.deepEqual(find("espresso frappe"), ["biscoffFrappe"], "every word has to match");

console.log("search: all checks passed");
