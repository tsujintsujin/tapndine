# tapndine

Digital menu and table ordering for restaurants and cafes in the Philippines.
Guests tap an NFC tag (or scan a QR code) on their table, the menu opens in the
phone's browser, and their order goes to the waiter's phone, sorted by guest.
Live at https://tapndine.online. Built by TSUJIN IT Solutions (Justin).

## What tapndine is not: it sits on top of the restaurant's POS

- tapndine is a **layer on top of whatever the restaurant already runs**. The
  waiter reads the order on tapndine and enters it into the restaurant's own
  POS. tapndine never replaces or takes over the POS.
- So no kitchen display, ticket printing, bills, receipts, payments or
  accounting exports. The POS has those. The dashboard counts orders sent,
  not money collected.
- A POS or other system gets built only if a client asks for one, as separate work.
- Judge a feature by how well it gets the order to the waiter and helps them
  key it into the POS.

## Decided on purpose (don't "fix")

- The waiter's screen has no sound, vibration or push notification for new
  orders. It refreshes every 5 seconds while open. Tables with something new
  show a "New order" / "Calling waiter" / "Wants the bill" badge that clears
  when a waiter opens the table.
- A menu link closes 2 hours after the tap, or when the waiter clears the table.

## Who uses it

- **Guests**: no account. A nickname, asked the first time they send.
- **Waiters**: Tables, a table's orders by guest, add items, clear the table.
- **Managers**: plus Dashboard, NFC links (tables and their tag links, capped
  by the plan's table count), Menu (dishes, logo), Categories, Staff.
- **Developers** (TSUJIN): every restaurant, billing (contracts and payments).

## Plans (lib/plans.ts)

Standard Cafe 10 tables ₱2,100/yr, Growth 15 tables ₱2,600/yr, Pro 20 tables
₱3,000/yr. Free 1-week trial: the full system with QR codes, no NFC tags.
A restaurant's table limit comes from its current contract; with no contract
(a trial) it is the biggest plan's count.

## Stack and running it

- Next.js 15 on Cloudflare Workers (OpenNext) with D1. Schema in `migrations/`.
- Local DB: `npm run db:reset` (migrate + seed into `.localdb`). Seed restaurant
  is Hikay; its menu-only demo tag is `h3nd6vya` (also on live; the homepage's
  "Try the menu" opens it).
- Dev server: port 3300 may be taken by another app. Start one in its own
  window, e.g. `npx next dev -p 3390`, and use `localhost`, not `127.0.0.1`.
- Deploys are **manual** (`opennextjs-cloudflare build` + `deploy`) from a clean
  copy outside this folder, never by building here while `next dev` runs.
  Apply new D1 migrations to live (`wrangler d1 migrations apply tapndine --remote`)
  **before** deploying code that reads them.
- Credentials: `D:\AIO Freelance\Credentials\README.md` (tapndine section).
