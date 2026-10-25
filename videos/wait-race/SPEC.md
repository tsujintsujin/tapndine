# wait-race: the same couple, with and without tapndine

Flow by Justin 2026-10-25 (his sheet, plus the payoff, clocks and closing frame
he agreed). Homepage animation, later a social cut. Square 1080×1080, 28 s,
silent, loops on the page. The clocks are an illustration; the page says so.

The one thing: the tapndine table is eating while the other table is still
waiting. The kitchen takes the same time; the order just gets there sooner.

## Look

- Art: Justin's stock flat illustration (`source/`), cut into layers by
  `source/parts.py`. Same couple on both sides. The bartender is the waiter
  (bottle and glass dropped, legs drawn). Standing poses are the seated upper
  bodies lifted, arms drawn hanging, legs drawn; the lift is undone as they sit.
- Palette from the art: navy `#233862`, blue `#8cb4f4`, orange `#f99746`. Brand
  orange `#f19a33` only on "With tapndine" and the closing frame.
- Montserrat 700–800, smallest text 26 px (about 9 px on a 390 px phone).
- Every line holds long enough to read (0.5 s + 0.3 s a word); that is what sets the 28 s.
- Zoomed out: the process at the table. The phone and the table stand are small props.

## Rows

| s | Clock | Without tapndine | With tapndine |
|---|---|---|---|
| 0–2.2 | 0 | Both walk in standing; blob, table, chairs and plant slide in; they sit (the art's beer is left off: the table starts empty) | same |
| 2.2 | 1 | Look round for a waiter · *Looking for a waiter* | He taps the table stand with his phone; Sisig, Kare-Kare, Chicken Inasal cards (photo, spice, feeds, price) each Add → into the order; Send flies it to the waiter · *Tap, pick, send* |
| 6.8 | 3 | Waiter brings the menu: "Call me when you're ready to order." · *Here's the menu* | Waiter comes with his phone: "Sisig, Kare-Kare and Inasal?" — "Yes!" · *The waiter reads it back* |
| 9.8 | 4 | His hand up: "Excuse me!" · *Calling the waiter* | Waiter leaves · *Sent to the kitchen* |
| 11.6 | 6 | Waiter comes; she asks "Is this spicy? How big is it?" · *Asking about a dish* | "Cooking · 3 dishes" chip steams; they chat · *The kitchen is cooking* |
| 14.4 | 7 | "Quite spicy. Good for two to three." — "And the Kare-Kare?" · *Back and forth* | He holds the phone up, both look · *Browsing for more* |
| 17.4 | 8 | Waiter writes on a notepad · *Still taking the order* | Waiter brings two plates, sets them down, leaves · *Food's here* |
| 19.4 | 10 | Waiter takes the menu and leaves · *Orders sent to kitchen* | Steam, nods, his hand to the plate · *Eating* |
| 21.0 | 12 | Empty table, they wait · *Waiting, with nothing* | "+ Mango Shake" flies to the waiter · *Adding a second round* |
| 22.8 | 13 | *Still waiting* | *Already eating* |
| 24.8–28 | | Closing frame: "No more idle waiting at the table." + tapndine wordmark (not on the homepage loop, which ends at 24.6 s; for the social cut) | |

Dish data from the sample restaurant (seed/dev.sql): Pork Sisig ₱320, spice 3,
2–3 people; Kare-Kare ₱495, not spicy, 2–4; Chicken Inasal ₱245, not spicy, 1;
Mango Shake ₱135.

Reduced motion: the page shows t = 24.5 s (both final captions).

BANNED: phone close-ups, glow/particles, everything fading in, three cards in a
row, a docked logo.
