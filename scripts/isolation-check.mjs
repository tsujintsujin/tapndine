// Restaurants must never see or touch each other's data. This logs in as
// Kusina Dos's manager (seed/kusina.sql) and attacks Hikay (seed/dev.sql)
// through every staff API, with Hikay's real ids; then a Kusina guest tries
// to order Hikay's dishes; then a manager tries the developer API. Hikay's
// rows must be byte-for-byte the same afterwards.
//
// Local test data only. With `npm run dev` running:
//   node scripts/isolation-check.mjs [http://localhost:3300]

import { execFileSync } from "node:child_process";

const BASE = process.argv[2] ?? "http://localhost:3300";
const HIKAY = "biz_hikay";
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};

/** One row from the local database. */
function sql(query) {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "tapndine", "--local", "--persist-to", ".localdb", "--json", "--command", `"${query.replace(/\s+/g, " ")}"`], {
    shell: true,
    encoding: "utf8",
  });
  return JSON.parse(out)[0].results[0];
}

/** Everything of Hikay's an attack could change. */
const fingerprint = () =>
  JSON.stringify(
    sql(`SELECT
      (SELECT group_concat(id || label || COALESCE(removed_at, '') || sort, '|') FROM (SELECT * FROM tables WHERE business_id = '${HIKAY}' ORDER BY id)) AS tables,
      (SELECT group_concat(id || COALESCE(table_id, '') || COALESCE(removed_at, ''), '|') FROM (SELECT * FROM tags WHERE business_id = '${HIKAY}' ORDER BY id)) AS tags,
      (SELECT group_concat(id || name || available || COALESCE(removed_at, '') || sort || featured || price_cents, '|') FROM (SELECT * FROM dishes WHERE business_id = '${HIKAY}' ORDER BY id)) AS dishes,
      (SELECT group_concat(o.id || o.dish_id || o.kind || o.name || o.price_cents || o.sort, '|') FROM (SELECT o.* FROM dish_options o JOIN dishes x ON x.id = o.dish_id WHERE x.business_id = '${HIKAY}' ORDER BY o.id) o) AS options,
      (SELECT group_concat(id || name || sort || COALESCE(parent_id, ''), '|') FROM (SELECT * FROM categories WHERE business_id = '${HIKAY}' ORDER BY id)) AS categories,
      (SELECT COUNT(*) || '-' || SUM(dc.sort) FROM dish_categories dc JOIN categories c ON c.id = dc.category_id WHERE c.business_id = '${HIKAY}') AS links,
      (SELECT COUNT(*) || '-' || COUNT(closed_at) FROM sittings WHERE business_id = '${HIKAY}') AS sittings,
      (SELECT COUNT(*) || '-' || SUM(i.qty) FROM batch_items i JOIN batches b ON b.id = i.batch_id JOIN sittings s ON s.id = b.sitting_id WHERE s.business_id = '${HIKAY}') AS items,
      (SELECT group_concat(id || COALESCE(disabled_at, ''), '|') FROM (SELECT * FROM staff WHERE business_id = '${HIKAY}' ORDER BY id)) AS staff,
      (SELECT COUNT(*) || '-' || COUNT(b.seen_at) FROM batches b JOIN sittings s ON s.id = b.sitting_id WHERE s.business_id = '${HIKAY}') AS seen,
      (SELECT COUNT(*) || '-' || COUNT(c.seen_at) FROM calls c JOIN sittings s ON s.id = c.sitting_id WHERE s.business_id = '${HIKAY}') AS calls,
      (SELECT name || slug || COALESCE(disabled_at, '') || COALESCE(logo_url, '') FROM businesses WHERE id = '${HIKAY}') AS business`)
  );

/** fetch() as one browser: keeps its cookies. */
function browser() {
  const jar = new Map();
  return async (path, { method = "GET", body } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: {
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
  };
}

// Something new at Hikay's table 1, so a peek from Kusina that marked it seen would show.
sql(`UPDATE batches SET seen_at = NULL WHERE id = (
  SELECT b.id FROM batches b JOIN sittings s ON s.id = b.sitting_id
  WHERE s.table_id = 'tbl_hikay_1' AND s.closed_at IS NULL LIMIT 1)`);

const before = fingerprint();
const openItem = sql(
  `SELECT i.id FROM batch_items i JOIN batches b ON b.id = i.batch_id JOIN sittings s ON s.id = b.sitting_id
   WHERE s.business_id = '${HIKAY}' AND s.closed_at IS NULL LIMIT 1`
)?.id;
const kusinaDish = sql(`SELECT id FROM dishes WHERE business_id = 'biz_kusina' AND removed_at IS NULL AND available = 1 LIMIT 1`).id;
const hikayDishes = sql(`SELECT json_group_array(id) AS ids FROM dishes WHERE business_id = '${HIKAY}' AND removed_at IS NULL`).ids;

// --- Kusina's manager, against Hikay ---------------------------------------
const kusina = browser();
const login = await kusina("/api/staff/login", { method: "POST", body: { username: "kusina-dos-manager", password: "kusina-manager-1" } });
check(login.status === 200, "Kusina's manager logs in");

const own = await kusina("/api/staff/tables");
check(own.status === 200 && own.text.includes("tbl_kusina_1"), "Kusina's manager sees Kusina's tables");
check(!own.text.includes("hikay"), "...and none of Hikay's");

// Pages a manager reads: none may show anything of Hikay's.
for (const page of ["/admin", "/admin/dashboard", "/admin/menu", "/admin/categories", "/admin/links", "/admin/manage", "/admin/settings", "/admin/homepage", "/m/preview"]) {
  const r = await kusina(page);
  const leak = ["Chicken Inasal", "Maria", "tbl_hikay", "k7x9q2mp", "biz_hikay"].find((s) => r.text.includes(s));
  check(r.status === 200 && !leak, `${page} shows only Kusina${leak ? ` (found "${leak}")` : ""}`);
}

const attacks = [
  ["GET", "/api/staff/tables/tbl_hikay_1"],
  ["PUT", "/api/staff/tables/tbl_hikay_1", { label: "Hacked" }],
  ["DELETE", "/api/staff/tables/tbl_hikay_3"],
  ["POST", "/api/staff/tables/tbl_hikay_1/link", {}],
  ["POST", "/api/staff/tables/tbl_hikay_2/items", { dishId: "d_sisig", qty: 1 }],
  ["POST", "/api/staff/tables/tbl_kusina_1/items", { dishId: "d_sisig", qty: 1 }],
  ["POST", `/api/staff/items/${openItem}`, { qty: 0 }],
  // Kusina's own dish, with one of Hikay's options picked.
  ["POST", "/api/staff/tables/tbl_kusina_1/items", { dishId: kusinaDish, qty: 1, options: ["o_sisig_sharing"] }],
  ["PUT", "/api/staff/menu/dishes/d_sisig", {
    name: "Hacked", shortDescription: "x", description: "", priceCents: 1, imageUrl: null, spiceLevel: 0,
    servesMin: 1, servesMax: 1, available: true, featured: false, bestSeller: false, isNew: false, categoryIds: [], ingredients: [],
  }],
  ["DELETE", "/api/staff/menu/dishes/d_sisig"],
  ["POST", "/api/staff/menu/dishes/d_sisig/available", { available: false }],
  ["POST", "/api/staff/menu/dishes/order", { ids: JSON.parse(hikayDishes).reverse() }],
  ["PUT", "/api/staff/menu/categories/cat_pork", { name: "Hacked", dishIds: [] }],
  ["PUT", "/api/staff/menu/categories/cat_pork", { name: "Pork", parentId: "cat_beef" }],
  ["POST", "/api/staff/menu/categories", { name: "Under Hikay's", parentId: "cat_pork" }],
  ["DELETE", "/api/staff/menu/categories/cat_pork"],
  ["POST", "/api/staff/menu/categories/order", { ids: ["cat_halal", "cat_veg", "cat_beef", "cat_pork", "cat_chicken", "cat_seafood"] }],
  ["POST", "/api/staff/homepage", { hero: "d_sisig", featured: [], fresh: [] }],
  // A logo from Hikay's photo folder is not Kusina's to use.
  ["POST", "/api/staff/logo", { logoUrl: "https://res.cloudinary.com/x/image/upload/tapndine/hikay/logo" }],
];
for (const [method, path, body] of attacks) {
  const r = await kusina(path, { method, body });
  check(r.status >= 400, `${method} ${path} refused (${r.status})`);
}

// Clear and Disable answer ok even when there is nothing to do (a double tap
// is not an error), so these two are judged by what happened, not the answer.
const openOn2 = () => sql(`SELECT COUNT(*) AS n FROM sittings WHERE table_id = 'tbl_hikay_2' AND closed_at IS NULL`).n;
const open2 = openOn2();
await kusina("/api/staff/tables/tbl_hikay_2/clear", { method: "POST", body: {} });
check(openOn2() === open2, "Clearing Hikay's table 2 did nothing");
await kusina("/api/staff/waiters/stf_ana/disable", { method: "POST", body: {} });
check(sql(`SELECT disabled_at FROM staff WHERE id = 'stf_ana'`).disabled_at === null, "Disabling Hikay's waiter did nothing");
// Hikay's dishes in Kusina's home rows answer ok too (they are simply not Kusina's).
const homeOf = () => sql(`SELECT group_concat(id || featured || best_seller || is_new) AS s FROM dishes WHERE business_id = '${HIKAY}'`).s;
const home = homeOf();
await kusina("/api/staff/homepage", { method: "POST", body: { hero: null, featured: JSON.parse(hikayDishes), fresh: JSON.parse(hikayDishes) } });
check(homeOf() === home, "Putting Hikay's dishes in Kusina's home rows did nothing to Hikay's");

// Kusina adds a dish of its own but asks for Hikay's category: the category is dropped.
const sneak = await kusina("/api/staff/menu/dishes", {
  method: "POST",
  body: {
    name: "Sneaky", shortDescription: "x", description: "", priceCents: 100, imageUrl: null, spiceLevel: 0,
    servesMin: 1, servesMax: 1, available: true, featured: false, bestSeller: false, isNew: false, categoryIds: ["cat_pork"], ingredients: [],
  },
});
check(sneak.status === 200, "Kusina adds its own dish (control)");
if (sneak.status === 200) {
  const id = JSON.parse(sneak.text).id;
  const linked = sql(`SELECT COUNT(*) AS n FROM dish_categories WHERE dish_id = '${id}'`).n;
  check(linked === 0, "...but it is not put in Hikay's category");
  // Saving it again with Hikay's option ids: Kusina gets options of its own, Hikay's stay put.
  const steal = await kusina(`/api/staff/menu/dishes/${id}`, {
    method: "PUT",
    body: {
      name: "Sneaky", shortDescription: "x", description: "", priceCents: 100, imageUrl: null, spiceLevel: 0,
      servesMin: 1, servesMax: 1, available: true, featured: false, bestSeller: false, isNew: false, categoryIds: [], ingredients: [],
      sizeRequired: true, options: [{ id: "o_sisig_solo", kind: "size", name: "Mine", priceCents: 0 }, { id: "o_sisig_solo", kind: "size", name: "Twice", priceCents: 0 }],
    },
  });
  check(steal.status === 200, "Kusina saves its dish with Hikay's option ids sent along");
  check(sql(`SELECT COUNT(*) AS n FROM dish_options WHERE dish_id = '${id}' AND id NOT LIKE 'o_sisig%'`).n === 2, "...and gets two options of its own instead");
  // A set meal choice pointing at Hikay's dish: refused, so Kusina can't show Hikay's menu in its own.
  const borrow = await kusina(`/api/staff/menu/dishes/${id}`, {
    method: "PUT",
    body: {
      name: "Sneaky", shortDescription: "x", description: "", priceCents: 100, imageUrl: null, spiceLevel: 0,
      servesMin: 1, servesMax: 1, available: true, featured: false, bestSeller: false, isNew: false, categoryIds: [], ingredients: [],
      sizeRequired: true, options: [{ kind: "choice", group: "Drink", ref: "d_mangoshake", name: "Mango Shake", priceCents: 0 }],
    },
  });
  check(borrow.status >= 400, `A set meal choice from Hikay's menu refused (${borrow.status})`);
  check(sql(`SELECT COUNT(*) AS n FROM dish_options WHERE ref_dish_id = 'd_mangoshake' AND dish_id = '${id}'`).n === 0, "...and nothing was saved");
  await kusina(`/api/staff/menu/dishes/${id}`, { method: "DELETE" });
}

// --- A manager is not a developer ------------------------------------------
for (const [method, path, body] of [
  ["POST", "/api/dev/open", { id: HIKAY }],
  ["PATCH", `/api/dev/restaurants/${HIKAY}`, { off: true }],
  ["PATCH", `/api/dev/restaurants/${HIKAY}`, { name: "Hacked" }],
  ["POST", "/api/dev/restaurants", { name: "X", slug: "xx", managerName: "X", username: "xxx", password: "123456" }],
  ["POST", `/api/dev/billing/${HIKAY}/contracts`, { plan: "X", tables: 1, price: "1", signedOn: "2026-01-01", startsOn: "2026-01-01", endsOn: "2026-12-31" }],
  ["POST", "/api/dev/billing/contracts/x/payments", { paidOn: "2026-01-01", amount: "1", method: "Cash" }],
  ["DELETE", "/api/dev/billing/contracts/x"],
  ["DELETE", "/api/dev/billing/payments/x"],
]) {
  const r = await kusina(path, { method, body });
  check(r.status === 403, `${method} ${path} refused for a manager (${r.status})`);
}
for (const page of ["/admin/dev", "/admin/dev/billing", `/admin/dev/billing/${HIKAY}`]) {
  const r = await kusina(page);
  check(r.status === 307 && !r.text.includes("Contracts and payments"), `${page} sends a manager away`);
}

// --- A Kusina guest ordering Hikay's dishes --------------------------------
const guest = browser();
const tap = await guest("/t/p5mw2xqa");
const visit = tap.location?.match(/\/m\/([A-Za-z0-9_-]{22})/)?.[1];
check(!!visit, "Tapping Kusina's tag opens a menu");
const menu = await guest(`/m/${visit}`);
check(menu.text.includes("Kusina Dos") && !menu.text.includes("Chicken Inasal"), "The menu is Kusina's, not Hikay's");
const bad = await guest(`/api/visits/${visit}/order`, {
  method: "POST",
  body: { key: "aaaaaaaaaaaaaaaaaaaaaa", items: [{ dishId: "d_sisig", qty: 1 }] },
});
check(bad.status === 422, `Ordering Hikay's dish from Kusina's table refused (${bad.status})`);
const badPick = await guest(`/api/visits/${visit}/order`, {
  method: "POST",
  body: { key: "aaaaaaaaaaaaaaaaaaaaab", items: [{ dishId: kusinaDish, qty: 1, options: ["o_sisig_sharing"] }] },
});
check(badPick.status === 422, `Ordering Kusina's dish with Hikay's option refused (${badPick.status})`);

const after = fingerprint();
check(after === before, "Hikay's data is unchanged after all of it");
if (after !== before) {
  const [x, y] = [JSON.parse(before), JSON.parse(after)];
  for (const k of Object.keys(x)) if (x[k] !== y[k]) console.log(`      changed: ${k}
        before ${String(x[k]).slice(0, 300)}
        after  ${String(y[k]).slice(0, 300)}`);
}

console.log(failed ? `\n${failed} FAILED` : "\nAll passed");
process.exit(failed ? 1 : 0);
