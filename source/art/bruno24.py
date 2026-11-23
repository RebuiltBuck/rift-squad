import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import art32 as A
from PIL import Image, ImageDraw, ImageFont

def bruno24():
    A.N = 24
    s = A.Spr(A.P(skin={'base': '#f2c29b', 'flat': True}, skin2={'base': '#d99a74', 'flat': True}, plate='#c3ccd8', plate2='#8a96aa', plume='#e03c3c', tabard='#3a6fd8', shield='#3a6fd8', boots='#6f7a8c', blade='#e8eef5'))
    s.poly([(10, 3), (11, 0), (16, 0), (14, 3)], 'plume')
    s.rrect(4, 2, 19, 13, 'plate', 5)
    s.rrect(7, 6, 16, 12, 'skin', 2); s.rect(7, 6, 16, 6, 'plate2'); s.rect(11, 2, 12, 6, 'plate2')
    s.rect(8, 8, 9, 9, 'eye'); s.rect(14, 8, 15, 9, 'eye'); s.px(8, 8, 'shine'); s.px(14, 8, 'shine')
    s.rect(8, 12, 15, 12, 'skin2'); s.rect(11, 11, 12, 11, 'mouth'); s.px(7, 10, 'blush'); s.px(16, 10, 'blush')
    s.rrect(6, 14, 17, 20, 'tabard', 1)
    s.mrect(4, 14, 6, 15, 'plate'); s.mrect(4, 16, 5, 19, 'plate')
    s.mrect(8, 21, 10, 21, 'plate2'); s.mrect(7, 22, 11, 22, 'boots')
    s.rect(11, 15, 12, 19, 'gold'); s.rect(9, 16, 14, 17, 'gold')
    s.poly([(0, 13), (6, 13), (6, 19), (3, 23), (0, 19)], 'shield'); s.rect(2, 14, 3, 20, 'gold'); s.rect(1, 16, 5, 16, 'gold')
    s.rect(20, 3, 21, 15, 'blade'); s.rect(18, 15, 23, 16, 'gold'); s.rect(20, 17, 21, 20, 'wood')
    g = s.finish(); A.N = 32
    return g

def to_img(grid, n):
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    for y in range(n):
        for x in range(n):
            c = grid[y][x]
            if c: im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im

def from16(name):
    d = json.load(open('src/sprites.json')); com = d['_common']; spr = d[name]; pal = dict(com); pal.update(spr.get('pal', {}))
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(spr['rows']):
        for x, ch in enumerate(row):
            if ch != '.': c = pal[ch]; im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im

g24 = bruno24(); im24 = to_img(g24, 24)
im32 = to_img(A.bruno().finish(), 32); im16 = from16('bruno')
BG = (29, 24, 56); W, H = 900, 760
out = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(out)
font = ImageFont.truetype('tmp/font/package/files/pixelify-sans-latin-700-normal.woff2', 30) if False else None
try:
    from PIL import ImageFont
    fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26); fsm = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
except Exception:
    fnt = fsm = ImageFont.load_default()
# hero: 24px at 16x
big = im24.resize((384, 384), Image.NEAREST)
d.rounded_rectangle([W // 2 - 220, 20, W // 2 + 220, 470], 24, fill=(47, 40, 88))
out.paste(big, (W // 2 - 192, 40), big)
d.text((W // 2, 440), 'Sir Bruno  ·  24×24', fill=(255, 210, 63), font=fnt, anchor='mm')
# comparison row, all shown at the same size
labels = [('16×16  original', im16), ('24×24  new', im24), ('32×32  current', im32)]
for i, (lab, im) in enumerate(labels):
    cx = 150 + i * 300
    d.rounded_rectangle([cx - 115, 500, cx + 115, 740], 18, fill=(38, 32, 74), outline=(255, 210, 63) if i == 1 else None, width=4)
    sz = 192; b = im.resize((sz, sz), Image.NEAREST); out.paste(b, (cx - sz // 2, 508), b)
    d.text((cx, 718), lab, fill=(255, 255, 255) if i != 1 else (255, 210, 63), font=fsm, anchor='mm')
out.save('art/bruno_24_preview.png'); print('ok')
