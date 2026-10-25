# Cuts the stock illustration (converted by eps2svg.py) into layered parts for
# the animation. Every part keeps the same viewBox, so stacking them in this
# order rebuilds the picture exactly; the ones that move (heads, the waving arm)
# are their own layers.  Usage: python parts.py <full.svg.json> <out dir>
import json, sys, os
P = json.load(open(sys.argv[1]))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
VB = "990 1040 700 500"  # the couple's table, in the source's 3200x2000 coordinates
r = lambda a, b: list(range(a, b + 1))
PARTS = [
    ("c-back", [816]),
    ("c-wchair", r(817, 823)),
    ("c-wbody1", r(824, 830)),
    ("c-whead", r(831, 836)),
    ("c-wbody2", r(837, 841)),
    ("c-table", r(842, 845)),
    ("c-mbody1", r(846, 848) + r(850, 852)),
    ("c-mhead", r(853, 856)),
    ("c-mbody2", [857]),
    ("c-marm", [849, 858]),
    ("c-mcollar", [859]),
    ("c-mchair", r(860, 865)),
    ("c-props", r(866, 872)),
    ("c-weye", [873]),
    ("c-beer", r(874, 877)),
]
used = sorted(i for _, ids in PARTS for i in ids)
assert used == r(816, 877), "every path in the couple, once"

# The waiter is the bartender: his bottle (29-31) and wine glass (35-38) are
# left out so his hands are free, and legs are drawn below the vest.
WVB = "2260 950 280 600"
WAITER = [
    ("w-back", [13, 14]),            # shirt sleeves, behind the vest
    ("w-head", r(15, 19) + [21]),
    ("w-body", [20, 22, 23] + r(25, 28)),
    ("w-hands", [24, 32, 33, 34, 39, 40]),
]
MENU = [("menu", [903, 904])]   # the red menu book a guest holds at the other table (902 is her cuff)
MVB = "535 1250 115 80"

def write(name, ids, vb, extra=""):
    with open(os.path.join(out, name + ".svg"), "w") as o:
        o.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">')
        for i in ids:
            o.write(f'<path fill="{P[i]["fill"]}" d="{P[i]["d"]}"/>')
        o.write(extra + "</svg>")

for name, ids in PARTS:
    write(name, ids, VB)
for name, ids in WAITER:
    write(name, ids, WVB)
for name, ids in MENU:
    write(name, ids, MVB)

# legs: trousers from the vest's hem to the floor (y 1550), the art's navy
def leg(x, fill):
    return (f'<path fill="{fill}" d="M{x - 26} 1232 L{x + 26} 1232 L{x + 22} 1516 L{x - 20} 1516 Z"/>'
            f'<path fill="#182d4f" d="M{x - 22} 1512 L{x + 22} 1512 Q{x + 46} 1520 {x + 48} 1550 L{x - 22} 1550 Z"/>')
write("w-legL", [], WVB, leg(2356, "#2b478b"))
write("w-legR", [], WVB, leg(2408, "#233862"))

# Standing poses, for walking in. The seated upper bodies, lifted (woman 150,
# man 212 source units) so straight legs fit under them, with the arms that
# reach for the table left out and drawn hanging instead. The lift is undone
# as they sit, so the upper body lands exactly on the seated art.
SVB = "990 790 700 750"
def g(ids, dy, extra=""):
    paths = "".join(f'<path fill="{P[i]["fill"]}" d="{P[i]["d"]}"/>' for i in ids)
    return f'<g transform="translate(0 {-dy})">{paths}{extra}</g>'
SKIN = "#ffb27d"
w_hands = (f'<ellipse cx="1048" cy="1298" rx="15" ry="17" fill="{SKIN}"/>'
           f'<ellipse cx="1158" cy="1280" rx="14" ry="16" fill="{SKIN}"/>')
# his hanging arm in the art's shadow orange, so it reads against the shirt
m_arm = ('<path fill="#ed7d2b" d="M1512 1156 C1484 1198 1480 1272 1488 1330 L1524 1332 C1528 1270 1534 1212 1550 1170 Z"/>'
         f'<ellipse cx="1506" cy="1346" rx="17" ry="19" fill="{SKIN}"/>')
write("s-wbody", [], SVB, g([831, 832, 833, 834, 835, 836, 872, 838, 837, 839, 873], 150, w_hands))
write("s-mbody", [], SVB, g([857, 853, 854, 855, 856, 859], 212, m_arm))
def sleg(x, top, fill, shoe, toe, ankle):
    """A trouser leg from top to the ankle, and a shoe whose toe points toe (+1 right, -1 left)."""
    hem = 1500 if ankle else 1516
    leg = f'<path fill="{fill}" d="M{x - 23} {top} L{x + 23} {top} L{x + 19} {hem} L{x - 19} {hem} Z"/>'
    if ankle:
        leg += f'<path fill="{SKIN}" d="M{x - 12} 1498 L{x + 12} 1498 L{x + 12} 1518 L{x - 12} 1518 Z"/>'
    heel, tip = x - 18 * toe, x + 40 * toe
    leg += f'<path fill="{shoe}" d="M{heel} 1514 L{x + 12 * toe} 1514 Q{tip - 4 * toe} 1520 {tip} 1537 L{heel} 1537 Z"/>'
    return leg
write("s-wlegL", [], SVB, sleg(1082, 1128, "#2b478b", "#233862", 1, True))
write("s-wlegR", [], SVB, sleg(1122, 1128, "#233862", "#0f2549", 1, True))
write("s-mlegL", [], SVB, sleg(1532, 1100, "#2b478b", "#1b3051", -1, False))
write("s-mlegR", [], SVB, sleg(1580, 1100, "#233862", "#0f2549", -1, False))

# the plant by the bar, as decor that slides in
write("plant", r(710, 783), "2715 1280 285 260")
print("done")
