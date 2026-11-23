#!/usr/bin/env python3
"""Rift Squad GBA-style heroes (16x20 overworld look): colored outlines, 3-tone shading, decals.
Writes art/gba_sheet.png (preview) and art/sprites_gba.json."""
import colorsys, json, os
from PIL import Image, ImageDraw, ImageFont

W, H = 16, 20
def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def hexc(c): return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in c)
def tone(h, dl, ds=0.0):
    r, g, b = [v / 255 for v in rgb(h)]; hh, l, s = colorsys.rgb_to_hls(r, g, b)
    return hexc([v * 255 for v in colorsys.hls_to_rgb(hh, max(0, min(1, l + dl)), max(0, min(1, s + ds)))])

class S:
    def __init__(self, mats, decals=None):
        self.m = {}
        for k, v in mats.items():
            self.m[k] = {'hi': tone(v, 0.17), 'lt': tone(v, 0.08), 'md': v, 'dk': tone(v, -0.14, 0.04), 'out': tone(v, -0.36, 0.08), 'decal': False}
        for k, v in (decals or {}).items():
            self.m[k] = {'md': v, 'out': tone(v, -0.4), 'decal': True}
        self.g = [[None] * W for _ in range(H)]
    def px(self, x, y, m):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H: self.g[y][x] = m
    def rect(self, x0, y0, x1, y1, m):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.px(x, y, m)
    def rrect(self, x0, y0, x1, y1, m, r=2):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = max(x0 + r - x, 0, x - (x1 - r)); dy = max(y0 + r - y, 0, y - (y1 - r))
                if dx * dx + dy * dy <= r * r + 0.6: self.px(x, y, m)
    def ell(self, cx, cy, rx, ry, m):
        for y in range(H):
            for x in range(W):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0: self.px(x, y, m)
    def poly(self, pts, m):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            for i in range(len(pts)):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
                if (y0 <= y + 0.5 < y1) or (y1 <= y + 0.5 < y0): xs.append(x0 + (y + 0.5 - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(round(xs[i])), int(round(xs[i + 1]))): self.px(x, y, m)
    def line(self, x0, y0, x1, y1, m):
        n = max(abs(x1 - x0), abs(y1 - y0)) or 1
        for i in range(n + 1): self.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), m)
    # mirrored helpers (left side drawn, right side copied)
    def mpx(self, x, y, m): self.px(x, y, m); self.px(W - 1 - x, y, m)
    def mrect(self, x0, y0, x1, y1, m): self.rect(x0, y0, x1, y1, m); self.rect(W - 1 - x1, y0, W - 1 - x0, y1, m)
    def mpoly(self, pts, m): self.poly(pts, m); self.poly([(W - x, y) for x, y in pts], m)

    def finish(self):
        g = self.g
        def solid(x, y):  # a shaded part counts as an edge only against empty space or another shaded part
            if not (0 <= x < W and 0 <= y < H): return None
            m = g[y][x]
            return m
        out = [[None] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                m = g[y][x]
                if m is None: continue
                M = self.m[m]
                if M['decal']: out[y][x] = M['md']; continue
                def edge(xx, yy):
                    n = solid(xx, yy)
                    return n is None or (n != m and not self.m[n]['decal'])
                up, lf, dn, rt = edge(x, y - 1), edge(x - 1, y), edge(x, y + 1), edge(x + 1, y)
                if up and lf: out[y][x] = M['hi']
                elif up: out[y][x] = M['lt']
                elif dn or rt: out[y][x] = M['dk']
                else: out[y][x] = M['md']
        res = [row[:] for row in out]
        for y in range(H):
            for x in range(W):
                if g[y][x] is not None: continue
                for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W and 0 <= yy < H and g[yy][xx] is not None:
                        res[y][x] = self.m[g[yy][xx]]['out']; break
        return res

# ---- shared ----
SKIN = '#f8d0a0'
E = {'eye': '#283040', 'white': '#f8f8f8', 'blush': '#f8a0a0'}
def D(**kw): d = dict(E); d.update(kw); return d
def eyes(s, y=6, x=6, h=2): s.rect(x, y, x, y + h - 1, 'eye'); s.rect(W - 1 - x, y, W - 1 - x, y + h - 1, 'eye')
def body(s, top, pants, shoes, arms=None, hands='skin', y0=11):
    arms = arms or top
    s.rect(4, y0, 11, 16, top); s.mrect(3, y0 + 1, 3, 15, arms); s.mpx(3, 16, hands)
    s.mrect(5, 17, 6, 18, pants); s.mrect(4, 19, 6, 19, shoes)

# ---- heroes ----
def zip_():
    s = S({'metal': '#a8b4c4', 'metal2': '#7a8698', 'gun': '#505868'}, D(visor='#1c2434', glow='#58f0ff', orange='#f89030', bulb='#f8e070'))
    s.rect(7, 1, 8, 1, 'metal2'); s.px(7, 0, 'bulb'); s.px(8, 0, 'bulb')
    s.rrect(3, 2, 12, 10, 'metal', 1); s.mrect(2, 5, 2, 7, 'metal2')
    s.rect(4, 5, 11, 7, 'visor'); s.rect(5, 6, 6, 6, 'glow'); s.rect(9, 6, 10, 6, 'glow')
    body(s, 'metal', 'metal2', 'gun', arms='metal2', hands='metal2')
    s.rect(6, 12, 9, 14, 'orange'); s.rect(7, 13, 8, 13, 'bulb')
    s.rect(12, 13, 15, 14, 'gun'); s.px(15, 13, 'glow')
    return s

def nova():
    s = S({'hair': '#f880b8', 'skin': SKIN, 'coat': '#f0f0f8', 'pants': '#4858c8', 'shoes': '#383858', 'kit': '#40c870'}, D(red='#e83838'))
    s.rrect(3, 1, 12, 12, 'hair', 4)
    s.rrect(5, 4, 10, 10, 'skin', 1); s.rect(4, 3, 11, 4, 'hair'); s.px(5, 5, 'hair'); s.px(10, 5, 'hair')
    eyes(s, 6); s.px(5, 9, 'blush'); s.px(10, 9, 'blush')
    body(s, 'coat', 'pants', 'shoes')
    s.rect(7, 12, 8, 15, 'red'); s.rect(6, 13, 9, 14, 'red')
    s.rect(13, 14, 15, 16, 'kit'); s.px(14, 15, 'white')
    return s

def gus():
    s = S({'skin': '#70c050', 'vest': '#8a5830', 'pants': '#5a4630', 'shoes': '#3a2a1e', 'steel': '#c8d0dc', 'wood': '#7a4a28'}, D(yel='#f8e060', mouth='#7a2828'))
    s.mpoly([(0, 4), (4, 6), (4, 8), (1, 6)], 'skin')
    s.rrect(4, 3, 11, 10, 'skin', 3)
    s.px(6, 6, 'yel'); s.px(9, 6, 'yel'); s.px(6, 7, 'eye'); s.px(9, 7, 'eye')
    s.rect(6, 9, 9, 9, 'mouth'); s.px(6, 9, 'white'); s.px(9, 9, 'white')
    body(s, 'vest', 'pants', 'shoes')
    s.rect(7, 11, 8, 16, 'skin')
    s.rect(13, 11, 13, 14, 'steel'); s.px(13, 15, 'wood'); s.px(12, 15, 'wood')
    return s

def dusty():
    s = S({'hat': '#986030', 'skin': SKIN, 'shirt': '#f0f0f0', 'vest': '#c88838', 'pants': '#4870b8', 'shoes': '#5a3a20', 'gun': '#585868'}, D(band='#4e2e1a', stache='#5a3a20', red='#d84040'))
    s.rrect(4, 4, 11, 10, 'skin', 2)
    s.rrect(4, 0, 11, 4, 'hat', 1); s.rect(1, 4, 14, 4, 'hat'); s.rect(4, 3, 11, 3, 'band')
    eyes(s, 6); s.rect(6, 8, 9, 8, 'stache')
    body(s, 'shirt', 'pants', 'shoes')
    s.rect(5, 11, 10, 11, 'red'); s.mrect(4, 12, 5, 16, 'vest')
    s.rect(12, 14, 15, 14, 'gun'); s.px(12, 15, 'gun')
    return s

def bao():
    s = S({'hatw': '#f4f4f8', 'skin': SKIN, 'jacket': '#f0f0f4', 'pants': '#3c4070', 'shoes': '#2c2c3c', 'steel': '#c8d0dc'}, D(stache='#3a2a1e', red='#e04040', btn='#c0c8d8'))
    s.ell(7.5, 1.6, 4.6, 2.2, 'hatw'); s.rect(4, 2, 11, 4, 'hatw')
    s.rrect(4, 5, 11, 10, 'skin', 2); s.rect(4, 4, 11, 4, 'hatw')
    eyes(s, 7, h=1); s.rect(6, 9, 9, 9, 'stache'); s.px(5, 8, 'blush'); s.px(10, 8, 'blush')
    body(s, 'jacket', 'pants', 'shoes')
    s.rect(5, 11, 10, 11, 'red'); s.px(6, 13, 'btn'); s.px(9, 13, 'btn'); s.px(6, 15, 'btn'); s.px(9, 15, 'btn')
    s.rect(13, 8, 13, 15, 'steel'); s.rect(12, 7, 14, 7, 'steel')
    return s

def kit():
    s = S({'hood': '#34305a', 'skin': SKIN, 'mask': '#24203e', 'suit': '#34305a', 'shoes': '#1c1830'}, D(red='#e03c3c', steel='#d8e0ea'))
    s.rrect(3, 1, 12, 10, 'hood', 3)
    s.rect(5, 5, 10, 6, 'skin'); s.rect(5, 7, 10, 9, 'mask')
    eyes(s, 5); s.rect(3, 3, 12, 3, 'red'); s.rect(13, 3, 15, 3, 'red'); s.px(15, 4, 'red')
    body(s, 'suit', 'suit', 'shoes', hands='suit')
    s.rect(4, 14, 11, 14, 'red'); s.line(1, 9, 3, 11, 'steel')
    s.px(13, 15, 'steel'); s.px(14, 14, 'steel'); s.px(15, 15, 'steel'); s.px(14, 16, 'steel')
    return s

def yuki():
    s = S({'fur': '#f0f4fc', 'face': '#80c8f0', 'horn': '#c8d0e0'}, D(mouth='#7a2838'))
    s.mrect(3, 0, 3, 1, 'horn')
    s.ell(7.5, 7, 7, 6.5, 'fur'); s.rrect(1, 9, 14, 17, 'fur', 3)
    s.mrect(0, 11, 1, 15, 'fur'); s.mrect(2, 18, 6, 19, 'fur')
    s.rrect(4, 4, 11, 9, 'face', 2)
    eyes(s, 5); s.rect(6, 8, 9, 8, 'mouth'); s.px(6, 8, 'white'); s.px(9, 8, 'white')
    return s

def volt():
    s = S({'helm': '#f8d040', 'suit': '#343c4c', 'gaunt': '#90a0b0', 'shoes': '#1e222c'}, D(visor='#1c2434', glow='#58f0ff', stripe='#f8d040', white='#f8f8f8'))
    s.rrect(3, 1, 12, 10, 'helm', 4)
    s.rrect(4, 5, 11, 8, 'visor', 1); s.rect(5, 6, 8, 6, 'glow')
    s.rect(7, 1, 8, 4, 'white')
    body(s, 'suit', 'suit', 'shoes', hands='gaunt')
    s.rect(7, 11, 8, 16, 'stripe'); s.rrect(12, 12, 14, 15, 'gaunt', 1)
    return s

def hex_():
    s = S({'hat': '#7840c8', 'hair': '#58d878', 'skin': SKIN, 'robe': '#6830b0', 'robe2': '#4a2088', 'wood': '#7a4a28'}, D(band='#f8d040', orb='#c0ff60'))
    s.mrect(3, 5, 4, 13, 'hair')
    s.rrect(4, 4, 11, 10, 'skin', 2)
    s.poly([(4, 4), (12, 4), (9, -1), (7, 0)], 'hat'); s.rect(1, 4, 14, 4, 'hat'); s.rect(4, 3, 11, 3, 'band')
    eyes(s, 6); s.px(5, 9, 'blush'); s.px(10, 9, 'blush')
    body(s, 'robe', 'robe2', 'robe2')
    s.rect(4, 17, 11, 18, 'robe2'); s.rect(7, 12, 8, 12, 'band')
    s.rect(14, 4, 14, 19, 'wood'); s.px(14, 2, 'orb'); s.px(13, 3, 'orb'); s.px(15, 3, 'orb'); s.px(14, 3, 'white')
    return s

def luna():
    s = S({'suit': '#eceef8', 'pack': '#c0c8d8', 'shoes': '#9098a8'}, D(glass='#283868', refl='#90d0ff', trim='#f89030'))
    s.mrect(1, 11, 2, 15, 'pack')
    s.rrect(2, 1, 13, 11, 'suit', 5)
    s.rrect(4, 4, 11, 9, 'glass', 2); s.px(5, 5, 'refl'); s.px(6, 5, 'refl'); s.px(5, 6, 'refl'); s.px(10, 8, 'refl')
    s.px(6, 7, 'white'); s.px(9, 7, 'white')
    body(s, 'suit', 'suit', 'shoes', hands='suit', y0=12)
    s.rect(6, 13, 9, 14, 'trim'); s.px(7, 13, 'refl')
    return s

def ragnar():
    s = S({'helm': '#a8b4c4', 'horn': '#f0e0b8', 'skin': SKIN, 'beard': '#e88030', 'tunic': '#5878a0', 'fur': '#7a5838', 'pants': '#5a4630', 'shoes': '#3a2a1e', 'wood': '#7a4a28', 'axe': '#c8d0dc'}, D())
    s.rrect(4, 3, 11, 10, 'skin', 2)
    s.mrect(2, 0, 2, 3, 'horn'); s.mrect(3, 3, 4, 4, 'horn'); s.mpx(3, 0, 'horn')
    s.rrect(4, 1, 11, 5, 'helm', 2)
    eyes(s, 6, h=1)
    s.poly([(4, 7), (12, 7), (10, 14), (8, 15), (5, 14)], 'beard'); s.rect(6, 7, 9, 7, 'skin')
    body(s, 'tunic', 'pants', 'shoes', arms='fur')
    s.mrect(3, 11, 5, 12, 'fur')
    s.poly([(4, 8), (12, 8), (10, 14), (8, 15), (5, 14)], 'beard')
    s.rect(14, 5, 14, 17, 'wood'); s.rect(12, 5, 15, 8, 'axe'); s.px(12, 5, 'axe')
    return s

def vex():
    s = S({'cape': '#2c2040', 'lining': '#c01838', 'hair': '#241830', 'skin': '#f0e8f8', 'shirt': '#f0f0f0', 'pants': '#3a2a50', 'shoes': '#1e1428'}, D(red='#e81838', gold='#f8d040'))
    s.mpoly([(0, 18), (3, 10), (4, 18)], 'cape')
    s.mpoly([(1, 6), (4, 9), (4, 12), (2, 11)], 'lining')
    s.rrect(4, 3, 11, 10, 'skin', 2)
    s.rrect(4, 1, 11, 4, 'hair', 2); s.rect(7, 5, 8, 5, 'hair')
    s.px(6, 7, 'red'); s.px(9, 7, 'red'); s.rect(7, 9, 8, 9, 'red'); s.px(7, 10, 'white'); s.px(8, 10, 'white')
    body(s, 'shirt', 'pants', 'shoes', arms='cape')
    s.rect(7, 11, 8, 12, 'red'); s.mrect(4, 11, 4, 16, 'cape')
    return s

def zorp():
    s = S({'skin': '#80e060', 'suit': '#8c48b0', 'suit2': '#602c80', 'gun': '#505868'}, D(ball='#f870d8', black='#141018', glow='#58f0ff'))
    s.mpx(4, 1, 'skin'); s.mpx(3, 0, 'ball')
    s.ell(7.5, 6.5, 6.5, 5, 'skin')
    s.mpoly([(3, 6), (7, 6), (7, 9), (4, 8)], 'black'); s.px(4, 7, 'white'); s.px(11, 7, 'white')
    s.rect(7, 10, 8, 10, 'black')
    body(s, 'suit', 'suit2', 'suit2', y0=12)
    s.rect(7, 12, 8, 16, 'suit2'); s.rect(12, 14, 15, 15, 'gun'); s.px(15, 14, 'glow')
    return s

def ember():
    s = S({'f1': '#e84028', 'skin': SKIN, 'robe': '#c83830', 'robe2': '#8a2020'}, D(f2='#f89030', f3='#f8e068', gold='#f8d040'))
    s.poly([(3, 9), (2, 3), (5, 4), (6, -1), (8, 3), (10, -1), (11, 3), (14, 2), (13, 9)], 'f1')
    s.px(6, 1, 'f2'); s.px(10, 1, 'f2'); s.px(13, 3, 'f2'); s.px(3, 4, 'f2'); s.px(6, 2, 'f3'); s.px(10, 2, 'f3')
    s.rrect(4, 4, 11, 10, 'skin', 2); s.rect(4, 4, 11, 5, 'f1')
    eyes(s, 6); s.px(5, 9, 'blush'); s.px(10, 9, 'blush')
    body(s, 'robe', 'robe2', 'robe2')
    s.rect(4, 17, 11, 18, 'robe2'); s.rect(7, 11, 8, 16, 'gold')
    s.rect(13, 12, 15, 14, 'f2'); s.px(14, 13, 'f3'); s.px(14, 11, 'f1')
    return s

# ---- captains (fuller, use the whole frame) ----
BRUNO_ROWS = [
    "......OrRO......",
    ".....OqrrO......",
    "....OOOqOOOO....",
    "...OmmmmmmmmO.O.",
    "...OhhlmllldOOwO",
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
BRUNO_PAL = {'O': '#3a4058', 'h': '#f8f8f8', 'l': '#d8e0e8', 'm': '#a8b0c8', 'd': '#707890', 'R': '#f87070', 'r': '#d83030', 'q': '#902828',
             's': '#f8d8b0', 'S': '#e0a070', 'e': '#283040', 'p': '#f89898', 'B': '#70a0f8', 'b': '#3868d0', 'n': '#2848a0',
             'N': '#182868', 'y': '#f8e070', 'Y': '#c89828', 'w': '#f8f8f8', 'v': '#b0b8c8', 'g': '#7a4a28', 'f': '#585868', 'F': '#282838'}
def bruno_grid():
    return [[BRUNO_PAL[c] if c != '.' else None for c in row] for row in BRUNO_ROWS]

def marla():
    s = S({'hat': '#303040', 'feather': '#f05068', 'hair': '#8a5830', 'skin': SKIN, 'coat': '#c83830', 'shirt': '#f0f0f0', 'pants': '#3c4070', 'shoes': '#3a2a1e', 'blade': '#e0e8f0'}, D(skull='#f8f8f8', patch='#1e1828', gold='#f8d040'))
    s.mrect(3, 6, 4, 13, 'hair')
    s.rrect(4, 4, 11, 10, 'skin', 2)
    s.poly([(0, 4), (4, 0), (8, 2), (12, 0), (16, 4), (12, 5), (4, 5)], 'hat'); s.rect(2, 4, 13, 5, 'hat')
    s.rect(7, 2, 8, 3, 'skull'); s.poly([(11, 1), (16, -1), (14, 2)], 'feather')
    s.px(6, 7, 'eye'); s.px(6, 8, 'eye'); s.rect(8, 7, 10, 8, 'patch'); s.line(5, 6, 10, 6, 'patch')
    s.rect(3, 11, 12, 17, 'coat'); s.mrect(2, 12, 2, 16, 'coat'); s.mpx(2, 17, 'skin')
    s.rect(6, 11, 9, 15, 'shirt'); s.rect(5, 15, 10, 15, 'hat'); s.rect(7, 15, 8, 15, 'gold'); s.mpx(5, 13, 'gold')
    s.mrect(5, 18, 6, 18, 'pants'); s.mrect(4, 19, 6, 19, 'shoes')
    s.line(13, 16, 15, 8, 'blade'); s.rect(12, 16, 14, 16, 'gold')
    return s

def rocco():
    s = S({'rock': '#a09488', 'rock2': '#7a7068', 'moss': '#60a850'}, D(glow='#f8b030', crack='#3a322e'))
    s.rrect(2, 1, 13, 10, 'rock', 3); s.rrect(4, 0, 11, 2, 'moss', 1)
    s.rect(4, 5, 6, 6, 'glow'); s.rect(9, 5, 11, 6, 'glow'); s.rect(5, 8, 10, 8, 'crack')
    s.rrect(1, 10, 14, 17, 'rock', 3); s.mrect(0, 11, 1, 16, 'rock2'); s.mrect(0, 16, 2, 18, 'rock')
    s.mrect(3, 18, 6, 19, 'rock2')
    s.line(5, 12, 7, 14, 'crack'); s.line(10, 12, 11, 15, 'crack'); s.px(8, 13, 'glow'); s.rect(4, 10, 6, 10, 'moss')
    return s

def mumbo():
    s = S({'nemes': '#3858d0', 'wrap': '#ece0c4', 'wrap2': '#c0b090', 'collar': '#f0c838'}, D(gold='#f8d040', void='#2a2418', glow='#80ff70'))
    s.poly([(1, 13), (3, 2), (13, 2), (15, 13), (12, 13), (11, 6), (5, 6), (4, 13)], 'nemes')
    for y in (5, 8, 11): s.mrect(1, y, 4, y, 'gold')
    s.rrect(3, 0, 12, 4, 'collar', 2); s.rect(7, 0, 8, 1, 'nemes')
    s.rrect(5, 4, 10, 11, 'wrap', 2)
    s.rect(5, 6, 10, 8, 'void'); s.px(6, 7, 'glow'); s.px(9, 7, 'glow')
    s.line(5, 10, 10, 9, 'wrap2')
    s.rect(3, 12, 12, 17, 'wrap'); s.mrect(2, 12, 2, 16, 'wrap'); s.rect(4, 12, 11, 13, 'collar')
    s.line(3, 15, 12, 16, 'wrap2'); s.mrect(5, 18, 6, 18, 'wrap2'); s.mrect(4, 19, 6, 19, 'wrap2')
    return s

def rex():
    s = S({'scale': '#4cb050', 'mech': '#b0bac8', 'mech2': '#707a8c'}, D(red='#ff3b3b', tooth='#f8f8f8', mouth='#7a2828', core='#58f0ff'))
    s.rrect(2, 0, 13, 9, 'scale', 3)
    s.rect(4, 3, 5, 4, 'red'); s.rect(10, 3, 11, 4, 'red'); s.rect(3, 6, 12, 8, 'mouth')
    for x in range(4, 12, 2): s.px(x, 6, 'tooth')
    s.rrect(3, 9, 12, 11, 'mech2', 1)
    s.rrect(1, 11, 14, 17, 'mech', 2); s.rect(6, 12, 9, 15, 'mech2'); s.rect(7, 13, 8, 14, 'core')
    s.mrect(0, 12, 1, 16, 'mech2'); s.mrect(0, 17, 2, 18, 'scale')
    s.mrect(3, 18, 6, 19, 'mech2')
    return s

def chrono():
    s = S({'robe': '#3c5cd8', 'robe2': '#28409a', 'skin': SKIN, 'beard': '#f4f4f8', 'wood': '#7a4a28', 'glass': '#90d0ff'}, D(star='#f8d040', sand='#f8d040'))
    s.poly([(3, 5), (12, 5), (9, -1), (6, 0)], 'robe'); s.rect(1, 5, 14, 6, 'robe2'); s.px(7, 2, 'star'); s.px(9, 3, 'star')
    s.rrect(4, 6, 11, 11, 'skin', 2)
    eyes(s, 7, h=1)
    s.rect(3, 12, 12, 18, 'robe'); s.mrect(2, 13, 2, 17, 'robe'); s.rect(3, 18, 12, 19, 'robe2')
    s.poly([(4, 9), (12, 9), (10, 16), (8, 17), (5, 16)], 'beard'); s.rect(6, 9, 9, 9, 'skin')
    s.rect(14, 5, 14, 19, 'wood'); s.rect(13, 1, 15, 1, 'star'); s.rect(13, 5, 15, 5, 'star'); s.rect(13, 2, 15, 2, 'glass'); s.rect(14, 3, 14, 3, 'glass'); s.rect(13, 4, 15, 4, 'sand')
    return s

ORDER = ['bruno', 'marla', 'rocco', 'mumbo', 'rex', 'chrono', 'zip', 'nova', 'gus', 'dusty', 'bao', 'kit', 'yuki', 'volt', 'hex', 'luna', 'ragnar', 'vex', 'zorp', 'ember']
FN = {'marla': marla, 'rocco': rocco, 'mumbo': mumbo, 'rex': rex, 'chrono': chrono, 'zip': zip_, 'nova': nova, 'gus': gus, 'dusty': dusty, 'bao': bao,
      'kit': kit, 'yuki': yuki, 'volt': volt, 'hex': hex_, 'luna': luna, 'ragnar': ragnar, 'vex': vex, 'zorp': zorp, 'ember': ember}
NAMES = {'bruno': 'Sir Bruno', 'marla': 'Marla', 'rocco': 'Rocco', 'mumbo': 'Mumbo', 'rex': 'Titan Rex', 'chrono': 'Chrono', 'zip': 'Zip-9', 'nova': 'Nova', 'gus': 'Gus',
         'dusty': 'Dusty', 'bao': 'Chef Bao', 'kit': 'Kit', 'yuki': 'Yuki', 'volt': 'Volt', 'hex': 'Hex', 'luna': 'Luna', 'ragnar': 'Ragnar', 'vex': 'Vex', 'zorp': 'Zorp', 'ember': 'Ember'}

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    grids = {k: (bruno_grid() if k == 'bruno' else FN[k]().finish()) for k in ORDER}
    sc, cols = 8, 5; cw, ch = W * sc + 36, H * sc + 56
    img = Image.new('RGB', (cols * cw + 20, 4 * ch + 60), (29, 24, 56)); d = ImageDraw.Draw(img)
    fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
    d.text((img.width // 2, 26), 'Gold border = Captain', fill=(255, 210, 63), font=fb, anchor='mm')
    for i, k in enumerate(ORDER):
        r, c = divmod(i, cols)
        ox = 10 + c * cw + 18; oy = 56 + r * ch
        cap = k in ('bruno', 'marla', 'rocco', 'mumbo', 'rex', 'chrono')
        d.rounded_rectangle([ox - 12, oy - 8, ox + W * sc + 12, oy + H * sc + 34], 12, fill=(47, 40, 88) if cap else (38, 32, 74), outline=(255, 210, 63) if cap else None, width=3)
        for y in range(H):
            for x in range(W):
                cc = grids[k][y][x]
                if cc: d.rectangle([ox + x * sc, oy + y * sc, ox + x * sc + sc - 1, oy + y * sc + sc - 1], fill=rgb(cc))
        d.text((ox + W * sc // 2, oy + H * sc + 18), NAMES[k], fill=(255, 255, 255), font=fb, anchor='mm')
    img.save(os.path.join(here, 'gba_sheet.png'))
    json.dump({k: {'w': W, 'h': H, 'rows': [[c for c in row] for row in grids[k]]} for k in ORDER}, open(os.path.join(here, 'sprites_gba.json'), 'w'))
    print('ok')
