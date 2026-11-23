#!/usr/bin/env python3
"""Builds Rift Squad into dist/pwa (GitHub Pages, offline) and dist/artifact (single page)."""
import base64, json, os, hashlib
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
def rd(p): return open(os.path.join(SRC, p), encoding='utf-8').read()

# Jersey 10 pixel font (SIL OFL) — fonts/jersey-10-latin-400-normal.woff2
font = base64.b64encode(open(os.path.join(ROOT, 'fonts', 'jersey-10-latin-400-normal.woff2'), 'rb').read()).decode()
sprites = json.load(open(os.path.join(SRC, 'sprites.json')))
sprites32 = json.load(open(os.path.join(SRC, 'sprites_gba.json')))
css = rd('style.css').replace('/*FONT*/', font)
js = '\n;\n'.join(rd(f) for f in ['data.js', 'battle.js', 'progress.js', 'render.js', 'music.js', 'ui.js', 'tutorial.js'])
tpl = rd('index.template.html')
version = hashlib.sha1((css + js + json.dumps(sprites) + json.dumps(sprites32)).encode()).hexdigest()[:8]

def page(pwa, mode=None):
    mode = mode or ('pwa' if pwa else 'artifact')
    h = tpl.replace('/*CSS*/', css).replace('/*SPRITES*/', json.dumps(sprites, separators=(',', ':'))).replace('/*SPRITES32*/', json.dumps(sprites32, separators=(',', ':'))).replace('/*JS*/', "const BUILD = '%s';\n" % mode + js)
    if pwa:
        h = h.replace('<!--PWA-->', '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-180.png">\n<link rel="icon" href="icon-192.png">')
        h = h.replace('/*SWREG*/', "if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {})); }")
    else:
        h = h.replace('<!--PWA-->', '').replace('/*SWREG*/', '')
    return h

def icon(size, pad):
    """Pixel icon: rift portal + relic + hero, drawn at 32px then scaled with nearest neighbour."""
    base = 32
    im = Image.new('RGBA', (base, base), (20, 17, 42, 255))
    px = im.load()
    import math
    for y in range(base):
        for x in range(base):
            dx, dy = (x - 15.5) / 14.0, (y - 13.5) / 11.0
            d = math.sqrt(dx * dx + dy * dy)
            if d < 1.0:
                ring = int((d * 5 + math.atan2(dy, dx) * 0.8) * 2) % 3
                px[x, y] = [(123, 63, 209, 255), (179, 107, 255, 255), (79, 35, 145, 255)][ring] if d > 0.55 else (40, 24, 80, 255)
    def stamp(name, ox, oy):
        spr = sprites[name]; pal = dict(sprites['_common']); pal.update(spr.get('pal', {}))
        for y, row in enumerate(spr['rows']):
            for x, ch in enumerate(row):
                if ch == '.': continue
                c = pal[ch].lstrip('#'); px[ox + x, oy + y] = tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    stamp('relic', 8, 1)
    stamp('kit', 1, 15); stamp('bruno', 15, 15)
    out = Image.new('RGBA', (size, size), (20, 17, 42, 255))
    inner = size - pad * 2
    out.paste(im.resize((inner, inner), Image.NEAREST), (pad, pad))
    return out.convert('RGB')

OUT = os.environ.get('RIFT_OUT', os.path.join(ROOT, 'dist'))
pwa = os.path.join(OUT, 'pwa'); art = os.path.join(OUT, 'artifact')
os.makedirs(pwa, exist_ok=True); os.makedirs(art, exist_ok=True)
open(os.path.join(pwa, 'index.html'), 'w', encoding='utf-8').write(page(True))
open(os.path.join(art, 'index.html'), 'w', encoding='utf-8').write(page(False))
tst = os.path.join(OUT, 'test'); os.makedirs(tst, exist_ok=True)
open(os.path.join(tst, 'index.html'), 'w', encoding='utf-8').write(page(False, 'test'))
open(os.path.join(pwa, 'sw.js'), 'w').write(rd('sw.js').replace('__VERSION__', version))
manifest = {
    'name': 'Rift Squad', 'short_name': 'Rift Squad', 'description': 'Offline pixel squad-tactics game',
    'start_url': './index.html', 'scope': './', 'display': 'standalone', 'orientation': 'portrait',
    'background_color': '#14112a', 'theme_color': '#14112a',
    'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}],
}
json.dump(manifest, open(os.path.join(pwa, 'manifest.webmanifest'), 'w'), indent=2)
icon(192, 0).save(os.path.join(pwa, 'icon-192.png'))
icon(512, 0).save(os.path.join(pwa, 'icon-512.png'))
icon(180, 10).save(os.path.join(pwa, 'icon-180.png'))
print('built', version, 'index.html', len(page(True)) // 1024, 'KB')
