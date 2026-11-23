#!/usr/bin/env python3
"""Rift Squad 32x32 hero art. Draws each hero from shapes, then auto-shades and auto-outlines.
Outputs art/sprites32.json (palette + rows per sprite) and art/sheet32.png (preview)."""
import json, colorsys, os, sys
from PIL import Image, ImageDraw

N = 32
OUT = '#1b1325'

def hex2rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def rgb2hex(c): return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in c)
def shade(h, dl, ds=0.0):
    r, g, b = [v / 255 for v in hex2rgb(h)]
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    l = max(0, min(1, l + dl)); s = max(0, min(1, s + ds))
    return rgb2hex([v * 255 for v in colorsys.hls_to_rgb(hh, l, s)])

class Spr:
    def __init__(self, mats):
        # mats: name -> base color or dict(base, light, dark, flat)
        self.m = {}
        for k, v in mats.items():
            if isinstance(v, str): v = {'base': v}
            v.setdefault('light', shade(v['base'], 0.10, 0.03)); v.setdefault('dark', shade(v['base'], -0.16))
            v.setdefault('flat', False); self.m[k] = v
        self.m.setdefault('k', {'base': OUT, 'flat': True, 'light': OUT, 'dark': OUT})
        self.g = [[None] * N for _ in range(N)]
    def px(self, x, y, m):
        if 0 <= x < N and 0 <= y < N: self.g[y][x] = m
    def rect(self, x0, y0, x1, y1, m):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.px(x, y, m)
    def rrect(self, x0, y0, x1, y1, m, r=2):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = max(x0 + r - x, 0, x - (x1 - r)); dy = max(y0 + r - y, 0, y - (y1 - r))
                if dx * dx + dy * dy <= r * r + 0.5: self.px(x, y, m)
    def ell(self, cx, cy, rx, ry, m):
        for y in range(N):
            for x in range(N):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0: self.px(x, y, m)
    def poly(self, pts, m):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            for i in range(len(pts)):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
                if (y0 <= y + 0.5 < y1) or (y1 <= y + 0.5 < y0):
                    xs.append(x0 + (y + 0.5 - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(round(xs[i])), int(round(xs[i + 1])) ):
                    self.px(x, y, m)
    def line(self, x0, y0, x1, y1, m):
        n = max(abs(x1 - x0), abs(y1 - y0)) or 1
        for i in range(n + 1): self.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), m)
    def sym(self, fn, *a, **kw):
        """draw a shape and its mirror across the vertical center (x -> 31-x)."""
        fn(*a, **kw)
        saved = [row[:] for row in self.g]
        # mirror only what changed is hard; instead callers use msym helpers below
    def mpx(self, x, y, m): self.px(x, y, m); self.px(N - 1 - x, y, m)
    def mrect(self, x0, y0, x1, y1, m): self.rect(x0, y0, x1, y1, m); self.rect(N - 1 - x1, y0, N - 1 - x0, y1, m)
    def mline(self, x0, y0, x1, y1, m): self.line(x0, y0, x1, y1, m); self.line(N - 1 - x0, y0, N - 1 - x1, y1, m)
    def mpoly(self, pts, m): self.poly(pts, m); self.poly([(N - x, y) for x, y in pts], m)

    def finish(self):
        """auto-shade every material region (light top edge, dark bottom/right), then outline."""
        g = self.g; out = [[None] * N for _ in range(N)]
        for y in range(N):
            for x in range(N):
                m = g[y][x]
                if m is None: continue
                M = self.m[m]
                if M['flat']: out[y][x] = M['base']; continue
                up = g[y - 1][x] if y > 0 else None
                dn = g[y + 1][x] if y < N - 1 else None
                rt = g[y][x + 1] if x < N - 1 else None
                if up != m: out[y][x] = M['light']
                elif dn != m or rt != m: out[y][x] = M['dark']
                else: out[y][x] = M['base']
        # outline: empty pixels 4-adjacent to a filled one
        res = [row[:] for row in out]
        for y in range(N):
            for x in range(N):
                if out[y][x] is not None: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < N and 0 <= yy < N and out[yy][xx] is not None and out[yy][xx] != OUT:
                        res[y][x] = OUT; break
        return res

# ---------- shared body parts ----------
def chibi(s, top, pants, boots, skin='skin', arms=None, big=False):
    """standard chibi body under a head. big=True for captains (wider, taller)."""
    arms = arms or top
    if big:
        s.rrect(8, 19, 23, 27, top, 2)          # torso
        s.mrect(5, 20, 7, 25, arms)             # arms
        s.mrect(5, 26, 7, 27, skin)             # hands
        s.mrect(10, 28, 14, 29, pants); s.mrect(10, 30, 15, 30, boots)
    else:
        s.rrect(10, 19, 21, 26, top, 1)
        s.mrect(8, 20, 9, 24, arms)
        s.mrect(8, 25, 9, 26, skin)
        s.mrect(11, 27, 14, 28, pants); s.mrect(11, 29, 15, 29, boots)

def head(s, skin='skin', big=False):
    if big: s.rrect(7, 4, 24, 18, skin, 5)
    else: s.rrect(8, 5, 23, 18, skin, 5)

def eyes(s, y=11, gap=0, col='eye', shine=True, h=3, big=False):
    lx = 11 - gap
    s.rect(lx, y, lx + 1, y + h - 1, col); s.rect(N - 2 - lx, y, N - 1 - lx, y + h - 1, col)
    if shine: s.px(lx, y, 'shine'); s.px(N - 2 - lx, y, 'shine')

def blush(s, y=15): s.mpx(10, y, 'blush')

BASE = {'skin': '#f2c29b', 'eye': {'base': '#1b1325', 'flat': True}, 'shine': {'base': '#ffffff', 'flat': True},
        'blush': {'base': '#ff9aa8', 'flat': True}, 'mouth': {'base': '#9c3a3a', 'flat': True}, 'white': '#f4f4f8',
        'steel': '#c3ccd8', 'gold': '#ffd23f', 'wood': '#8a5a32', 'dark': '#3d3550'}
def P(**kw):
    d = dict(BASE); d.update(kw); return d

# ---------- regular heroes ----------
def zip_():
    s = Spr(P(metal='#aab6c4', metal2='#7d8894', visor={'base': '#1b2433', 'flat': True}, glow={'base': '#4ff0ff', 'flat': True},
              orange='#ff8a2a', gun='#4a5160', bulb={'base': '#ffd23f', 'flat': True}))
    s.rect(15, 1, 16, 4, 'metal2'); s.rect(14, 0, 17, 1, 'bulb')
    s.rrect(7, 5, 24, 18, 'metal', 2)
    s.rect(9, 9, 22, 14, 'visor'); s.rect(11, 11, 13, 12, 'glow'); s.rect(18, 11, 20, 12, 'glow')
    s.mrect(5, 9, 6, 13, 'metal2')
    for x in range(11, 21, 2): s.px(x, 16, 'metal2')
    s.rect(14, 19, 17, 19, 'metal2')
    chibi(s, 'metal', 'metal2', 'gun', skin='metal2', arms='metal2')
    s.rect(13, 21, 18, 24, 'orange'); s.rect(15, 22, 16, 23, 'bulb')
    s.rect(22, 21, 28, 24, 'gun'); s.rect(28, 22, 29, 23, 'glow')
    return s

def nova():
    s = Spr(P(hair='#ff7ab8', coat='#f4f4f8', cross={'base': '#e5383b', 'flat': True}, pants='#4a5bd4', boots='#2f2a4a', kit='#3ccf6e'))
    s.rrect(6, 3, 25, 20, 'hair', 7)
    head(s); s.rect(8, 5, 23, 9, 'hair'); s.mrect(8, 10, 9, 18, 'hair')
    s.px(12, 9, 'skin'); s.px(19, 9, 'skin')
    s.mpx(9, 4, 'gold'); s.px(22, 5, 'gold')
    eyes(s); blush(s); s.rect(15, 16, 16, 16, 'mouth')
    chibi(s, 'coat', 'pants', 'boots')
    s.rect(15, 20, 16, 25, 'cross'); s.rect(13, 22, 18, 23, 'cross')
    s.rect(23, 22, 27, 26, 'kit'); s.rect(24, 23, 26, 25, 'white'); s.px(25, 24, 'cross')
    return s

def gus():
    s = Spr(P(skin='#6cc24a', eye={'base': '#ffd23f', 'flat': True}, pupil={'base': '#1b1325', 'flat': True}, vest='#7a4a2a', belt='#4e2e1a', pants='#5a4632', boots='#3a2a1e', fang={'base': '#ffffff', 'flat': True}))
    s.mpoly([(2, 8), (9, 10), (9, 14)], 'skin')
    head(s)
    s.rect(11, 10, 13, 12, 'eye'); s.rect(18, 10, 20, 12, 'eye'); s.px(12, 11, 'pupil'); s.px(19, 11, 'pupil'); s.px(13, 11, 'pupil'); s.px(20, 11, 'pupil')
    s.rect(12, 15, 19, 16, 'mouth'); s.px(13, 15, 'fang'); s.px(18, 15, 'fang')
    s.mrect(10, 6, 12, 7, 'skin'); s.px(15, 4, 'skin'); s.px(16, 4, 'skin')
    chibi(s, 'vest', 'pants', 'boots')
    s.rect(14, 19, 17, 26, 'skin'); s.rect(10, 25, 21, 26, 'belt'); s.rect(15, 25, 16, 26, 'gold')
    s.line(24, 18, 26, 26, 'steel'); s.rect(23, 25, 26, 26, 'wood')
    return s

def dusty():
    s = Spr(P(hat='#8a5a32', band='#4e2e1a', stache='#4e2e1a', band2={'base': '#d6453d'}, vest='#c98a3a', shirt='#f4f4f8', pants='#3f6fb5', boots='#5a3a1e', gun='#4a4a58'))
    head(s)
    s.rect(9, 2, 22, 8, 'hat'); s.rect(9, 6, 22, 7, 'band'); s.rect(3, 8, 28, 9, 'hat'); s.mrect(3, 7, 4, 7, 'hat')
    eyes(s, y=11, h=2); s.rect(12, 14, 19, 15, 'stache'); s.mpx(11, 15, 'stache')
    s.rect(11, 18, 20, 19, 'band2'); s.rect(14, 20, 17, 21, 'band2')
    chibi(s, 'shirt', 'pants', 'boots', arms='shirt')
    s.rect(10, 19, 12, 26, 'vest'); s.rect(19, 19, 21, 26, 'vest'); s.px(11, 22, 'gold'); s.px(20, 22, 'gold')
    s.rect(23, 23, 29, 24, 'gun'); s.rect(23, 25, 24, 27, 'wood')
    return s

def bao():
    s = Spr(P(hatw='#f4f4f8', jacket='#f4f4f8', btn={'base': '#c9d3e0', 'flat': True}, scarf='#e03c3c', pants='#3b3f6b', boots='#2a2a3a', stache='#3a2a1e', ladle='#c3ccd8'))
    s.ell(15.5, 4, 9, 4.5, 'hatw'); s.rect(10, 5, 21, 8, 'hatw')
    head(s); s.rect(9, 7, 22, 8, 'hatw')
    eyes(s, y=11, h=2); s.mpx(10, 14, 'blush'); s.mpx(11, 14, 'blush')
    s.rect(12, 15, 19, 15, 'stache'); s.mpx(11, 16, 'stache'); s.rect(15, 17, 16, 17, 'mouth')
    chibi(s, 'jacket', 'pants', 'boots')
    s.rect(11, 19, 20, 20, 'scarf'); s.rect(13, 21, 13, 21, 'scarf')
    for y in (22, 24): s.px(13, y, 'btn'); s.px(18, y, 'btn')
    s.line(26, 14, 26, 25, 'ladle'); s.rect(24, 12, 28, 14, 'ladle')
    return s

def kit():
    s = Spr(P(hood='#2d2a4a', mask='#1f1c36', band='#e03c3c', suit='#2d2a4a', sash='#e03c3c', boots='#1b1830', blade='#e8eef5'))
    s.rrect(7, 4, 24, 19, 'hood', 5)
    s.rect(9, 9, 22, 13, 'skin'); s.rect(9, 13, 22, 18, 'mask')
    eyes(s, y=10, h=2)
    s.rect(8, 7, 23, 8, 'band'); s.rect(24, 7, 27, 8, 'band'); s.rect(26, 9, 29, 10, 'band'); s.px(29, 11, 'band')
    chibi(s, 'suit', 'suit', 'boots')
    s.rect(10, 23, 21, 24, 'sash')
    s.line(3, 30, 9, 18, 'blade'); s.rect(8, 17, 10, 19, 'wood')
    s.mpx(26, 26, 'steel'); s.px(25, 27, 'steel'); s.px(27, 27, 'steel'); s.px(26, 28, 'steel'); s.px(26, 27, 'dark')
    return s

def yuki():
    s = Spr(P(fur='#f0f4fa', face={'base': '#7cc8f2'}, horn='#c9d3e0', fang={'base': '#ffffff', 'flat': True}, fist='#7cc8f2'))
    s.ell(15.5, 13, 12, 11, 'fur')
    s.rrect(6, 18, 25, 28, 'fur', 5)
    s.mrect(2, 17, 5, 25, 'fur'); s.mrect(2, 25, 5, 27, 'fist')
    s.mrect(9, 29, 13, 30, 'fur')
    s.rrect(9, 8, 22, 17, 'face', 3)
    eyes(s, y=10, h=2); s.rect(12, 14, 19, 15, 'mouth'); s.px(13, 14, 'fang'); s.px(18, 14, 'fang')
    s.mrect(6, 2, 7, 5, 'horn')
    return s

def volt():
    s = Spr(P(helm='#ffd23f', visor={'base': '#1b2433', 'flat': True}, glow={'base': '#4ff0ff', 'flat': True}, suit='#2e3440', stripe='#ffd23f', stripe2='#f4f4f8', gaunt='#8a96a6', boots='#1b1f28'))
    s.rrect(7, 3, 24, 18, 'helm', 6)
    s.rrect(9, 9, 22, 14, 'visor', 2); s.rect(11, 11, 15, 11, 'glow'); s.px(12, 10, 'shine')
    s.rect(15, 3, 16, 7, 'stripe2')
    chibi(s, 'suit', 'suit', 'boots', skin='gaunt')
    s.rect(14, 19, 17, 26, 'stripe'); s.mrect(10, 19, 11, 20, 'stripe')
    s.rrect(22, 19, 27, 26, 'gaunt', 1); s.rect(24, 22, 25, 23, 'glow')
    return s

def hex_():
    s = Spr(P(hat='#7b3fd1', band='#ffd23f', hair='#5bd97a', robe='#6a34b8', robe2='#4f2391', orb={'base': '#b8ff5c', 'flat': True}, staff='#8a5a32'))
    head(s); s.mrect(8, 9, 9, 20, 'hair'); s.rect(8, 8, 23, 9, 'hair')
    s.poly([(10, 8), (22, 8), (18, -1), (13, 2)], 'hat'); s.poly([(18, -1), (24, 2), (21, 3)], 'hat')
    s.rect(3, 7, 28, 8, 'hat'); s.rect(10, 6, 21, 7, 'band')
    eyes(s, y=11); blush(s); s.px(15, 16, 'mouth'); s.px(16, 16, 'mouth')
    chibi(s, 'robe', 'robe2', 'robe2')
    s.rect(10, 27, 21, 29, 'robe2'); s.rect(15, 20, 16, 21, 'band')
    s.line(26, 9, 26, 30, 'staff'); s.ell(26, 7, 2.2, 2.2, 'orb'); s.px(25, 6, 'shine')
    return s

def luna():
    s = Spr(P(suit='#f0f2f8', glass={'base': '#22305a'}, refl={'base': '#8fd3ff', 'flat': True}, trim='#ff8a2a', pack='#c9d3e0', boots='#9aa3b5'))
    s.rrect(5, 4, 26, 21, 'suit', 8)
    s.rrect(8, 8, 23, 18, 'glass', 4); s.line(10, 10, 13, 9, 'refl'); s.px(10, 11, 'refl'); s.rect(19, 15, 20, 15, 'refl')
    s.rect(13, 13, 14, 14, 'shine'); s.rect(18, 13, 19, 14, 'shine')
    s.mrect(4, 20, 6, 25, 'pack')
    chibi(s, 'suit', 'suit', 'boots', skin='suit')
    s.rect(13, 21, 18, 23, 'trim'); s.rect(15, 22, 16, 22, 'refl'); s.mrect(10, 26, 21, 26, 'trim')
    s.px(25, 3, 'trim'); s.line(24, 4, 24, 6, 'pack')
    return s

def ragnar():
    s = Spr(P(helm='#a9b3c1', horn='#f3e6c4', beard='#e07b2a', fur='#7a5a3a', tunic='#5a7a9a', pants='#5a4632', boots='#3a2a1e', axe='#c3ccd8'))
    head(s)
    s.rrect(8, 3, 23, 9, 'helm', 4); s.rect(15, 3, 16, 10, 'helm')
    s.mpoly([(10, 5), (9, 8), (4, 6), (2, 1), (3, 0), (6, 4)], 'horn'); s.mrect(2, 0, 3, 2, 'horn'); s.mrect(7, 5, 9, 7, 'horn')
    eyes(s, y=11, h=2)
    s.poly([(9, 14), (23, 14), (20, 24), (16, 26), (12, 24)], 'beard'); s.rect(13, 14, 18, 15, 'skin'); s.rect(14, 15, 17, 15, 'mouth')
    s.mpx(13, 20, 'gold'); s.mpx(14, 23, 'gold')
    chibi(s, 'tunic', 'pants', 'boots', arms='fur')
    s.mrect(8, 19, 11, 21, 'fur')
    s.line(26, 12, 26, 29, 'wood'); s.poly([(26, 10), (31, 9), (31, 17), (26, 15)], 'axe')
    return s

def vex():
    s = Spr(P(skin='#ece3f5', hair='#22182e', eye={'base': '#e0193a', 'flat': True}, cape='#2a1f3d', lining='#b3123a', shirt='#f4f4f8', pants='#3a2a50', boots='#1b1325', fang={'base': '#ffffff', 'flat': True}))
    s.mpoly([(3, 30), (8, 19), (10, 30)], 'cape'); s.mpoly([(5, 30), (8, 22), (9, 30)], 'lining')
    s.mpoly([(4, 12), (9, 17), (9, 22), (5, 20)], 'lining')
    head(s); s.rrect(8, 4, 23, 9, 'hair', 4); s.poly([(13, 9), (18, 9), (15.5, 12)], 'hair'); s.mrect(8, 9, 8, 13, 'hair')
    eyes(s, y=12, h=2); s.rect(14, 16, 17, 16, 'mouth'); s.px(14, 17, 'fang'); s.px(17, 17, 'fang')
    chibi(s, 'shirt', 'pants', 'boots', arms='cape')
    s.rect(14, 19, 17, 21, 'lining'); s.rect(15, 20, 16, 20, 'gold')
    s.mrect(10, 19, 11, 26, 'cape')
    return s

def zorp():
    s = Spr(P(skin='#7ee05a', eye={'base': '#141018', 'flat': True}, ball={'base': '#ff6bd6', 'flat': True}, suit='#8e44ad', suit2='#5e2a78', gun='#4a5160', glow={'base': '#4ff0ff', 'flat': True}))
    s.mline(10, 6, 7, 1, 'skin'); s.mrect(5, 0, 7, 1, 'ball')
    s.ell(15.5, 11, 11, 8.5, 'skin')
    s.mpoly([(8, 10), (14, 11), (13, 15), (9, 14)], 'eye'); s.px(10, 11, 'shine'); s.px(19, 11, 'shine'); s.px(11, 11, 'shine')
    s.rect(14, 17, 17, 17, 'mouth')
    s.rect(13, 19, 18, 20, 'skin')
    chibi(s, 'suit', 'suit2', 'suit2', skin='skin')
    s.mpx(12, 22, 'gold'); s.rect(15, 21, 16, 23, 'suit2')
    s.rect(22, 22, 27, 24, 'gun'); s.rect(27, 22, 28, 23, 'glow'); s.px(29, 22, 'glow')
    return s

def ember():
    s = Spr(P(f1={'base': '#e8402a'}, f2={'base': '#ff8a2a'}, f3={'base': '#ffe066', 'flat': True}, robe='#c0392b', robe2='#7a1f1f', trim='#ffd23f', ball={'base': '#ffb02e'}))
    s.poly([(7, 12), (6, 4), (10, 7), (11, 0), (15, 5), (18, -1), (20, 5), (25, 1), (24, 8), (26, 12)], 'f1')
    s.poly([(9, 9), (11, 3), (14, 7), (18, 2), (19, 7), (23, 4), (22, 9)], 'f2'); s.px(11, 4, 'f3'); s.px(18, 3, 'f3'); s.px(22, 5, 'f3')
    head(s); s.rect(8, 7, 23, 9, 'f1'); s.mrect(8, 10, 8, 15, 'f1')
    eyes(s, y=11); blush(s); s.rect(15, 16, 16, 16, 'mouth')
    chibi(s, 'robe', 'robe2', 'robe2')
    s.rect(10, 27, 21, 29, 'robe2'); s.rect(15, 19, 16, 26, 'trim'); s.rect(10, 24, 21, 24, 'trim')
    s.ell(26, 21, 3, 3, 'ball'); s.ell(26, 21, 1.6, 1.6, 'f3'); s.px(27, 17, 'f2'); s.px(25, 16, 'f1')
    return s

# ---------- captains (bigger, fill the frame) ----------
def bruno():
    s = Spr(P(plate='#c3ccd8', plate2='#8a96aa', plume='#e03c3c', tabard='#3a6fd8', shield='#3a6fd8', boots='#6f7a8c', blade='#e8eef5'))
    s.poly([(13, 4), (15, -1), (20, 0), (18, 4)], 'plume')
    s.rrect(6, 3, 25, 18, 'plate', 6)
    s.rrect(10, 8, 21, 17, 'skin', 3); s.rect(10, 8, 21, 9, 'plate2'); s.rect(15, 3, 16, 9, 'plate2')
    eyes(s, y=11, h=2); s.rect(14, 15, 17, 15, 'mouth')
    chibi(s, 'tabard', 'plate2', 'boots', skin='plate', arms='plate', big=True)
    s.mrect(5, 19, 9, 21, 'plate')
    s.rect(13, 21, 18, 25, 'gold'); s.rect(15, 20, 16, 26, 'gold'); s.rect(14, 22, 17, 24, 'tabard')
    # kite shield (left) + sword (right)
    s.poly([(0, 18), (8, 18), (8, 25), (4, 30), (0, 25)], 'shield'); s.rect(3, 19, 5, 27, 'gold'); s.rect(1, 21, 7, 22, 'gold')
    s.rect(27, 5, 28, 22, 'blade'); s.rect(25, 22, 30, 23, 'gold'); s.rect(27, 24, 28, 27, 'wood')
    return s

def marla():
    s = Spr(P(hat='#2b2b3a', skull={'base': '#f4f4f8', 'flat': True}, feather='#ff4f6b', hair='#8a5a32', coat='#c0392b', coat2='#8e2a20', shirt='#f4f4f8', pants='#3b3f6b', boots='#3a2a1e', patch={'base': '#1b1325', 'flat': True}, blade='#e8eef5'))
    s.rrect(7, 6, 24, 19, 'skin', 6); s.mrect(7, 9, 8, 21, 'hair'); s.rect(23, 18, 25, 24, 'hair')
    s.poly([(2, 8), (8, 1), (15, 4), (23, 1), (29, 8), (24, 10), (8, 10)], 'hat'); s.rect(5, 8, 26, 10, 'hat')
    s.rect(14, 4, 17, 6, 'skull'); s.px(15, 5, 'patch'); s.px(16, 5, 'patch')
    s.poly([(22, 3), (30, -1), (27, 4)], 'feather')
    s.rect(11, 12, 12, 14, 'eye'); s.px(11, 12, 'shine'); s.rect(18, 12, 21, 14, 'patch'); s.line(13, 11, 21, 11, 'patch')
    s.rect(14, 17, 17, 17, 'mouth'); s.px(10, 16, 'blush')
    chibi(s, 'coat', 'pants', 'boots', arms='coat', big=True)
    s.rect(12, 19, 19, 27, 'shirt'); s.mpx(11, 21, 'gold'); s.mpx(11, 24, 'gold'); s.rect(8, 27, 23, 28, 'coat2')
    s.rect(12, 24, 19, 25, 'hat'); s.rect(15, 24, 16, 25, 'gold')
    s.poly([(25, 26), (31, 13), (31, 16), (27, 27)], 'blade'); s.rect(24, 25, 28, 27, 'gold')
    return s

def rocco():
    s = Spr(P(rock='#9a8f86', rock2='#6b625b', moss='#5aa04a', glow={'base': '#ffb02e', 'flat': True}, crack={'base': '#3a322e', 'flat': True}))
    s.rrect(6, 2, 25, 16, 'rock', 5); s.rrect(9, 1, 22, 5, 'moss', 2); s.px(6, 6, 'moss'); s.px(25, 8, 'moss')
    s.rect(10, 9, 13, 11, 'glow'); s.rect(18, 9, 21, 11, 'glow'); s.rect(10, 8, 13, 8, 'crack'); s.rect(18, 8, 21, 8, 'crack')
    s.rect(12, 13, 19, 14, 'crack')
    s.rrect(3, 15, 28, 28, 'rock', 4)
    s.mrect(0, 16, 4, 27, 'rock2'); s.mrect(0, 25, 5, 30, 'rock')
    s.mrect(8, 28, 13, 30, 'rock2')
    s.line(12, 18, 15, 22, 'crack'); s.line(15, 22, 13, 25, 'crack'); s.line(20, 19, 22, 23, 'crack'); s.px(17, 21, 'glow'); s.px(14, 22, 'glow')
    s.rect(7, 16, 24, 16, 'crack'); s.rect(9, 15, 12, 15, 'moss'); s.rect(23, 17, 25, 18, 'moss')
    s.mline(1, 27, 4, 27, 'crack'); s.mpx(2, 29, 'crack')
    return s

def mumbo():
    s = Spr(P(wrap='#e8dcc0', wrap2='#b8a888', nemes='#3b5bdb', nemesg='#ffd23f', eye={'base': '#7dff6b', 'flat': True}, collar='#ffd23f', void={'base': '#2a2418', 'flat': True}))
    s.poly([(4, 22), (7, 4), (24, 4), (27, 22), (22, 22), (21, 10), (10, 10), (9, 22)], 'nemes')
    for y in (8, 12, 16, 20): s.mrect(4, y, 9, y, 'nemesg')
    s.rrect(7, 2, 24, 8, 'nemesg', 3); s.rect(14, 0, 17, 3, 'nemesg'); s.px(15, 0, 'nemes')
    s.rrect(9, 6, 22, 19, 'wrap', 4)
    s.rect(10, 10, 21, 13, 'void'); s.rect(11, 11, 13, 12, 'eye'); s.rect(18, 11, 20, 12, 'eye')
    for y in (8, 15, 17): s.line(9, y, 22, y + 1, 'wrap2')
    chibi(s, 'wrap', 'wrap', 'wrap2', skin='wrap', arms='wrap', big=True)
    s.rrect(8, 19, 23, 21, 'collar', 1); s.rect(14, 21, 17, 22, 'nemes')
    for y in (23, 25, 27): s.line(8, y, 23, y + 1, 'wrap2')
    s.line(25, 24, 29, 28, 'wrap')
    return s

def rex():
    s = Spr(P(scale='#4caf50', scale2='#2e7d32', mech='#b0bac6', mech2='#6f7a8c', eye={'base': '#ff3b3b', 'flat': True}, tooth={'base': '#ffffff', 'flat': True}, core={'base': '#4ff0ff', 'flat': True}))
    s.rrect(5, 1, 26, 14, 'scale', 5); s.mrect(6, 1, 9, 3, 'scale2')
    s.rect(9, 6, 12, 8, 'eye'); s.rect(19, 6, 22, 8, 'eye'); s.px(10, 7, 'shine'); s.px(21, 7, 'shine'); s.rect(8, 4, 13, 5, 'scale2'); s.rect(18, 4, 23, 5, 'scale2'); s.mrect(14, 9, 14, 9, 'mouth')
    s.rect(7, 11, 24, 13, 'mouth');
    for x in range(8, 24, 2): s.px(x, 11, 'tooth')
    s.rrect(6, 13, 25, 17, 'mech', 2); s.mrect(6, 13, 8, 17, 'mech2')
    s.rrect(4, 17, 27, 27, 'mech', 3)
    s.rect(13, 20, 18, 24, 'mech2'); s.rect(14, 21, 17, 23, 'core')
    s.mrect(0, 18, 4, 25, 'mech2'); s.mpoly([(0, 25), (5, 25), (4, 30), (2, 28), (0, 30)], 'scale')
    s.mrect(7, 27, 13, 30, 'mech2'); s.mrect(6, 30, 13, 30, 'scale')
    s.mpx(10, 20, 'core')
    return s

def chrono():
    s = Spr(P(robe='#3b5bdb', robe2='#253a91', star={'base': '#ffd23f', 'flat': True}, beard='#f4f4f8', beard2='#c9d3e0', glass={'base': '#8fd3ff'}, sand={'base': '#ffd23f', 'flat': True}))
    s.poly([(7, 9), (24, 9), (19, -1), (14, 1)], 'robe'); s.poly([(19, -1), (26, 0), (21, 3)], 'robe')
    s.rect(4, 8, 27, 10, 'robe2'); s.px(14, 4, 'star'); s.px(18, 6, 'star'); s.px(20, 2, 'star')
    s.rrect(8, 9, 23, 19, 'skin', 4)
    eyes(s, y=12, h=2); s.mrect(10, 11, 13, 11, 'beard2')
    s.poly([(8, 15), (23, 15), (21, 25), (15.5, 29), (10, 25)], 'beard'); s.rect(14, 15, 17, 16, 'mouth')
    chibi(s, 'robe', 'robe2', 'robe2', big=True)
    s.poly([(8, 27), (23, 27), (25, 31), (6, 31)], 'robe2')
    s.poly([(8, 15), (23, 15), (21, 25), (15.5, 29), (10, 25)], 'beard')
    s.ell(15.5, 22, 2.5, 2.5, 'star'); s.px(15, 21, 'robe2'); s.px(16, 22, 'robe2')
    s.line(28, 9, 28, 30, 'wood'); s.rect(26, 4, 30, 5, 'gold'); s.rect(26, 11, 30, 12, 'gold')
    s.rect(27, 6, 29, 7, 'glass'); s.rect(27, 9, 29, 10, 'glass'); s.px(28, 8, 'glass'); s.px(28, 10, 'sand'); s.px(27, 10, 'sand'); s.px(29, 10, 'sand')
    return s

HEROES = {'zip': zip_, 'nova': nova, 'gus': gus, 'dusty': dusty, 'bao': bao, 'kit': kit, 'yuki': yuki, 'volt': volt, 'hex': hex_,
          'luna': luna, 'ragnar': ragnar, 'vex': vex, 'zorp': zorp, 'ember': ember,
          'bruno': bruno, 'marla': marla, 'rocco': rocco, 'mumbo': mumbo, 'rex': rex, 'chrono': chrono}

ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
def encode(grid):
    pal = []; rows = []
    for row in grid:
        r = ''
        for c in row:
            if c is None: r += '.'; continue
            if c not in pal: pal.append(c)
            r += ALPHA[pal.index(c)]
        rows.append(r)
    return {'w': N, 'h': N, 'pal': pal, 'rows': rows}

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    out = {}; grids = {}
    for k, fn in HEROES.items():
        g = fn().finish(); grids[k] = g; out[k] = encode(g)
        assert len(out[k]['pal']) <= len(ALPHA), k
    json.dump(out, open(os.path.join(here, 'sprites32.json'), 'w'), separators=(',', ':'))
    S = 6; cols = 7; names = list(HEROES)
    rowsN = (len(names) + cols - 1) // cols
    img = Image.new('RGB', (cols * (N + 4) * S, rowsN * (N + 8) * S), (58, 90, 64)); d = ImageDraw.Draw(img)
    for i, k in enumerate(names):
        ox = (i % cols) * (N + 4) * S + 2 * S; oy = (i // cols) * (N + 8) * S + 2 * S
        for y in range(N):
            for x in range(N):
                c = grids[k][y][x]
                if c: d.rectangle([ox + x * S, oy + y * S, ox + x * S + S - 1, oy + y * S + S - 1], fill=c)
        d.text((ox, oy + N * S + 4), k, fill=(255, 255, 255))
    img.save(os.path.join(here, 'sheet32.png')); print('ok', len(names))
