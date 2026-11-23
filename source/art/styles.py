#!/usr/bin/env python3
"""Sir Bruno in four art styles: GBA pixel, 3D voxel model, smooth cartoon, Game Boy."""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import gba

def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def mul(c, f): return tuple(max(0, min(255, int(v * f))) for v in c)

# ---------------- 1. GBA pixel ----------------
def gba_img():
    g = gba.bruno_grid(); im = Image.new('RGBA', (16, 20), (0, 0, 0, 0))
    for y, row in enumerate(g):
        for x, c in enumerate(row):
            if c: im.putpixel((x, y), rgb(c) + (255,))
    return im

# ---------------- 2. 3D voxel model ----------------
def voxel_model():
    V = {}
    def box(x0, x1, y0, y1, z0, z1, c):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1): V[(x, y, z)] = c
    def clear(x, y, z): V.pop((x, y, z), None)
    P, P2, PL = rgb('#b8c2d0'), rgb('#7d889c'), rgb('#e4eaf2')
    BLUE, GOLD, SKIN, EYE, RED, BOOT, WOOD, BLADE = rgb('#3a6fd8'), rgb('#ffd23f'), rgb('#f2c29b'), rgb('#283040'), rgb('#d83030'), rgb('#4a4f63'), rgb('#7a4a28'), rgb('#e8eef5')
    box(4, 6, 0, 1, 3, 7, BOOT); box(9, 11, 0, 1, 3, 7, BOOT)          # boots
    box(5, 6, 2, 3, 4, 6, P2); box(9, 10, 2, 3, 4, 6, P2)             # legs
    box(4, 11, 4, 9, 3, 8, BLUE)                                      # tabard
    box(7, 8, 5, 8, 9, 9, GOLD); box(6, 9, 7, 7, 9, 9, GOLD)          # cross on chest
    box(2, 3, 5, 9, 4, 7, P); box(12, 13, 5, 9, 4, 7, P)              # arms
    box(2, 3, 9, 10, 3, 8, PL); box(12, 13, 9, 10, 3, 8, PL)          # pauldrons
    box(3, 12, 10, 19, 2, 11, P)                                      # helmet
    for x in (3, 12):
        for y in (10, 19):
            for z in (2, 11): clear(x, y, z)
    for x in range(3, 13): clear(x, 19, 2); clear(x, 19, 11)
    for z in range(2, 12): clear(3, 19, z); clear(12, 19, z)
    box(7, 8, 19, 19, 3, 10, P2)                                      # crest ridge
    for x in range(5, 11):
        for y in range(12, 17): clear(x, y, 11); V[(x, y, 10)] = SKIN  # face opening
    box(5, 10, 17, 17, 11, 11, P2)                                    # visor rim
    V[(6, 15, 10)] = EYE; V[(6, 14, 10)] = EYE; V[(9, 15, 10)] = EYE; V[(9, 14, 10)] = EYE
    V[(5, 13, 10)] = rgb('#ff9aa8'); V[(10, 13, 10)] = rgb('#ff9aa8')
    box(7, 8, 20, 21, 6, 8, RED); box(7, 8, 21, 22, 3, 5, RED)       # plume
    # kite shield on the left arm
    for y in range(3, 12):
        w = 2 if y < 6 else 3
        for x in range(0, 4):
            if y < 5 and abs(x - 1.5) > (y - 2): continue
            V[(x, y, 9)] = BLUE
    box(1, 2, 4, 11, 10, 10, GOLD); box(0, 3, 8, 8, 10, 10, GOLD)
    # sword in the right hand
    box(14, 14, 2, 4, 9, 9, WOOD); box(13, 15, 5, 6, 8, 10, rgb('#c3ccd8'))  # grip + gauntlet
    box(12, 16, 7, 7, 9, 9, GOLD); box(14, 14, 8, 19, 9, 9, BLADE); V[(14, 20, 9)] = rgb('#ffffff'); V[(14, 1, 9)] = GOLD
    box(12, 13, 5, 7, 6, 8, P)                                                  # forearm reaching the hilt
    return V

def render_voxels(V, unit=21, yaw=32, pitch=22, size=(520, 640)):
    th, ph = math.radians(yaw), math.radians(pitch)
    def proj(x, y, z):
        cx, cz = x - 8, z - 6
        xr = cx * math.cos(th) + cz * math.sin(th); zr = -cx * math.sin(th) + cz * math.cos(th)
        sx = xr; sy = -y * math.cos(ph) + zr * math.sin(ph); depth = zr * math.cos(ph) + y * math.sin(ph)
        return sx, sy, depth
    faces = []
    dirs = [((0, 1, 0), 1.12), ((0, 0, 1), 0.92), ((1, 0, 0), 0.7), ((-1, 0, 0), 0.7)]
    for (x, y, z), c in V.items():
        for (dx, dy, dz), f in dirs:
            if (x + dx, y + dy, z + dz) in V: continue
            # face corners
            if dy: cs = [(x, y + 1, z), (x + 1, y + 1, z), (x + 1, y + 1, z + 1), (x, y + 1, z + 1)]
            elif dz: cs = [(x, y, z + 1), (x + 1, y, z + 1), (x + 1, y + 1, z + 1), (x, y + 1, z + 1)]
            elif dx > 0: cs = [(x + 1, y, z), (x + 1, y, z + 1), (x + 1, y + 1, z + 1), (x + 1, y + 1, z)]
            else: cs = [(x, y, z), (x, y, z + 1), (x, y + 1, z + 1), (x, y + 1, z)]
            pts = [proj(*p) for p in cs]
            # back-face cull: skip faces whose normal points away from the camera
            nx, ny, nz = dx, dy, dz
            vis = (nx * math.sin(th) * 0 + (-nx * math.sin(th) + nz * math.cos(th)) * math.cos(ph) + ny * math.sin(ph))
            if vis <= 0.01: continue
            d = sum(p[2] for p in pts) / 4
            faces.append((d, [(p[0], p[1]) for p in pts], mul(c, f)))
    faces.sort(key=lambda t: t[0])
    S = 2; W, H = size[0] * S, size[1] * S
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    ox, oy = W / 2, H * 0.9
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse([ox - 8.5 * unit * S, oy - 1.6 * unit * S, ox + 8.5 * unit * S, oy + 2.6 * unit * S], fill=(0, 0, 0, 90))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(18))); d = ImageDraw.Draw(im)
    for _, pts, col in faces:
        P = [(ox + px * unit * S, oy + py * unit * S) for px, py in pts]
        d.polygon(P, fill=col + (255,), outline=mul(col, 0.82) + (255,))
    return im.resize(size, Image.LANCZOS)

# ---------------- 3. smooth cartoon ----------------
def cartoon(size=(520, 640)):
    S = 4; W, H = size[0] * S, size[1] * S
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    OL = rgb('#1b1325'); lw = 9 * S // 2
    def P(*xy): return [v * S for v in xy]
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse(P(120, 575, 400, 615), fill=(0, 0, 0, 90))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(20))); d = ImageDraw.Draw(im)
    # legs + boots
    for x in (190, 275):
        d.rounded_rectangle(P(x, 500, x + 55, 570), 16 * S, fill=rgb('#7d889c'), outline=OL, width=lw)
        d.rounded_rectangle(P(x - 8, 548, x + 63, 595), 18 * S, fill=rgb('#4a4f63'), outline=OL, width=lw)
    # sword (behind arm)
    d.polygon(P(400, 120, 422, 95, 444, 120, 444, 420, 400, 420), fill=rgb('#e8eef5'), outline=OL, width=lw)
    d.polygon(P(426, 125, 440, 125, 440, 410, 426, 410), fill=rgb('#c3ccd8'))
    d.rounded_rectangle(P(370, 410, 474, 440), 12 * S, fill=rgb('#ffd23f'), outline=OL, width=lw)
    d.rounded_rectangle(P(408, 440, 436, 520), 10 * S, fill=rgb('#7a4a28'), outline=OL, width=lw)
    d.ellipse(P(404, 515, 440, 548), fill=rgb('#ffd23f'), outline=OL, width=lw)
    # body
    d.rounded_rectangle(P(150, 330, 370, 520), 60 * S, fill=rgb('#3a6fd8'), outline=OL, width=lw)
    d.rounded_rectangle(P(170, 350, 350, 380), 14 * S, fill=rgb('#5b8ef0'))
    d.rounded_rectangle(P(243, 375, 277, 480), 10 * S, fill=rgb('#ffd23f'), outline=OL, width=lw // 2)
    d.rounded_rectangle(P(215, 400, 305, 432), 10 * S, fill=rgb('#ffd23f'), outline=OL, width=lw // 2)
    # sword arm + gauntlet gripping the hilt
    d.rounded_rectangle(P(345, 360, 415, 470), 30 * S, fill=rgb('#c3ccd8'), outline=OL, width=lw)
    d.ellipse(P(385, 440, 460, 505), fill=rgb('#d8e0ea'), outline=OL, width=lw)
    # shield
    d.polygon(P(40, 330, 190, 330, 190, 470, 115, 560, 40, 470), fill=rgb('#3a6fd8'), outline=OL, width=lw)
    d.polygon(P(58, 348, 172, 348, 172, 462, 115, 532, 58, 462), fill=rgb('#4f82e8'))
    d.rounded_rectangle(P(103, 360, 127, 510), 8 * S, fill=rgb('#ffd23f'), outline=OL, width=lw // 2)
    d.rounded_rectangle(P(62, 410, 168, 434), 8 * S, fill=rgb('#ffd23f'), outline=OL, width=lw // 2)
    # plume
    d.ellipse(P(210, 25, 300, 115), fill=rgb('#e03c3c'), outline=OL, width=lw)
    d.ellipse(P(255, 15, 335, 85), fill=rgb('#ff6b6b'), outline=OL, width=lw)
    # helmet
    d.rounded_rectangle(P(105, 70, 415, 350), 120 * S, fill=rgb('#c3ccd8'), outline=OL, width=lw)
    d.ellipse(P(135, 88, 300, 190), fill=rgb('#e4eaf2'))
    d.rounded_rectangle(P(243, 72, 277, 165), 14 * S, fill=rgb('#8a96aa'), outline=OL, width=lw // 2)
    # face opening
    d.rounded_rectangle(P(160, 165, 360, 320), 50 * S, fill=rgb('#f2c29b'), outline=OL, width=lw)
    d.rounded_rectangle(P(160, 155, 360, 190), 16 * S, fill=rgb('#8a96aa'), outline=OL, width=lw)
    for ex in (210, 290):
        d.ellipse(P(ex - 18, 215, ex + 18, 268), fill=rgb('#283040'))
        d.ellipse(P(ex - 9, 222, ex + 3, 236), fill=(255, 255, 255))
    d.ellipse(P(175, 262, 210, 285), fill=rgb('#ff9aa8')); d.ellipse(P(310, 262, 345, 285), fill=rgb('#ff9aa8'))
    d.arc(P(235, 270, 285, 300), 20, 160, fill=OL, width=lw // 2)
    return im.resize(size, Image.LANCZOS)

# ---------------- 4. Game Boy ----------------
def gameboy():
    src = gba_img(); shades = [rgb('#0f380f'), rgb('#306230'), rgb('#8bac0f'), rgb('#9bbc0f')]
    im = Image.new('RGBA', src.size, (0, 0, 0, 0))
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = src.getpixel((x, y))
            if not a: continue
            L = 0.3 * r + 0.59 * g + 0.11 * b
            im.putpixel((x, y), shades[0 if L < 75 else 1 if L < 135 else 2 if L < 200 else 3] + (255,))
    return im

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    PW, PH = 520, 640; BG = (29, 24, 56)
    out = Image.new('RGB', (PW * 2 + 60, PH * 2 + 140), BG); d = ImageDraw.Draw(out)
    fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
    fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 19)
    panels = [
        ('Pixel art (GBA style)', 'current pick', gba_img().resize((16 * 24, 20 * 24), Image.NEAREST), (47, 40, 88)),
        ('3D voxel model', 'blocky, Minecraft-like', render_voxels(voxel_model()), (40, 52, 84)),
        ('Smooth cartoon', 'modern mobile-game look', cartoon(), (52, 40, 80)),
        ('Game Boy', '4 shades of green', gameboy().resize((16 * 24, 20 * 24), Image.NEAREST), (36, 48, 40)),
    ]
    for i, (title, sub, im, bg) in enumerate(panels):
        cx = 20 + (i % 2) * (PW + 20); cy = 20 + (i // 2) * (PH + 50)
        d.rounded_rectangle([cx, cy, cx + PW, cy + PH + 30], 26, fill=bg)
        if i == 3: d.rounded_rectangle([cx + 40, cy + 30, cx + PW - 40, cy + PH - 70], 18, fill=rgb('#9bbc0f'))
        im = im.convert('RGBA'); out.paste(im, (cx + (PW - im.width) // 2, cy + (PH - 60 - im.height) // 2 + 20), im)
        d.text((cx + PW // 2, cy + PH - 22), title, fill=(255, 210, 63), font=fb, anchor='mm')
        d.text((cx + PW // 2, cy + PH + 10), sub, fill=(200, 196, 230), font=fs, anchor='mm')
    out.save(os.path.join(here, 'bruno_styles.png')); print('ok', out.size)
