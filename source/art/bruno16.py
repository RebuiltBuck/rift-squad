import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import art32 as A
from PIL import Image, ImageDraw, ImageFont

def bruno16():
    A.N = 16
    F = lambda c: {'base': c, 'flat': True}
    s = A.Spr(A.P(skin=F('#f2c29b'), skin2=F('#d99a74'), plate=F('#c3ccd8'), plateL=F('#eef2f7'), plateD=F('#8a96aa'),
                  plume=F('#d62f3a'), plumeL=F('#ff6b6b'), tab=F('#3a6fd8'), tabL=F('#5b8ef0'), tabD=F('#2a4fa0'),
                  shield=F('#3a6fd8'), shieldD=F('#2a4fa0'), boots=F('#4a4f63'), blade=F('#dfe7f0'), bladeh=F('#ffffff'),
                  gold=F('#ffd23f'), goldD=F('#d99a00'), grip=F('#7a4a2a'), gaunt=F('#c3ccd8'), eye=F('#1b1325'), blush=F('#ff9aa8')))
    # plume
    s.rect(7, 1, 9, 1, 'plume'); s.px(8, 0, 'plumeL'); s.px(9, 0, 'plumeL')
    # helmet with highlight + shade
    s.rrect(3, 2, 12, 9, 'plate', 3)
    s.rect(5, 2, 10, 2, 'plateL'); s.px(4, 3, 'plateL'); s.px(3, 5, 'plateL')
    s.rect(7, 2, 8, 3, 'plateD'); s.rect(12, 5, 12, 7, 'plateD'); s.rect(4, 9, 11, 9, 'plateD')
    # face
    s.rect(5, 4, 10, 4, 'plateD'); s.rect(5, 5, 10, 8, 'skin')
    s.rect(6, 6, 6, 7, 'eye'); s.rect(9, 6, 9, 7, 'eye')
    s.rect(6, 8, 9, 8, 'skin2'); s.px(5, 7, 'blush'); s.px(10, 7, 'blush')
    # tabard
    s.rect(4, 10, 11, 13, 'tab'); s.rect(4, 10, 4, 12, 'tabL'); s.rect(4, 13, 11, 13, 'tabD')
    s.rect(7, 10, 8, 12, 'gold'); s.rect(6, 11, 9, 11, 'gold'); s.px(8, 12, 'goldD')
    # legs + boots
    s.rect(5, 14, 6, 14, 'plateD'); s.rect(9, 14, 10, 14, 'plateD'); s.rect(4, 15, 6, 15, 'boots'); s.rect(9, 15, 11, 15, 'boots')
    # kite shield on the left arm
    s.poly([(0, 9), (5, 9), (5, 13), (2.5, 16), (0, 13)], 'shield'); s.rect(4, 10, 4, 13, 'shieldD'); s.px(2, 14, 'shieldD')
    s.rect(2, 10, 2, 13, 'gold'); s.rect(1, 11, 3, 11, 'gold')
    # sword arm: shoulder -> fist wrapped around the grip
    s.rect(12, 10, 12, 11, 'plate')
    s.rect(14, 1, 14, 9, 'blade'); s.px(14, 1, 'bladeh'); s.px(14, 2, 'bladeh')
    s.rect(13, 10, 15, 10, 'gold'); s.px(15, 10, 'goldD')
    s.rect(14, 11, 14, 13, 'grip'); s.rect(13, 11, 14, 12, 'gaunt'); s.px(14, 14, 'gold')
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
    d = json.load(open('src/sprites.json')); pal = dict(d['_common']); pal.update(d[name].get('pal', {}))
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(d[name]['rows']):
        for x, ch in enumerate(row):
            if ch != '.': c = pal[ch]; im.putpixel((x, y), tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im

new = to_img(bruno16(), 16); old = from16('bruno')
BG = (29, 24, 56); W, H = 900, 620
out = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(out)
fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 24); fsm = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
for i, (lab, im) in enumerate([('16×16  original', old), ('16×16  redo', new)]):
    cx = 225 + i * 450
    d.rounded_rectangle([cx - 205, 20, cx + 205, 500], 22, fill=(47, 40, 88) if i else (38, 32, 74), outline=(255, 210, 63) if i else None, width=4)
    b = im.resize((384, 384), Image.NEAREST); out.paste(b, (cx - 192, 40), b)
    d.text((cx, 470), lab, fill=(255, 210, 63) if i else (255, 255, 255), font=fnt, anchor='mm')
# actual in-game size strip
d.text((W // 2, 535), 'Closer to game size', fill=(165, 159, 201), font=fsm, anchor='mm')
for i, im in enumerate([old, new]):
    b = im.resize((48, 48), Image.NEAREST); out.paste(b, (W // 2 - 70 + i * 92, 556), b)
out.save('art/bruno_16_redo.png'); print('ok')
