# tappetite roadmap

Agreed with Justin 2026-10-19. Start from what tappetite has and build up, one
stage at a time, until it can run a whole restaurant. A stage gets built only
when the one before it is in use.

Stages 0–2 still fit "a layer on top of the POS" (see CLAUDE.md). Stage 3 is
where tappetite becomes the POS. When that starts, rewrite that section of
CLAUDE.md, because the "never replaces the POS" rule stops holding.

```
tappetite
│
├── STAGE 0: What we have now (ordering layer on top of the POS)
│   ├── Guest menu: NFC tap / QR, photos, sold-out, categories, search
│   ├── Guest ordering: nickname, rounds, notes, call waiter, ask for bill
│   ├── Waiter app: tables, orders by guest, add items, clear table
│   ├── Manager: dishes, categories, logo, staff, NFC/QR links, dashboard stats
│   └── Developer: restaurants, contracts, payments
│
├── STAGE 1: A better ordering layer (no POS work yet)
│   ├── Menu
│   │   ├── Dish options: sizes, add-ons, "less spicy", with prices
│   │   ├── Combos / set meals
│   │   ├── Menus by time: breakfast, lunch, happy hour
│   │   ├── (Filipino / English toggle: dropped, English only)
│   │   └── Allergens and dietary tags (spicy, pork-free, veg)
│   ├── Guest
│   │   ├── Live order status ("received", "being prepared", "served")
│   │   ├── Running bill total for the table, split view per guest
│   │   └── Rate the meal / feedback after the visit
│   ├── Waiter
│   │   ├── Mark items served
│   │   ├── Assign tables to waiters (sections)
│   │   └── Move or merge tables
│   └── Manager
│       ├── Best-sellers, slow movers, busy hours by day
│       └── Floor map of tables
│
├── STAGE 2: Kitchen (orders reach the cooks directly)
│   ├── Kitchen display (tablet): tickets by station, bump when done
│   ├── Ticket printing (Bluetooth / LAN thermal printer)
│   ├── Prep times per dish, late-ticket warnings
│   └── "Ready to serve" goes back to the waiter
│
├── STAGE 3: Bills and payments (replaces the POS's till work)
│   ├── Bill from the table's orders, split by guest or by item
│   ├── Discounts: senior / PWD (20%, required by law), promos
│   ├── Service charge, VAT
│   ├── Pay: cash, GCash, Maya, QRPH, card (via PayMongo or similar)
│   ├── Guest pays from the phone at the table
│   ├── Receipts (printed / e-receipt)
│   ├── Shift open/close, cash drawer count, Z-reading
│   └── BIR gate: a real POS needs BIR accreditation and a
│       Permit to Use before it can print official receipts
│
├── STAGE 4: Beyond dine-in
│   ├── Takeout / pickup ordering from the restaurant's link
│   ├── Counter / kiosk mode (no table)
│   ├── Reservations and waitlist ("text me when the table is ready")
│   └── GrabFood / foodpanda orders into the same queue
│
├── STAGE 5: Back office
│   ├── Inventory
│   │   ├── Ingredients and recipes (a dish uses X g of Y)
│   │   ├── Stock deducted as dishes sell
│   │   ├── Low-stock alerts, auto sold-out
│   │   └── Waste / spoilage log
│   ├── Purchasing: suppliers, purchase orders, deliveries received
│   ├── Costing: food cost % per dish, profit per dish
│   └── Staff
│       ├── Schedules and shifts
│       ├── Time in / out
│       ├── Tips and service charge sharing
│       └── Payroll export (SSS, PhilHealth, Pag-IBIG)
│
├── STAGE 6: Customers and marketing
│   ├── Guest accounts (optional), order history, favorites
│   ├── Loyalty points / stamps
│   ├── Vouchers and promos
│   ├── SMS / Messenger announcements
│   └── Customer stats: repeat guests, average spend
│
└── STAGE 7: Many branches / chains
    ├── Many branches under one owner
    ├── Central menu, branch-specific prices and sold-out
    ├── Reports comparing branches
    ├── Central purchasing / commissary
    ├── Roles: owner, area manager, branch manager
    └── Accounting exports (Xero / QuickBooks / Excel), BIR reports
```

## Stage 1: builds, in order

One build at a time. Each one is designed first on a Claude Design canvas
for Justin to see, then built on the local database and dev server on its
own branch, checked in Chrome on desktop and phone, then stops for Justin's
OK. It goes live (migration, merge, deploy) only when he says so; Build 1
went live 2026-10-21 that way.

| # | Build | What it touches | Size | Status |
|---|---|---|---|---|
| 1 | Dish options: sizes, add-ons, "less spicy", with prices | New option tables; menu editor, guest dish sheet, cart, waiter view, waiter "add items" | Large | Live 2026-10-21 (PR #56) |
| 2 | Combos / set meals ("Meal A + choose a drink") | Set meal lists of menu dishes, one pick each, with combo prices | Small | Built locally (branch `claude/stage1-combos`), waiting for Justin's OK |
| 3 | Mark served + live status for guests (Sent → Seen → Served) | A status per order line; waiter marks each item served, one by one; guest phone shows it | Medium | Not started |
| 4 | Running bill on the guest's phone, per guest and table total | Read-only, from existing orders | Small | Not started |
| 5 | Waiter sections: assign tables to waiters | Staff–table link; waiter sees their tables first | Small | Not started |
| 6 | Move / merge tables | Move a sitting to another table, or join two | Medium | Not started |
| 7 | Dietary tags: pork-free, veg, contains nuts | Dish tags + guest filter (spice level already exists) | Small | Not started |
| 8 | Menus by time: breakfast, lunch, happy hour | Time windows on categories | Small | Not started |
| 9 | ~~Filipino / English toggle~~ | Dropped: English only | — | Dropped |
| 10 | Feedback after the meal: stars + comment | New table, prompt on clear, list for the manager | Small | Not started |
| 11 | Better stats: slow movers, best-sellers by day of week | Extends the Stats page | Small | Not started |
| 12 | Floor map of tables (drag to arrange) | Position per table; layout view for waiter and manager | Large | Not started |

### Decided (Justin, 2026-10-19)

- #9 Filipino: **English only.** No language toggle, no Filipino dish names.
- #3 Status: the waiter marks **each item** served, one by one (not the whole round).

## The sit-down flow when staff have no phones (discussed 2026-11-17)

Agreed with Justin in a flow-critique discussion. Nothing here is built yet.
A separate session is redesigning the app for it; check what it built first.

### The real situation

- In most restaurants **staff may not carry phones**, and the restaurant won't
  buy them devices (that runs against what tappetite is for). Staff with phones
  or tablets is the rare case. **Both must work.**
- tappetite stays **a layer on top of the POS**: no new POS to pay for, no
  retraining staff. Its job: remove the guests' idle time with the menu booklet,
  and promote dishes. Someone still keys the order into the POS.
- **Who it's for:** sit-down restaurants and cafes. Not carinderias. Coffee
  shops get the **Single** menu (menu only), which they can also share on their
  socials so people browse before they come.
- The Single plan has no ordering, so it has no dashboard data. That's expected.
- The menu side is fine for now. The focus is the sit-down itself.

### The flow, no staff phones

1. **Seated, scan the table's own QR.** Every table has its own link, so a call
   or order always says which table it came from. Never one QR for all tables.
2. **Each guest builds a list on their own phone** (one name per phone).
   **Per guest stays:** students, co-workers and siblings pay for their own
   orders. A family where one person orders just uses one phone.
3. **Order:**
   - *With a central tablet or computer at the counter* running the table view:
     the guest sends; orders, calls and bill requests all land on that one
     screen, and the cashier keys the order into the POS.
   - *With none:* guests wave staff over and show the list on their phone. It
     still saves time: nobody forgets the order after calling, and the ingredient
     questions are answered on the menu.
4. **Bill:** each phone shows its own running total. With a central screen,
   staff can split per guest easily (Stage 1 Build 4).
5. **Leaving:** the table resets **automatically**, and a **manual "clear
   table"** stays available.

### Sold out

Better than the booklet: one tap on "sold out" instead of staff saying
"ay di available" over and over all night.

### Photos of the QR (ordering from home)

- Each scan opens a fresh 2-hour visit, so a photo of a table QR keeps working
  anywhere. **A device ban can't be done on the web:** the only handle is a
  cookie, and incognito or another browser gets past it.
- Rejected: staff must "open" a table first (adds staff work, the opposite of
  the goal).
- Agreed: **geo-lock on send.** The phone's location must be at the restaurant.
  Use the accuracy the phone reports (e.g. "±30 m"): send if the restaurant is
  within that reach, block if clearly far, ask to retry if the reading is too
  vague (e.g. ±200 m). Base circle about 50 m, adjustable per restaurant
  (tighter for a standalone shop, wider in a mall). If location is refused, the
  guest can still build the list and show it to staff. Test the default on real
  phones inside a real restaurant before trusting any number.
- Plus **opening hours**: orders only go through while the restaurant is open.
- Both apply only when sending orders is on.

### New settings per restaurant

- **Send orders:** on (central screen or staff devices) / off (guests show their phone).
- **Call staff button:** on / off.
- **Ask for bill button:** on / off (e.g. small pop-up cafes).
- Restaurant location pin and geo-lock radius; opening hours.

### Manager's NFC links page

- Add an **Open** button next to Copy and QR that opens the table's menu in a
  new window. It must open in a **preview** that does not start a visit or open
  a sitting, or the manager's click shows up on the staff table list.

### Open questions

- Auto-reset timing: one fixed rule, unless a kind of place needs longer
  (e.g. unlimited-time samgyup).
- Stage 1 builds that assume staff hold a device (#3 mark served per item,
  #5 waiter sections, #6 move/merge tables) only help the rare place with
  staff devices; weigh that before building them.
