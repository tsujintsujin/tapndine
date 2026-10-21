# Handoff: Stage 1 (updated 2026-10-22)

## Live now (tapndine.online)
- **Build 1, dish options** (PR #56, review fixes PR #57). Per dish, a manager
  switches on Sizes, Add-ons and Spice choices and says whether the guest must
  pick a size. Guests pick sizes in the dish sheet; add-ons and spice sit
  behind one "+" line. Waiters see the picks under each line and get a picker
  when they add such a dish. Designed first on the Claude Design canvas
  "tapndine dish options" (https://claude.ai/artifact/JaG4rLty9h3qKi8GCy5RgT),
  which Justin approved, including his two changes: add-ons behind one "+"
  line, and Sizes / Add-ons / Spice each switchable on/off per dish, with
  "Guest must pick a size" Yes/No.
  - Migration 0014 applied to live 2026-10-21, after a backup and a dry run on
    a copy of live. No live dish has options yet; a manager switches them on.
  - **Not checked by us on live:** the dish editor and waiter screens (they
    need a real staff login, which only Justin types). All of it was checked
    locally in Chrome on desktop and at 390px.
- **Demo menu wording** (PR #57): the homepage demo's My order says ordering
  works in the real version. Real "Not at a table" menus keep the old line.
- **Next.js 16.4.2** (PR #58): OpenNext stopped building Next 15 (past its
  two-year support), so deploys needed an override flag. Upgraded; builds
  without the flag. Checked locally end to end and live (homepage, demo menu,
  My order, login, redirects) on desktop and 390px.

## Review of Build 1 (2026-10-22)
Fixed: lines the menu no longer offers are taken out of a guest's order with
a notice; a send refused because the menu changed reloads the menu and says
so; Remove names the exact variant and the change log keeps it; the waiter
picker shows the right default from the first frame; switching a set on and
off no longer counts as an unsaved change; a doubled option id can't fail a
save. Left as is (low risk): the dish_options query is repeated in four
places, and the size radios don't move with arrow keys.

## Decided by Justin
- Build 9 (Filipino / English toggle): dropped, English only.
- Build 3 (served status): the waiter marks each item served, one by one.
- One build at a time: design it on a Claude Design canvas first, build it
  locally on its own branch, check it in Chrome on desktop and phone with
  screenshots, stop for his OK. It goes live only when he says so.

## Next
- **Build 2: combos / set meals** ("Meal A + choose a drink"). Build 1 has
  only three fixed kinds (size, add-on, spice), so a combo needs a new kind:
  a "choose one" list the manager names per dish ("Drink": Iced tea, Coke,
  Mango shake +₱30). Justin asked to see the design first: add a Build 2 row
  to the same canvas, then plan, then wait for his OK.
- Then Builds 3–12 in `ROADMAP.md`, one at a time.

## Working notes
- Dev server: `cmd.exe //c start "tapndine dev 3390" cmd //k "cd /d D:\AIO Freelance\tapndine && npx next dev -p 3390"`,
  then http://localhost:3390. Seed logins are in `seed/dev.sql`.
- Chrome won't resize while maximized. For a 390px check, load the page in a
  390px iframe on a localhost page.
- Branch from `origin/main` (`git switch -c <branch> origin/main`).
- Deploy: `git archive origin/main` into a folder on D:, copy
  `cloudflare-env.d.ts`, `npm ci`, `npx opennextjs-cloudflare build` and
  `deploy`, then delete the folder. The live backup from 2026-10-21 is in the
  session scratchpad under `D:\Temp\claude\D--AIO-Freelance-tapndine\`.
- To dry-run a migration on a copy of live: the D1 export lists rows before
  their tables, so reorder it (pragmas, CREATE TABLEs, INSERTs, then indexes)
  before importing into a scratch `--persist-to` folder.
- Old `HANDOFF.md` (2026-10-08) and `HANDOFF-install-button.md` describe
  older, finished or abandoned work (the install button was never shipped and
  its code is gone).
