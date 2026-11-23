from PIL import Image, ImageDraw, ImageFont
PAL = {'O': '#3a4058', 'h': '#f8f8f8', 'l': '#d8e0e8', 'm': '#a8b0c8', 'd': '#707890', 'R': '#f87070', 'r': '#d83030', 'q': '#902828',
       's': '#f8d8b0', 'S': '#e0a070', 'K': '#9a5838', 'e': '#283040', 'p': '#f89898', 'B': '#70a0f8', 'b': '#3868d0', 'n': '#2848a0',
       'N': '#182868', 'y': '#f8e070', 'Y': '#c89828', 'w': '#f8f8f8', 'v': '#b0b8c8', 'g': '#7a4a28', 'f': '#585868', 'F': '#282838'}
ROWS = [
    "......OrRO......",
    ".....OqrrO......",
    "....OOOqOOOO....",
    "...OhhlmlllmO.O.",
    "...OhllmllldOOwO",
    "...OldddddddOOwO",
    "...OmssssssdOOwO",
    "...OmsessesdOOvO",
    "...OmpessepdOOwO",
    "...OmSssssSdOOwO",
    "...OddSSSSddOOwO",
    "...OOOOOOOOOOOwO",
    "NNNNNBByyBBlmYyY",
    "NByBNbyyyybmdllO",
    "NyyyNbbyybbdOmmO",
    "NBybNnbbbbnO.OgO",
    "NbynNnnnnnnO..Y.",
    ".NnNOmdOOmdO....",
    "..N.FffFFffF....",
    "....FFFFFFFF....",
]
assert all(len(r) == 16 for r in ROWS), [len(r) for r in ROWS]
H = len(ROWS)
def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
spr = Image.new('RGBA', (16, H), (0, 0, 0, 0))
for y, row in enumerate(ROWS):
    for x, ch in enumerate(row):
        if ch != '.': spr.putpixel((x, y), rgb(PAL[ch]) + (255,))

# original grass + path tiles (16x16), GBA-ish soft palette
def grass_tile(seed):
    t = Image.new('RGB', (16, 16), rgb('#88d070')); d = ImageDraw.Draw(t)
    import random; r = random.Random(seed)
    for _ in range(5):
        x, y = r.randrange(1, 14), r.randrange(2, 14)
        d.point([(x, y), (x + 1, y - 1), (x + 2, y)], fill=rgb('#58a848')); d.point([(x + 1, y)], fill=rgb('#a8e090'))
    if seed % 3 == 0: d.point([(r.randrange(2, 14), r.randrange(2, 14))], fill=rgb('#f8f0a0'))
    return t
def path_tile(seed):
    t = Image.new('RGB', (16, 16), rgb('#e8d8a0')); d = ImageDraw.Draw(t)
    import random; r = random.Random(seed + 99)
    for _ in range(4): d.point([(r.randrange(0, 16), r.randrange(0, 16))], fill=rgb('#d0b878'))
    return t
scene = Image.new('RGB', (16 * 6, 16 * 4))
for ty in range(4):
    for tx in range(6):
        scene.paste(path_tile(tx * 7 + ty) if ty == 2 else grass_tile(tx * 5 + ty * 11), (tx * 16, ty * 16))
# tall-grass tufts on the top row
tg = ImageDraw.Draw(scene)
for tx in (0, 1, 5):
    for k in range(4):
        bx, by = tx * 16 + k * 4, 2
        tg.polygon([(bx, by + 12), (bx + 2, by), (bx + 4, by + 12)], fill=rgb('#48a040')); tg.line([(bx + 2, by + 1), (bx + 2, by + 9)], fill=rgb('#78c860'))
# soft shadow + hero standing on the path
sh = Image.new('RGBA', scene.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse([40, 46, 54, 50], fill=(40, 60, 30, 90))
scene = Image.alpha_composite(scene.convert('RGBA'), sh)
scene.alpha_composite(spr, (40, 31))

BG = (29, 24, 56); W, Hh = 900, 560
out = Image.new('RGB', (W, Hh), BG); d = ImageDraw.Draw(out)
fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22); fsm = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
d.rounded_rectangle([20, 20, 330, 470], 22, fill=(47, 40, 88), outline=(255, 210, 63), width=4)
big = spr.resize((16 * 16, H * 16), Image.NEAREST); out.paste(big, (175 - 128, 40), big)
d.text((175, 440), 'Sir Bruno · GBA-style', fill=(255, 210, 63), font=fnt, anchor='mm')
sc = scene.resize((scene.width * 5, scene.height * 5), Image.NEAREST)
d.rounded_rectangle([352, 20, 880, 470], 22, fill=(38, 32, 74))
out.paste(sc, (616 - sc.width // 2, 245 - sc.height // 2))
d.text((616, 440), 'In a scene', fill=(255, 255, 255), font=fnt, anchor='mm')
d.text((W // 2, 505), '16×20 overworld-style sprite · colored outlines · 3-tone shading', fill=(165, 159, 201), font=fsm, anchor='mm')
out.save('art/bruno_gba_preview.png'); print('ok')
