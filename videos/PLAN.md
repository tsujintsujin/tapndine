# Homepage animation plan

Agreed with Justin 2026-10-06. Each piece is a HyperFrames project in `videos/<name>/`,
rendered to WebM + MP4 and dropped into `app/page.tsx`. Headlines and buttons stay real
HTML; only the pictures move. Everything falls back to a still frame under
`prefers-reduced-motion`.

Look: realistic, not flat drawing. Real app screenshots inside glossy phone frames with
proper glass, edge highlights and soft contact shadows; a warm photographic table surface;
depth of field on the background; slow camera drift so nothing is ever fully static.

## 1. Hero loop: `videos/hero-loop/` (building first)

Square 1080×1080, 10 s, loops seamlessly. Replaces the right-hand picture in the hero.

| Time | Beat |
|---|---|
| 0–1.5 s | Table top with the cocoa "tap" tag. The guest phone glides in and touches it; orange rings ripple out. |
| 1.5–3 s | The screen wakes; the menu home opens. |
| 3–5.5 s | Menu scrolls, a finger taps a dish, the dish sheet slides up, "Add" pressed, cart count bumps 1 → 2. |
| 5.5–7 s | "Send order" pressed; "Order sent" screen with its check mark. |
| 7–9 s | The waiter's phone slides in beside it; the new order card drops into the table view with a ring-ring badge. |
| 9–10 s | Both phones settle back to the opening pose so the loop joins invisibly. |

Background all the way through: food doodle plates drift slightly; "From ₱1,800" badge stamps in.

Screens needed (fresh captures from the sample restaurant at phone width): menu home, full
menu (tall, for the scroll), dish sheet, cart with 2 items, order sent, waiter table view
with the new order.

## 2. Orders reach the waiter: `videos/waiter-orders/`

~5 s loop. Three guest bubbles; each guest's order flies into its own group on the waiter's
phone, then gets ticked "served". Shows "sorted by guest".

## 3. Statistics: CSS, no video

On scroll into view, once: the busy-hours heatmap fills in hour by hour and the sales bars grow.

## 4. Your whole menu: `videos/menu-booklet/`

~6 s, plays once on first scroll into view, holds on the last frame. Replaces the two phones
with one.

| Time | Beat |
|---|---|
| 0–1.5 s | A thick, worn paper menu (real sample-restaurant dishes, dense text, a sauce stain) flips through its many pages. |
| 1.5–2.5 s | It snaps shut; the page stack compresses into one slim slab and the cover colour becomes the cocoa phone frame. |
| 2.5–3 s | The phone screen lights up on the menu home. |
| 3–5.5 s | The screen scrolls the whole menu, photos and prices, and the "Seafood" chip is tapped. |
| end | Holds on the phone. |

## Left alone on purpose

"How it works" (static on purpose: shows it's easy), facts row, pricing, statement, footer.
