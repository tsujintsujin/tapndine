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
- The plan to grow it step by step into a whole-restaurant system is in
  `ROADMAP.md` (stages, and the Stage 1 builds with their status).
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
  by the plan's table count), Menu (dishes, dish options, logo, menu colors), Categories, Staff.
  Menu colors: 10 palettes in `lib/palettes.ts` (`menu_palette`, migration
  0017; NULL = cocoa); `node scripts/palettes-check.ts` checks their contrast.

## Dish options (Stage 1 Build 1, live 2026-10-21)

- Per dish, a manager switches on Sizes, Add-ons and Spice choices (all off by
  default) and says whether the guest must pick a size. Spice choices only
  show on dishes with a spice level. Kept simple on purpose: Justin asked for
  add-ons behind one "+" line, not a page of option groups.
- The pick rules live once in `lib/options.ts` (server pricing and both
  phones use them); `node scripts/options-check.ts` checks them.
- An order line stores what was picked as text (`batch_items.options`), and
  its price already includes the extras.
- The homepage demo tag (`DEMO_TAG` in `lib/visits.ts`) says ordering is in
  the real version instead of "show it to your waiter".
- **Developers** (TSUJIN): every restaurant, billing (contracts and payments).

## Plans (lib/plans.ts)

Starter 5 tables ₱3,000/yr, Small Cafe 10 ₱5,000/yr, Standard 15 ₱7,100/yr,
High-end 20 ₱8,500/yr. Extra tables on any plan: ₱35 per table a month
(₱420/yr). Set 2026-10-19 (₱50 a table a month base, less for bigger plans and
for paying yearly; still under Qashier ₱590/mo and MenuTiger ~₱1,000/mo).
A restaurant's table limit comes from its current contract; with no contract,
a self sign-up trial gets 1 and one a developer added the biggest plan's count.

## Free trial (self sign-up, built 2026-11-01)

- Restaurants sign themselves up at `/start` with Google or a 6-digit code
  emailed through Brevo; the same page logs a trial manager back in (they have
  no password). Code in `lib/signup.ts`, limits in `lib/trial.ts`.
- A trial: every feature, 1 table (QR, no NFC), 2 staff logins besides the
  manager, 7 days (`businesses.trial_ends_at`). The menu starts empty, with
  placeholder rows on the manager's Menu/Categories and on the guest menu.
- When it ends: staff see `/trial-over` (plans + Book a call, + Messenger once
  `MESSENGER_URL` in `lib/trial.ts` is set) and every staff API refuses;
  guests' tags go to "Menu not available". Adding a contract in Billing ends
  the trial for good and everything opens again.
- Restaurants a developer adds keep working as before (no trial date).
- Google sign-in needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Worker
  secrets; the button hides without them). Redirect URI:
  `https://tapndine.online/api/auth/google/callback`.

## Stack and running it

- Next.js 16 on Cloudflare Workers (OpenNext) with D1. Schema in `migrations/`.
  (Moved off Next 15 on 2026-10-22: OpenNext refuses to build a Next major past
  its two-year support date.)
- Local DB: `npm run db:reset` (migrate + seed into `.localdb`). Seed restaurant
  is Hikay; its menu-only demo tag is `h3nd6vya` (also on live; the homepage's
  "Try the menu" opens it).
- Dev server: port 3300 may be taken by another app. Start one in its own
  window, e.g. `npx next dev -p 3390`, and use `localhost`, not `127.0.0.1`.
- Checks: `npx tsc --noEmit`, `node scripts/options-check.ts`,
  `node scripts/palettes-check.ts`, and with the dev
  server up, `node scripts/isolation-check.mjs http://localhost:3390`.
- Deploys are **manual** (`opennextjs-cloudflare build` + `deploy`) from a clean
  copy outside this folder, never by building here while `next dev` runs.
  Apply new D1 migrations to live (`wrangler d1 migrations apply tapndine --remote`)
  **before** deploying code that reads them. Back up live first
  (`wrangler d1 export tapndine --remote --output <file on D:>`).
- Credentials: `D:\AIO Freelance\Credentials\README.md` (tapndine section).
