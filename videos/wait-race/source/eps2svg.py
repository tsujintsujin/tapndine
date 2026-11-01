# Converts the Illustrator EPS (mo/li/cv/cp/f/rgb only) to SVG, one <path> per fill, in paint order.
import re, sys, json
t = open(sys.argv[1], 'rb').read().decode('latin-1')
body = t[t.find('%%EndPageSetup'):]
body = body[:body.find('%%PageTrailer')]
toks = body.split()
stack, d, paths, col = [], [], [], '#000'
ops = set()
for tk in toks:
    try:
        stack.append(float(tk)); continue
    except ValueError: pass
    if tk == 'mo': x, y = stack[-2:]; d.append(f'M{x:g} {y:g}')
    elif tk == 'li': x, y = stack[-2:]; d.append(f'L{x:g} {y:g}')
    elif tk == 'cv': a = stack[-6:]; d.append('C' + ' '.join(f'{v:g}' for v in a))
    elif tk == 'cp': d.append('Z')
    elif tk == 'rgb': r, g, b = stack[-3:]; col = '#%02x%02x%02x' % tuple(round(v * 255) for v in (r, g, b))
    elif tk in ('f', 'ef'):
        if d: paths.append({'d': ''.join(d), 'fill': col, 'rule': 'evenodd' if tk == 'ef' else 'nonzero'})
        d = []
    elif tk in ('np',): d = []
    elif tk == 'clp': d = []
    else: ops.add(tk)
    if not re.match(r'^-?[\d.]+$', tk): stack = []
sys.stderr.write('paths %d, other ops %s\n' % (len(paths), sorted(ops)[:60]))
json.dump(paths, open(sys.argv[2] + '.json', 'w'))
with open(sys.argv[2], 'w') as o:
    o.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3200 2000">\n')
    for i, p in enumerate(paths):
        o.write(f'<path id="p{i}" fill="{p["fill"]}"' + (' fill-rule="evenodd"' if p['rule'] == 'evenodd' else '') + f' d="{p["d"]}"/>\n')
    o.write('</svg>\n')
