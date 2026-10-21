# tapndine roadmap

Agreed with Justin 2026-10-19. Start from what tapndine has and build up, one
stage at a time, until it can run a whole restaurant. A stage gets built only
when the one before it is in use.

Stages 0–2 still fit "a layer on top of the POS" (see CLAUDE.md). Stage 3 is
where tapndine becomes the POS. When that starts, rewrite that section of
CLAUDE.md, because the "never replaces the POS" rule stops holding.

```
tapndine
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

Local only until Justin says otherwise: each build runs on the local database
and dev server, on its own branch. No live migrations and no deploys. One
build at a time, each checked in Chrome on desktop and phone, then stop for
Justin's OK before the next.

| # | Build | What it touches | Size | Status |
|---|---|---|---|---|
| 1 | Dish options: sizes, add-ons, "less spicy", with prices | New option tables; menu editor, guest dish sheet, cart, waiter view, waiter "add items" | Large | Built locally (branch `claude/stage1-dish-options`), waiting for Justin's OK |
| 2 | Combos / set meals ("Meal A + choose a drink") | Mostly a "choose one" option group from #1 | Small | Not started |
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
