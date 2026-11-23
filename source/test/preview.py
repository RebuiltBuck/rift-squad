import json, sys
from PIL import Image, ImageDraw

data = json.load(open(sys.argv[1]))
common = data.pop('_common')
names = list(data.keys())
S = 8
cols = 8
rows = (len(names) + cols - 1) // cols
img = Image.new('RGB', (cols * 18 * S, rows * 20 * S), (58, 90, 64))
d = ImageDraw.Draw(img)
errs = []
for i, name in enumerate(names):
    spr = data[name]
    pal = dict(common); pal.update(spr.get('pal', {}))
    r = spr['rows']
    if len(r) != 16: errs.append(f'{name}: {len(r)} rows')
    ox = (i % cols) * 18 * S + S; oy = (i // cols) * 20 * S + S
    for y, row in enumerate(r):
        if len(row) != 16: errs.append(f'{name} row {y}: len {len(row)} "{row}"')
        for x, ch in enumerate(row):
            if ch == '.': continue
            if ch not in pal: errs.append(f'{name} row {y}: unknown {ch}'); continue
            c = pal[ch]
            d.rectangle([ox + x*S, oy + y*S, ox + x*S + S - 1, oy + y*S + S - 1], fill=c)
    d.text((ox, oy + 16*S + 2), name, fill=(255, 255, 255))
img.save(sys.argv[2])
print('\n'.join(errs) if errs else 'OK')
