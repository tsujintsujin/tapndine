// 30 days of made-up, finished sittings for the sample restaurant, plus a
// few tables ordering right now, so the manager's dashboard has something to
// show locally. Fake data.
// Run `npm run db:seed-history` (after db:reset). Re-running replaces it;
// every row it makes has an id starting "hist-" (the extra tables
// are "tbl_hikay_3" to "_8", added once).

const DAY = 86400000;
const TZ = 8 * 3600000; // Manila
const now = Date.now();
const today = Math.floor((now + TZ) / DAY);

// Seeded, so every run makes the same history.
let seed = 42;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const out = [
  "DELETE FROM item_changes WHERE id LIKE 'hist-%';",
  "DELETE FROM batch_items WHERE id LIKE 'hist-%';",
  "DELETE FROM batches WHERE id LIKE 'hist-%';",
  "DELETE FROM guests WHERE id LIKE 'hist-%';",
  "DELETE FROM visits WHERE sitting_id LIKE 'hist-%';",
  "DELETE FROM sittings WHERE id LIKE 'hist-%';",
];

// The sample restaurant has two tables; a dashboard wants a real floor.
for (let t = 3; t <= 8; t++) {
  out.push(`INSERT OR IGNORE INTO tables (id, business_id, label, sort) VALUES ('tbl_hikay_${t}', 'biz_hikay', 'Table ${t}', ${t});`);
}

// Lunch and dinner rushes, a quiet afternoon. Hours in restaurant time.
const HOURS = [10, 11, 11, 12, 12, 12, 13, 13, 14, 15, 17, 18, 18, 19, 19, 19, 20, 20, 21];
const TABLES = Array.from({ length: 8 }, (_, i) => `tbl_hikay_${i + 1}`);
// Some dishes are just more popular: the id's third letter sets a weight.
const order = (batch, n, k) =>
  `INSERT INTO batch_items (id, batch_id, dish_id, name, price_cents, qty, sort)
   SELECT 'hist-${n}-' || id, '${batch}', id, name, price_cents, 1 + abs(random()) % 2, 0 FROM dishes
   WHERE business_id = 'biz_hikay' AND available = 1 AND EXISTS (SELECT 1 FROM batches WHERE id = '${batch}')
   ORDER BY (abs(random()) % 1000) / (1.0 + unicode(substr(id, 3, 1)) % 6 + best_seller * 4) LIMIT ${k};`;

let n = 0;
for (let day = today - 29; day <= today; day++) {
  const weekday = (day + 4) % 7;
  // Per table, per day.
  const groups = weekday === 5 || weekday === 6 || weekday === 0 ? int(4, 6) : int(2, 4);
  for (const table of TABLES) {
    for (let g = 0; g < groups; g++) {
      const opened = day * DAY - TZ + pick(HOURS) * 3600000 + int(0, 59) * 60000;
      const stay = int(35, 95) * 60000;
      if (opened + stay > now) continue; // only finished sittings
      const s = `hist-s${++n}`;
      out.push(
        `INSERT OR IGNORE INTO sittings (id, business_id, table_id, opened_at, closed_at) VALUES ('${s}', 'biz_hikay', '${table}', ${opened}, ${opened + stay});`
      );
      const guests = int(1, 4);
      let firstSend = opened + int(3, 14) * 60000;
      for (let p = 1; p <= guests; p++) {
        const guest = `hist-g${++n}`;
        out.push(
          `INSERT INTO guests (id, sitting_id, phone_id, number, created_at) SELECT '${guest}', '${s}', '${guest}', ${p}, ${firstSend} WHERE EXISTS (SELECT 1 FROM sittings WHERE id = '${s}');`
        );
        const batch = `hist-b${++n}`;
        const sent = firstSend + p * int(0, 2) * 60000;
        out.push(`INSERT INTO batches (id, sitting_id, guest_id, sent_at) SELECT '${batch}', '${s}', '${guest}', ${sent} WHERE EXISTS (SELECT 1 FROM guests WHERE id = '${guest}');`);
        out.push(order(batch, ++n, int(2, 4)));
        // Some phones send a second round later.
        if (rand() < 0.25) {
          const b2 = `hist-b${++n}`;
          out.push(`INSERT INTO batches (id, sitting_id, guest_id, sent_at) SELECT '${b2}', '${s}', '${guest}', ${sent + int(20, 30) * 60000} WHERE EXISTS (SELECT 1 FROM guests WHERE id = '${guest}');`);
          out.push(order(b2, ++n, int(1, 2)));
        }
        // The waiter reads it back and one line comes off.
        if (rand() < 0.12) {
          const c = `hist-c${++n}`;
          out.push(
            `INSERT INTO item_changes (id, item_id, sitting_id, dish_id, name, old_qty, new_qty, from_guest, staff_id, changed_at)
             SELECT '${c}', id, '${s}', dish_id, name, qty, ${rand() < 0.7 ? 0 : 1}, 1, 'stf_ana', ${sent + 4 * 60000}
             FROM batch_items WHERE batch_id = '${batch}' ORDER BY id LIMIT 1;`,
            `DELETE FROM batch_items WHERE id = (SELECT item_id FROM item_changes WHERE id = '${c}' AND new_qty = 0);`,
            `UPDATE batch_items SET qty = 1 WHERE id = (SELECT item_id FROM item_changes WHERE id = '${c}' AND new_qty = 1);`
          );
        }
      }
    }
  }
}

// Three tables still eating: open sittings whose guests ordered in the last hour.
for (const [table, minsAgo, guests] of [["tbl_hikay_2", 48, 3], ["tbl_hikay_5", 22, 2], ["tbl_hikay_7", 6, 4]]) {
  const s = `hist-open-${table}`;
  const opened = now - minsAgo * 60000;
  // A table can have one open sitting; a real one wins.
  out.push(
    `INSERT OR IGNORE INTO sittings (id, business_id, table_id, opened_at, closed_at) SELECT '${s}', 'biz_hikay', '${table}', ${opened}, NULL WHERE NOT EXISTS (SELECT 1 FROM sittings WHERE table_id = '${table}' AND closed_at IS NULL);`
  );
  for (let p = 1; p <= guests; p++) {
    const guest = `hist-og${++n}`;
    const sent = Math.min(now - 60000, opened + (4 + p * 2) * 60000);
    out.push(`INSERT INTO guests (id, sitting_id, phone_id, number, created_at) SELECT '${guest}', '${s}', '${guest}', ${p}, ${sent} WHERE EXISTS (SELECT 1 FROM sittings WHERE id = '${s}');`);
    const batch = `hist-ob${++n}`;
    out.push(`INSERT INTO batches (id, sitting_id, guest_id, sent_at) SELECT '${batch}', '${s}', '${guest}', ${sent} WHERE EXISTS (SELECT 1 FROM guests WHERE id = '${guest}');`);
    out.push(order(batch, ++n, int(2, 3)));
  }
}

process.stdout.write(out.join("\n") + "\n");
