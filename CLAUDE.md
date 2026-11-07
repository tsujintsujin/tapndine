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

- Staff pages refresh every 5 seconds. Tables with something new show a "New
  order" / "Calling waiter" / "Wants the bill" badge that clears when a waiter
  opens the table. Managers also get a count on the Tables tab, staff get it in
  the browser tab's title, and a new order or call chimes (`app/admin/Alerts.tsx`,
  `node scripts/alerts-check.ts`; Justin asked for these 2026-11-02). Browsers
  block sound until a first tap on the page, so the page asks for one. No
  vibration or push notification: a locked phone stays silent.
- A menu link closes 2 hours after the tap, or when the waiter clears the table.

## Who uses it

- **Guests**: no account. A nickname, asked the first time they send.
- **Waiters**: Tables, a table's orders by guest, add items, clear the table.
- **Managers**: plus Dashboard, Menu links (tables and their tag links, capped
  by the plan's table count), Menu (dishes, dish options), Homepage (the hero
  and the Featured and New rows, beside a phone preview at `/m/preview`; a row
  with more than 3 dishes swipes and goes round), Categories, Staff,
  Settings (logo, menu colors). Menu Designs B and C are hidden until they are
  reworked: no picker in Settings, every guest gets Design A (`lib/menu.ts`),
  whatever a restaurant's `menu_design` says. Their code stays.
  Menu colors: 10 palettes in `lib/palettes.ts` (`menu_palette`, migration
  0017; NULL = cocoa); `node scripts/palettes-check.ts` checks their contrast.

## Sub-categories (built 2026-11-02)

- A category can sit under a main one (`categories.parent_id`, migration 0020),
  one level deep. A main category's dishes on the guest menu include its
  sub-categories'; Designs B and C just see the main categories.
- Guests, phone: the top row of tabs has only the main categories, each with
  an icon picked from its name, English or Filipino (`app/components/CategoryIcon.tsx`;
  a chef's hat when nothing matches). A category with subs gets a second row
  of tabs under its heading, which sticks under the header while the guest is
  in it. (A single row with every sub as its own tab was tried and replaced,
  2026-11-03.) Desktop rail: subs indented under the open main one. Home:
  category tiles, then a centred "Whole menu" button. No dish counts anywhere
  on the guest menu (Justin, 2026-11-03). Managers: "Sits under" on the
  category page and in the add dialog. Deleting a main one makes its subs
  main ones.

## Dish options (Stage 1 Build 1, live 2026-10-21)

- Per dish, a manager switches on Sizes, Add-ons and Spice choices (all off by
  default) and says whether the guest must pick a size. Spice choices only
  show on dishes with a spice level. Kept simple on purpose: Justin asked for
  add-ons behind one "+" line, not a page of option groups.
- The pick rules live once in `lib/options.ts` (server pricing and both
  phones use them); `node scripts/options-check.ts` checks them.
- Sizes can be called something else per dish (`dishes.size_label`, migration
  0021): a noodle dish where the guest picks Pork, Chicken or Seafood shows
  "Meat", not "Size", to guests and waiters. Empty is "Size".
- Guest search (`lib/search.ts`, `node scripts/search-check.ts`) matches word
  starts in names, categories, choices and descriptions, a short English and
  Filipino synonym list ("kape", "drinks"), and typos in words of 6+ letters.
- An order line stores what was picked as text (`batch_items.options`), and
  its price already includes the extras.
- The homepage demo tag (`DEMO_TAG` in `lib/visits.ts`) says ordering is in
  the real version instead of "show it to your waiter".
- **Developers** (TSUJIN): every restaurant, billing (contracts and payments).

## Plans (lib/plans.ts)

Single ₱3,000/yr (menu only: 0 tables, no ordering), Standard 10 tables ₱5,000/yr,
Grand 20 tables ₱8,500/yr (no Enterprise: extra tables cover bigger places). Each plan
card lists what it includes; Standard is drawn dark as the highlighted plan. Extra tables on Standard or Grand: ₱35 per table a month (₱420/yr). Set by
Justin 2026-11-07.
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
- Google sign-in: client "tapndine web" in Google Cloud project `tapndine-513409`,
  in production, on Worker secrets `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (the
  button hides without them). Redirect URI:
  `https://tapndine.online/api/auth/google/callback`. It asks Google for email only.

## Stack and running it

- Next.js 16 on Cloudflare Workers (OpenNext) with D1. Schema in `migrations/`.
  (Moved off Next 15 on 2026-10-22: OpenNext refuses to build a Next major past
  its two-year support date.)
- Local DB: `npm run db:reset` (migrate + seed into `.localdb`). Seed restaurant
  is Hikay; its demo tag is `b3744013e9f6` (also on live, set 2026-11-07; the
  homepage's "Try the menu" opens it).
- Dev server: port 3300 may be taken by another app. Start one in its own
  window, e.g. `npx next dev -p 3390`, and use `localhost`, not `127.0.0.1`.
- Checks: `npx tsc --noEmit`, `node scripts/options-check.ts`,
  `node scripts/palettes-check.ts`, `node scripts/search-check.ts`, and with the dev
  server up, `node scripts/isolation-check.mjs http://localhost:3390`.
- Deploys are **manual** (`opennextjs-cloudflare build` + `deploy`) from a clean
  copy outside this folder, never by building here while `next dev` runs.
  Apply new D1 migrations to live (`wrangler d1 migrations apply tapndine --remote`)
  **before** deploying code that reads them. Back up live first
  (`wrangler d1 export tapndine --remote --output <file on D:>`).
- Credentials: `D:\AIO Freelance\Credentials\README.md` (tapndine section).
