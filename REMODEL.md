# Homepage remodel: "No more waiting at the table"

Draft 2026-10-25, for Justin to approve. tapndine is marketed as the end of
waiting at the table (for the menu, for a waiter, for answers about a dish), not
as an NFC menu app. NFC becomes one way in ("tap or scan") and a paid-plan perk.

Only claims the product makes today. Not claimed: allergen tags, live order
status, set meals (Build 2 is not live yet).

## Sections, top to bottom (`app/page.tsx`)

| # | Section | Headline | Copy | Picture |
|---|---|---|---|---|
| 1 | Hero | **No more idle waiting at the table.** (label above: *Digital menu & table ordering in the Philippines*) | Guests tap or scan the table and the whole menu is on their phone: photos, prices, spice, sizes, how many it feeds. They order when they're ready, and it goes straight to your waiter. | New hero loop, flat style (below) |
| 2 | Facts strip | — | Menu in one tap · Questions answered on the dish · Order when ready · Call the waiter with a tap. ("Menu link closes after 2 hours" is removed, and so is the "2 h, then the link closes" tile in the menu section; the FAQ answer on ordering from outside stays.) | icons |
| 3 | The race | **Same table. Same kitchen.** | One table waits for a menu, a waiter and answers. The other is already eating. *Illustration, not measured times.* | `videos/wait-race` (homepage cut ends before its closing frame) |
| 4 | The waits | **Every wait, gone.** | Five waits (Justin's three + two, agreed 2026-10-25): waiting for the menu → it opens with a tap or scan · waiting for the waiter to take the order → they send it from the table · waiting for the waiter to discuss a dish → photo, spice, how many it feeds, sizes and prices are on the dish · waiting for the waiter to come back with the menu to order more → the menu stays on their phone, they send another round · waving for the bill → Ask for the bill | list |
| 5 | Menu | **Every question, answered on the dish.** | Photo, price, spice, how many it feeds, sizes and add-ons. Search, filter, and see what's sold out before asking. | Menu booklet, remade flat |
| 6 | Waiter | **Your waiters stop answering and start serving.** | Orders arrive sorted by guest. The waiter reads it back, keys it into your POS, and brings the food. | Waiter orders, remade flat |
| 7 | Statistics, as a bonus | **A bonus: see what sells, and when you're busy.** | Presented as an extra on top of the main job, not a reason to buy | real dashboard recording, kept |
| 8 | How it works | **From sitting down to ordering, in four steps.** | Tap or scan · Pick dishes · Send to waiter · Waiter confirms | real phone screens, kept |
| 9 | Statement | as now ("Guests order when they're ready…") | | |
| 10 | Pricing | as now | "Every plan includes" lists the functions only (menu with photos, orders to the waiter, logins, statistics); NFC is not a plan item: free tags for local restaurants, mentioned once (see Open) | |
| 11 | FAQ | | Rewrite "What is tapndine?" around waiting; add "Will guests still talk to my waiters?" (Only as much as they want: the waiter greets, serves and confirms the order. Nobody has to flag a waiter down for a menu, a question or another round.) | |
| 12 | Footer | | + Facebook and TikTok icons. Until the pages exist, clicking one shows "Coming soon" | icons |

SEO: description becomes "Digital menu and table ordering for Philippine
restaurants and cafes. Guests see every dish and order from the table, so nobody
waits for a menu or a waiter. From ₱3,000 a year." Share image re-rendered (now
"NFC table menus…").

## Animations, remade in the wait-race flat style

Same art (Justin's stock illustration), same rules: zoomed out, people and the
process, real dish data, a 2-second check with Justin before each full build.

1. **Hero loop** (6–8 s, loops): one happy table: they sit, a dish card pops,
   food arrives. No NFC close-up.
2. **Menu booklet**: the waiter's thick red booklet lands with a thud; then each
   guest at the three-person table has the dish cards on their own phone.
3. **Waiter orders**: the three-person table (it is in the art); each guest
   sends, and the order flies to the waiter as a card with their name, sorted
   by guest.
4. **Dashboard stats**: kept as the real recording (real numbers on a real screen).

## Order

1. Justin approves this copy. 2. Animations 1–3, one at a time. 3. Build the
page (design skills first, desktop + 390 px checked). 4. Share image, SEO.
5. Facebook and TikTok, alongside.

## Open

- Headline: "No more idle waiting at the table." (Justin, 2026-10-25). The wait-race closing frame still says "No more waiting at the table."; match it when it goes on the page.
- Social posts in Taglish or English (the site stays English).
- **NFC tags: a freebie for local restaurants** (Justin, 2026-10-25). Plans are sold on what tapndine does, with QR codes; NFC tags are not a plan item and have no price. Local restaurants get them free, as a bonus. The page says so once, near pricing. `lib/plans.ts` does not change; the pricing cards, "Every plan includes", the trial FAQ ("NFC tags come with a paid plan") and `app/terms/page.tsx` do. Local = Davao City, Davao del Sur, Davao del Norte and Davao de Oro (Justin, 2026-10-25: "Davao region, de Oro, del Sur, del Norte"). Page line: "Free NFC tags for restaurants in Davao City, Davao del Sur, Davao del Norte and Davao de Oro."
- Stock art licence: if Freepik free, the site needs a credit line.
