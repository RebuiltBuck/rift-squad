import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import art32 as A
from PIL import Image, ImageDraw, ImageFont
import importlib.util
spec = importlib.util.spec_from_file_location('b24', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bruno24.py'))

def bruno20():
    A.N = 20
    s = A.Spr(A.P(skin={'base': '#f2c29b', 'flat': True}, skin2={'base': '#d99a74', 'flat': True}, plate='#c3ccd8', plate2='#8a96aa', plume='#e03c3c', tabard='#3a6fd8', shield='#3a6fd8', boots='#6f7a8c', blade='#e8eef5'))
    s.poly([(8, 2), (9, 0), (13, 0), (12, 2)], 'plume')
    s.rrect(3, 1, 16, 10, 'plate', 4)
    s.rect(6, 4, 13, 9, 'skin'); s.rect(6, 4, 13, 4, 'plate2'); s.rect(9, 1, 10, 4, 'plate2')
    s.rect(7, 6, 8, 7, 'eye'); s.rect(11, 6, 12, 7, 'eye'); s.px(7, 6, 'shine'); s.px(11, 6, 'shine')
    s.rect(7, 9, 12, 9, 'skin2'); s.rect(9, 8, 10, 8, 'mouth'); s.px(6, 7, 'blush'); s.px(13, 7, 'blush')
    s.rrect(5, 11, 14, 16, 'tabard', 1)
    s.mrect(3, 11, 5, 12, 'plate'); s.mrect(3, 13, 4, 15, 'plate')
    s.rect(9, 12, 10, 15, 'gold'); s.rect(8, 13, 11, 13, 'gold')
    s.mrect(6, 17, 8, 17, 'plate2'); s.mrect(5, 18, 8, 18, 'boots')
    s.poly([(0, 11), (5, 11), (5, 16), (2, 19), (0, 16)], 'shield'); s.rect(2, 12, 2, 16, 'gold'); s.rect(1, 13, 4, 13, 'gold')
    s.rect(17, 2, 18, 11, 'blade'); s.rect(15, 12, 19, 13, 'gold'); s.rect(17, 14, 18, 16, 'wood')
    g = s.finish(); A.N = 32
    return g

def to_img(grid, n):
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    for y in range(n):
        for x in range(n):
            c = grid[y][x]
            if c: im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im

sys.argv = ['x']; b24 = importlib.util.module_from_spec(spec)
import contextlib, io
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(b24)
im20 = to_img(bruno20(), 20); im24 = b24.im24; im16 = b24.im16
BG = (29, 24, 56); W, H = 900, 760
out = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(out)
fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26); fsm = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
big = im20.resize((380, 380), Image.NEAREST)
d.rounded_rectangle([W // 2 - 220, 20, W // 2 + 220, 470], 24, fill=(47, 40, 88))
out.paste(big, (W // 2 - 190, 40), big)
d.text((W // 2, 440), 'Sir Bruno  ·  20×20', fill=(255, 210, 63), font=fnt, anchor='mm')
for i, (lab, im) in enumerate([('16×16  original', im16), ('20×20  new', im20), ('24×24  last preview', im24)]):
    cx = 150 + i * 300
    d.rounded_rectangle([cx - 115, 500, cx + 115, 740], 18, fill=(38, 32, 74), outline=(255, 210, 63) if i == 1 else None, width=4)
    b = im.resize((180, 180), Image.NEAREST); out.paste(b, (cx - 90, 514), b)
    d.text((cx, 718), lab, fill=(255, 210, 63) if i == 1 else (255, 255, 255), font=fsm, anchor='mm')
out.save('art/bruno_20_preview.png'); print('ok')
