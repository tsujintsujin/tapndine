"""Builds the tapndine wordmark: "tapndine." set in Montserrat ExtraBold (800),
the homepage header's letters, outlined, with a tap ripple over the i's dot.

Montserrat-800 is instanced from the variable woff2 that next/font ships
(OFL licence, logo use allowed). Tracking matches the header's tracking-tight
(-0.025em); pair kerning comes from the font's GPOS like the browser applies.
Writes tapndine-logo.svg (cocoa + orange), tapndine-logo-black.svg,
tapndine-logo-white.svg and prints the two path strings for app/components/Wordmark.tsx.
"""
import math
import re
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).parent
TEXT = "tapndine"
TRACK = -25  # tracking-tight, in font units (upm 1000)
COCOA, ORANGE = "#3B2E25", "#F19A33"

font = TTFont(HERE / "montserrat-800.ttf")
gs, cmap = font.getGlyphSet(), font.getBestCmap()
ASC = 820  # top of the ripple fits under this; baseline sits at y=ASC in the SVG


def kern_pairs():
    """First/second glyph -> x advance adjustment from GPOS 'kern' PairPos lookups."""
    gpos = font["GPOS"].table
    idx = {i for fr in gpos.FeatureList.FeatureRecord if fr.FeatureTag == "kern"
           for i in fr.Feature.LookupListIndex}
    out = {}
    for i in sorted(idx):
        lk = gpos.LookupList.Lookup[i]
        subs = lk.SubTable
        if lk.LookupType == 9:
            subs = [s.ExtSubTable for s in subs]
        for st in subs:
            if st.LookupType != 2:
                continue
            firsts = st.Coverage.glyphs
            if st.Format == 1:
                for g1, ps in zip(firsts, st.PairSet):
                    for pv in ps.PairValueRecord:
                        v = getattr(pv.Value1, "XAdvance", 0) or 0
                        out.setdefault((g1, pv.SecondGlyph), v)
            else:
                c1, c2 = st.ClassDef1.classDefs, st.ClassDef2.classDefs
                for g1 in firsts:
                    row = st.Class1Record[c1.get(g1, 0)]
                    for g2 in font.getGlyphOrder():
                        rec = row.Class2Record[c2.get(g2, 0)]
                        v = getattr(rec.Value1, "XAdvance", 0) or 0
                        if v:
                            out.setdefault((g1, g2), v)
    return out


KERN = kern_pairs()


def glyph_path(name, x):
    """SVG path of glyph `name` at pen x, y flipped, baseline at ASC."""
    sp = SVGPathPen(gs)
    gs[name].draw(TransformPen(sp, (1, 0, 0, -1, x, ASC)))
    return re.sub(r"(\d)\.0(?!\d)", lambda m: m.group(1), sp.getCommands())  # 303.0 -> 303


def f(n):
    return f"{n:.1f}".rstrip("0").rstrip(".")


def band(cx, cy, ro, ri, a0, a1):
    """Ring segment with round caps, SVG angles (y down)."""
    p = lambda r, a: (cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
    rc = (ro - ri) / 2
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = p(ro, a0), p(ro, a1), p(ri, a1), p(ri, a0)
    large = 1 if a1 - a0 > 180 else 0
    return (f"M{f(x0)} {f(y0)}A{f(ro)} {f(ro)} 0 {large} 1 {f(x1)} {f(y1)}A{f(rc)} {f(rc)} 0 0 1 {f(x2)} {f(y2)}"
            f"A{f(ri)} {f(ri)} 0 {large} 0 {f(x3)} {f(y3)}A{f(rc)} {f(rc)} 0 0 1 {f(x0)} {f(y0)}Z")


letters, x, prev = [], 0.0, None
for ch in TEXT:
    g = cmap[ord(ch)]
    if prev:
        x += KERN.get((prev, g), 0)
    letters.append(glyph_path(g, x))
    if ch == "i":
        # the dot is the contour sitting above the x-height
        rec = DecomposingRecordingPen(gs)
        gs[g].draw(rec)
        dots, cur = [], []
        for op, args in rec.value:
            cur.append((op, args))
            if op in ("closePath", "endPath"):
                b = BoundsPen(gs)
                for o, a in cur:
                    getattr(b, o)(*a)
                if b.bounds[1] > 560:
                    dots.append(b.bounds)
                cur = []
        dx0, dy0, dx1, dy1 = dots[0]
        dot_cx, dot_cy, dot_r = x + (dx0 + dx1) / 2, ASC - (dy0 + dy1) / 2, (dx1 - dx0) / 2
    x += gs[g].width + TRACK
    prev = g

# ripple: one arc over the i's dot, toward the upper right (the tap spreading out)
ripple = band(dot_cx, dot_cy, dot_r + 64 + 118, dot_r + 64, 245, 335)

pg = cmap[ord(".")]
x += KERN.get((prev, pg), 0)
period = glyph_path(pg, x)
width = x + gs[pg].width

word = "".join(letters) + ripple
# crop: ripple top to descender of p
top = math.floor(dot_cy - (dot_r + 182)) - 4
vb = f"0 {top} {math.ceil(width)} {ASC + 200 - top}"


def svg(name, letters_fill, dot_fill):
    (HERE / name).write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-labelledby="t">'
        f'<title id="t">tapndine</title><path fill="{letters_fill}" d="{word}"/>'
        f'<path fill="{dot_fill}" d="{period}"/></svg>\n', encoding="utf-8")


svg("tapndine-logo.svg", COCOA, ORANGE)
svg("tapndine-logo-black.svg", "#111111", "#111111")
svg("tapndine-logo-white.svg", "#FFFFFF", ORANGE)
print("VIEWBOX", vb)
print("dot", dot_cx, dot_cy, dot_r)

# ---- the React component the app uses (generated; edit this script, not the .tsx) ----
vb_h = ASC + 200 - top
tsx = f'''// Generated by brand/logo/wordmark.py — edit that script and re-run it, not this file.
// The tapndine logo: Montserrat ExtraBold outlined, a tap ripple over the i, an
// orange period. Sized in em, so it takes the font size of whatever it sits in
// and lines up on the text baseline. Letters use currentColor.
export function Wordmark({{ className = "" }}: {{ className?: string }}) {{
  return (
    <svg
      viewBox="{vb}"
      role="img"
      aria-label="tapndine"
      className={{className}}
      style={{{{ display: "inline-block", height: "{vb_h / 1000:.3f}em", width: "auto", verticalAlign: "-{(ASC + 200 - (ASC)) / 1000:.3f}em" }}}}
    >
      <path fill="currentColor" d="{word}" />
      <path fill="#F19A33" d="{period}" />
    </svg>
  );
}}
'''
(HERE.parent.parent / "app/components/Wordmark.tsx").write_text(tsx, encoding="utf-8")

# ---- favicon / app icon: the rippled i, white on a cocoa tile ----
lcx = (dx0 + dx1) / 2  # the dot's centre, with the i drawn at x=0
# small-size cut: wider gap and heavier ripple than the wordmark so it survives 16px
GAP, RW = 100, 140
i_mark = glyph_path(cmap[ord("i")], 0) + band(lcx, dot_cy, dot_r + GAP + RW, dot_r + GAP, 245, 335)
# bounds of i + ripple in SVG coords: stem from x 40, ripple tip at the right; ripple top to baseline
ro = dot_r + GAP + RW
mx0, mx1 = 40, lcx + ro * math.cos(math.radians(335)) + RW / 2
my0, my1 = dot_cy - ro, ASC
TILE, FILL = 512, 0.74  # mark height as a share of the tile
k = TILE * FILL / (my1 - my0)
tx = (TILE - (mx1 - mx0) * k) / 2 - mx0 * k
ty = (TILE - (my1 - my0) * k) / 2 - my0 * k + TILE * 0.01  # a hair low: the ripple is light, the stem heavy
icon = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {TILE} {TILE}">'
        f'<rect width="{TILE}" height="{TILE}" rx="{TILE * 0.22:.0f}" fill="{COCOA}"/>'
        f'<path fill="#FFFFFF" transform="translate({tx:.1f} {ty:.1f}) scale({k:.4f})" d="{i_mark}"/></svg>\n')
(HERE / "tapndine-icon.svg").write_text(icon, encoding="utf-8")
(HERE.parent.parent / "app/icon.svg").write_text(icon, encoding="utf-8")
