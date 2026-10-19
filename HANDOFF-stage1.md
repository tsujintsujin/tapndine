# Handoff: pricing, competitor check, roadmap, Stage 1 (2026-10-19)

## Done and live
- **New pricing** (PR #53, merged, deployed to tapndine.online, checked in Chrome
  on desktop and at 390px):
  Starter 5 tables ₱3,000/yr, Small Cafe 10 ₱5,000/yr, Standard 15 ₱7,100/yr,
  High-end 20 ₱8,500/yr. Extra tables on any plan: ₱35 per table a month (₱420/yr).
  - Code: `lib/plans.ts` (`PLANS`, `EXTRA_TABLE`), homepage pricing cards (4 across
    on desktop, stacked on a phone), extra-tables strip, hero "From" badge, meta
    description and FAQ all read from it.
  - Billing form (`app/admin/dev/billing/[id]/BillingBoard.tsx`): typing more
    tables than the plan covers adds ₱420 per extra table to the price.
    **Not checked in a browser**: there's no local developer login in the seed.
  - How Justin got there: ₱50 a table a month base, less per table on bigger
    plans, about ₱1,000 off a year for paying yearly, and a 5-table Starter for
    small cafes. Still under Qashier (₱590/mo) and MenuTiger (about ₱1,000/mo).
  - Existing contracts keep their old plan names and prices (contracts store
    their own copy).

## Competitor check (what others have that tapndine doesn't)
- Pay from the phone (GCash, Maya, QRPH): Nom, MenuTiger. Not for tapndine now (POS's job).
- Orders onto the POS bill, kitchen printing / KDS, GrabFood / foodpanda: Qashier. Not now.
- Dish options (sizes, add-ons): Nom. **Build 1.**
- Filipino language: Nom. **Justin: English only.**
- Free tiers (MenuTiger 10 tables, Nom ~10 customers a day); MenuTiger has a 14-day trial.
- tapndine's edge: NFC tap, orders by guest, links that close after 2 hours,
  call waiter / bill, waiters add items.

## Roadmap
`ROADMAP.md` (PR #54, branch `claude/roadmap`): Stages 0–7, from the ordering
layer to a whole-restaurant system, plus the Stage 1 build list with statuses.
Update a build's Status there when it ships.

### Decided by Justin
- Build 9 (Filipino / English toggle): **dropped, English only.**
- Build 3 (served status): the waiter marks **each item** served, one by one.
- Stage 1 is **local only**: local DB and dev server, its own branch, pushed as
  a backup. No live migrations, no deploys, no merge to main until Justin says so.
- One build at a time. Each one is checked in Chrome on desktop and phone, with
  screenshots, then stop for Justin's OK. Don't start the next build alone.

## Next (for the session that picks this up)
- **You build Stage 1, starting with Build 1: dish options** (sizes, add-ons,
  "less spicy", with prices). This session only planned it.
- Before coding, tell Justin your plan for the build in a few lines and wait
  for his OK (global CLAUDE.md rule 12). Run the design skills before any UI
  work.
- Rough shape: option groups + options per dish (new migration), chosen
  options saved on each `batch_items` line, shown in the menu editor, guest
  dish sheet, cart, waiter table view and waiter "add items". Combos (Build 2)
  should come out of a "choose one" group.
- Then Builds 2–12 in the order in `ROADMAP.md`, one at a time, each stopping
  for Justin's OK.

## Working notes
- Dev server: `cmd.exe //c start "tapndine dev 3390" cmd //k "cd /d D:\AIO Freelance\tapndine && npx next dev -p 3390"`,
  then http://localhost:3390. It's running in its own window now.
- Chrome won't resize while maximized. For a 390px check, load the page in a
  390px iframe on a localhost page.
- Local `main` is checked out by an old worktree
  (`C:\Users\justi\AppData\Local\Temp\claude\...\scratchpad\ship`), so
  `git switch main` fails. Branch from `origin/main` instead.
- Deploy (when one is allowed): `git archive origin/main` into a scratch
  folder on D:, copy `cloudflare-env.d.ts`, `npm ci`,
  `npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy`,
  then delete the folder.
- Old `HANDOFF.md` (2026-10-08, developer dashboard) and
  `HANDOFF-install-button.md` are older work, left untouched.
