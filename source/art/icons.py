"""Pixel-art UI icons (16x16) that replace every emoji in Rift Squad.
Writes them into src/sprites.json (same format as coin/trophy/etc.) and a preview sheet."""
import json, math, sys
from PIL import Image

W = 16
ICONS = {}

def place(mask, outline=True, dy=0):
    """Center a mask (list of strings) in 16x16 and add a 'k' outline around it."""
    h = len(mask); w = max(len(r) for r in mask)
    ox = (W - w) // 2; oy = (W - h) // 2 + dy
    g = [['.'] * W for _ in range(W)]
    for y, r in enumerate(mask):
        for x, c in enumerate(r):
            if c != '.': g[oy + y][ox + x] = c
    if outline:
        out = [row[:] for row in g]
        for y in range(W):
            for x in range(W):
                if g[y][x] != '.': continue
                for dx_, dy_ in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx_, y + dy_
                    if 0 <= X < W and 0 <= Y < W and g[Y][X] not in '.k':
                        out[y][x] = 'k'; break
        g = out
    return [''.join(r) for r in g]

def shade(mask, base, light, dark):
    """Auto-shade a one-colour blob: light on top/left edges, dark on bottom/right."""
    h = len(mask); w = max(len(r) for r in mask)
    m = [r.ljust(w, '.') for r in mask]
    f = lambda x, y: 0 <= y < h and 0 <= x < w and m[y][x] != '.'
    out = []
    for y in range(h):
        row = ''
        for x in range(w):
            c = m[y][x]
            if c != base: row += c; continue
            if not f(x, y + 1) or not f(x + 1, y): row += dark
            elif not f(x, y - 1) or not f(x - 1, y): row += light
            else: row += base
        out.append(row)
    return out

def add(name, pal, mask, **kw):
    ICONS[name] = {'pal': pal, 'rows': place(mask, **kw)}

GOLD = {'y': '#ffd23f', 'Y': '#d99a00', 'h': '#fff3a8'}

# crown
add('i_crown', dict(GOLD, r='#ff4d6d', b='#4cc9ff'), [
    'y....hh....y',
    'yy..hyyy..yY',
    'yyy.yyyy.yyY',
    'hyyyyyyyyyyY',
    'hyrryybbyrrY',
    'hyrryybbyrrY',
    'hyyyyyyyyyyY',
    'YYYYYYYYYYYY'])

HEART = [
    '.ccc...ccc.',
    'ccccc.ccccc',
    'ccccccccccc',
    'ccccccccccc',
    'ccccccccccc',
    '.ccccccccc.',
    '..ccccccc..',
    '...ccccc...',
    '....ccc....',
    '.....c.....']
def heart(fill, light, dark, plus=None):
    m = shade(HEART, 'c', light, dark)
    m = [r.replace('c', fill) for r in m]
    if plus:
        m = [list(r) for r in m]
        for x, y in [(5, 2), (4, 3), (5, 3), (6, 3), (5, 4)]: m[y][x] = plus
        m = [''.join(r) for r in m]
    # little shine
    m = [list(r) for r in m]; m[1][2] = 'w'; m = [''.join(r) for r in m]
    return m
add('i_heart', {'r': '#ef3b4f', 'h': '#ff8a96', 'R': '#a3122a', 'w': '#ffffff'}, heart('r', 'h', 'R'))
add('i_healer', {'p': '#ff6fb5', 'h': '#ffb3d9', 'P': '#c2347c', 'w': '#ffffff'}, heart('p', 'h', 'P', plus='w'))

# crossed swords (damage / fighter)
def swords():
    g = [['.'] * 12 for _ in range(12)]
    def sword(flip):
        def s(x, y, c):
            if flip: x = 11 - x
            if g[y][x] == '.' or c in 'yn': g[y][x] = c
        for i in range(8):
            s(i, i, 'l')
            if i + 1 < 12: s(i + 1, i, 'g')
        for x, y in [(9, 7), (8, 8), (7, 9)]: s(x, y, 'y')
        s(9, 9, 'n'); s(10, 10, 'n'); s(11, 11, 'y')
    sword(False); sword(True)
    return [''.join(r) for r in g]
add('i_swords', {'l': '#f4f7fb', 'g': '#9aa6b8', 'y': '#ffd23f', 'n': '#8a5a32'}, swords())

# flexed arm (tank)
add('i_arm', {'s': '#f2c29b', 'h': '#ffe0c4', 'S': '#c47f55'}, [
    '........hhh...',
    '.......hsssS..',
    '......Shsssss.',
    '.......hsssssS',
    '......ShssssS.',
    '.......SSSssS.',
    '.........sssS.',
    '...hhh...sssS.',
    '..hsssh..sssS.',
    '.hsssssh.sssS.',
    'hssssssssssssS',
    'hsssssssssssS.',
    '.SSSSSSSSSSS..'])

# bow + arrow (ranged)
add('i_bow', {'n': '#a8692e', 'N': '#6b3f17', 'l': '#e8eef5', 'a': '#d9a066', 'g': '#9aa6b8', 'r': '#ff4d6d'}, [
    '.....nn.....',
    '....l..n....',
    '...l....n...',
    '..l.....nN..',
    '.l.......n..',
    'rraaaaaaaagg',
    '.l.......n..',
    '..l.....nN..',
    '...l....n...',
    '....l..n....',
    '.....nn.....'])

# impact burst (Power Hit)
add('i_hit', {'o': '#ff8c1a', 'y': '#ffd23f', 'w': '#fff8d6'}, [
    '.....o.....',
    '.o...o...o.',
    '..o.ooo.o..',
    '...ooyoo...',
    '..ooyyyoo..',
    'oooyywyyooo',
    '..ooyyyoo..',
    '...ooyoo...',
    '..o.ooo.o..',
    '.o...o...o.',
    '.....o.....'])

# flame (Blast)
add('i_flame', {'r': '#e8452a', 'o': '#ff8c1a', 'y': '#ffd23f', 'w': '#fff8d6'}, [
    '....r......',
    '....rr.....',
    '...rrr..r..',
    '...rorr.rr.',
    '..rroorrrr.',
    '..rrooorrr.',
    '.rrooyyoorr',
    '.rroyyyyorr',
    '.rroywwyorr',
    '.rroywwyorr',
    '..rroyyorr.',
    '...rrrrrr..'])

# green cross (Heal)
add('i_cross', {'g': '#3ccf5a', 'h': '#9cf2a8', 'G': '#1d8a35'}, shade([
    '...gggg...',
    '...gggg...',
    '...gggg...',
    'gggggggggg',
    'gggggggggg',
    'gggggggggg',
    'gggggggggg',
    '...gggg...',
    '...gggg...',
    '...gggg...'], 'g', 'h', 'G'))

# shield (Shield)
add('i_shield', {'l': '#dfe6f0', 'L': '#8f9bb0', 'b': '#3a7bf0', 'B': '#2251a8', 'y': '#ffd23f'}, [
    'llllllllll',
    'lbbbbbbbBL',
    'lbbbyybbBL',
    'lbbyyyybBL',
    'lbbbyybbBL',
    'lbbbyybbBL',
    '.lbbbbbBL.',
    '.lbbbbbBL.',
    '..lbbbBL..',
    '...lbBL...',
    '....LL....'])

# lightning bolt (Stun)
add('i_bolt', {'y': '#ffd23f', 'h': '#fff3a8', 'Y': '#d99a00'}, shade([
    '.....yyyy',
    '....yyyy.',
    '...yyyy..',
    '..yyyy...',
    '.yyyyyyyy',
    '.....yyy.',
    '....yyy..',
    '...yyy...',
    '..yy.....',
    '.y.......'], 'y', 'h', 'Y'))

# check mark
add('i_check', {'g': '#3ccf5a', 'G': '#1d8a35'}, [
    '.........gG',
    '........gG.',
    '.......gG..',
    'gG....gG...',
    '.gG..gG....',
    '..gGgG.....',
    '...gG......'])

# gear
def gear():
    m = []
    for y in range(12):
        r = ''
        for x in range(12):
            dx, dy = x - 5.5, y - 5.5; d = math.hypot(dx, dy); a = math.degrees(math.atan2(dy, dx)) % 45
            tooth = a < 12 or a > 33
            r += 'g' if (d <= 4.2 or (d <= 6.0 and tooth)) and d >= 1.7 else '.'
        m.append(r)
    return shade(m, 'g', 'h', 'G')
add('i_gear', {'g': '#b8b2d6', 'h': '#ece9ff', 'G': '#6f6898'}, gear())

# close X
add('i_x', {'w': '#ffffff', 'l': '#c9c3ee'}, [
    'ww....wl',
    'www..wwl',
    '.wwwwwl.',
    '..wwwl..',
    '..wwwl..',
    '.wwwwwl.',
    'www..wwl',
    'ww....wl'])

# fast forward
add('i_ff', {'w': '#ffffff', 'l': '#c9c3ee'}, [
    'w...w...',
    'ww..ww..',
    'www.www.',
    'wwwwwwww',
    'wwwlwwwl',
    'wwl.wwl.',
    'wl..wl..'])

# arrows
ARR = ['....w...', '....ww..', 'wwwwwww.', 'wwwwwwww', 'wwwwwww.', '....ww..', '....w...']
add('i_right', {'w': '#ffffff'}, ARR)
add('i_left', {'w': '#ffffff'}, [r[::-1] for r in ARR])
add('i_up', {'w': '#ffffff'}, ['...ww...', '..wwww..', '.wwwwww.', 'wwwwwwww', '..wwww..', '..wwww..', '..wwww..'])

# pointing hand (drag)
add('i_hand', {'s': '#f2c29b', 'h': '#ffe0c4', 'S': '#c47f55'}, shade([
    '...ss......',
    '...ss......',
    '...ss......',
    '...sssss...',
    '...ssssss..',
    '.s.ssssss..',
    '.sssssssss.',
    '..ssssssss.',
    '..ssssssss.',
    '...ssssss..',
    '...ssssss..'], 's', 'h', 'S'))

# globe (worlds)
add('i_globe', {'b': '#3a7bf0', 'g': '#3ccf5a', 'w': '#cfe3ff'}, [
    '....bbbb....',
    '..bbggbbwb..',
    '.bgggggbbbb.',
    '.bggggbbgbb.',
    'bbbgggbbggbb',
    'bbbbggbbgggb',
    'bbbbbgbbbggb',
    'bbbbbbbbbgbb',
    '.bbbbggbbbb.',
    '.bbbbgggbbb.',
    '..bbbbggbb..',
    '....bbbb....'])

# floppy disk (save / backup)
add('i_save', {'d': '#3a4fb0', 'l': '#c9cfdc', 'L': '#5a6478', 'w': '#ffffff', 'g': '#9aa6b8'}, [
    'ddddddddddd.',
    'ddlllllLldd.',
    'ddlllllLlddd',
    'ddlllllLlddd',
    'dddddddddddd',
    'ddwwwwwwwwdd',
    'ddwggggggwdd',
    'ddwwwwwwwwdd',
    'ddwggggggwdd',
    'ddwwwwwwwwdd',
    'dddddddddddd'])

# laser beam (start ability)
add('i_laser', {'c': '#4ff0ff', 'w': '#ffffff', 'b': '#2a8fd8', 'g': '#9aa6b8', 'G': '#5a6478'}, [
    '...cwwc...',
    '...cwwc...',
    '...cwwc...',
    '...cwwc...',
    '..ccwwcc..',
    '..ccwwcc..',
    '.ggcwwcgg.',
    'gggbccbggG',
    'ggggggggGG',
    '.gggggggG.',
    '..GGGGGG..'])

# bomb (start ability)
add('i_bomb', {'d': '#3a3550', 'D': '#221d33', 'h': '#7d77a0', 'n': '#c9a46a', 'y': '#ffd23f', 'o': '#ff8c1a', 'w': '#ffffff'}, [
    '.......o.y.',
    '........yw.',
    '.......nyo.',
    '......n....',
    '...dddd....',
    '..dhhddd...',
    '.dhddddDd..',
    '.dhdddddD..',
    '.ddddddDD..',
    '.dddddDDD..',
    '..ddDDDD...',
    '...DDDD....'])

# shadow dash (start ability)
add('i_dash', {'p': '#b36bff', 'w': '#ffffff', 'l': '#d9c4ff'}, [
    'll.....pp...',
    '......pppp..',
    '.lll.pppwpp.',
    '.....ppwwwpp',
    'llll.pppwpp.',
    '......pppp..',
    '.ll....pp...'])

# winged boot (speed stat)
add('i_boot', {'r': '#ff4d6d', 'h': '#ff9aae', 'R': '#b3203f', 'w': '#ffffff', 'l': '#c9c3ee', 'y': '#ffd23f'}, [
    'ww....hrrr...',
    'lww...hrrr...',
    '.lww..hrrr...',
    '..lw..hrrr...',
    '......hrrr...',
    '......hrrrrr.',
    '......hrrrrrr',
    '......rrrrrrR',
    '......RRRRRRR',
    '......yyyyyyy'])


# ===== ability icons (v2) =====
add('i_taunt', {'r': '#ff4f6b', 'R': '#a3122a', 'w': '#ffffff'}, [
    '.rrrr.', 'rrwwrR', 'rrwwrR', 'rrwwrR', 'rrwwrR', 'rrwwrR', '.rRRR.', '......', '.rrrr.', 'rrwwrR', '.rRRR.'])
add('i_cannon', {'d': '#3a3550', 'D': '#221d33', 'h': '#7d77a0', 'n': '#8a5a32', 'N': '#5a3a1f', 'o': '#ff8c1a', 'y': '#ffd23f'}, [
    '..........oy', '...ddddddd.o', '..dhhhhhhdd.', '.ddddddddDD.', '.dddddddDD..', '..DDnnnD....', '...nNNNn....', '..nN...Nn...', '..nN...Nn...', '...nNNNn....'])
add('i_hook', {'l': '#dfe6f0', 'L': '#8f9bb0', 'n': '#c9a46a'}, [
    '....nn...', '....nn...', '....nn...', '....ll...', '....ll...', 'l...ll..l', 'll..ll.ll', '.lllllll.', '..LLLLL..'])
add('i_rock', {'g': '#9a8f86', 'h': '#c8bdb2', 'G': '#5e554e'}, shade([
    '...gggg...', '..gggggg..', '.gggggggg.', 'gggggggggg', 'gggggggggg', 'gggggggggg', '.gggggggg.', '..gggggg..'], 'g', 'h', 'G'))
add('i_stone', {'g': '#9a8f86', 'h': '#c8bdb2', 'G': '#5e554e', 'k': '#1b1325'}, [
    'hhhhghhhhg', 'hgggGhgggG', 'GGGGGGGGGG', 'hhghhhhghh', 'hgGhgggGhg', 'GGGGGGGGGG', 'hhhhghhhhg', 'hgggGhgggG', 'GGGGGGGGGG'])
add('i_quake', {'g': '#9a8f86', 'G': '#5e554e', 'y': '#ffd23f', 'w': '#ffffff'}, [
    'y..w...y..y', '.y.....y.y.', '..y..w.....', '...........', 'ggggg.ggggg', 'gggg..ggggg', 'GGGG.GGGGGG', 'GGG..GGGGGG', 'GGGG.GGGGGG'])
add('i_wrap', {'w': '#ece0c4', 'W': '#b8a88a', 'k': '#5a4a3a'}, [
    '..wwwwww..', '.wwWwwwWw.', 'wWwwwWwwwW', 'wwwWwwwWww', 'WwwwwWwwwW', 'wwWwwwwWww', '.wwwWwwww.', '..wwwwww..', '........w.', '.........w'])
add('i_skull', {'w': '#ece9ff', 'W': '#a8a2c8', 'k': '#3a2f5a'}, [
    '..wwwwww..', '.wwwwwwww.', 'wwwwwwwwwW', 'wkkwwwkkwW', 'wkkwwwkkwW', 'wwwwkwwwwW', '.wwwwwwwW.', '..wkwkwW..', '..wWwWwW..'])
add('i_whirl', {'s': '#e0c98a', 'S': '#a8904a', 'w': '#fff3d6'}, [
    '..ssssss..', '.s......S.', 's..wwww..S', 's.w....s.S', 's.w.ss.s.S', 's.w..s.s.S', 's..ww..s.S', '.s....s..S', '..SSSS..S.'])
add('i_teeth', {'w': '#ffffff', 'W': '#c9c3ee', 'r': '#c0392b', 'R': '#7a1f1f'}, [
    'rrrrrrrrrr', 'rwRwRwRwrR', 'r.w.w.w.wR', 'r........R', 'r.w.w.w.wR', 'rWwRwRwRwR', 'RRRRRRRRRR'])
add('i_missile', {'l': '#dfe6f0', 'L': '#8f9bb0', 'r': '#ff4d6d', 'o': '#ff8c1a', 'y': '#ffd23f'}, [
    '........rr', '.......lrr', '......llL.', '.....llL..', 'r...llL...', 'rr.llL....', '.rllL.....', '.oLL......', 'oyo.......', 'yo........'])
add('i_clock', {'w': '#fff3d6', 'W': '#d9c79a', 'b': '#3b5bdb', 'B': '#1f2f8a', 'k': '#1b1325'}, [
    '..bbbbbb..', '.bwwwwwwB.', 'bwwwkwwwwB', 'bwwwkwwwwB', 'bwwwkwwwwB', 'bwwwkkkwwB', 'bwwwwwwwwB', 'bWwwwwwwWB', '.bWWWWWWB.', '..BBBBBB..'])
add('i_mine', {'d': '#3a3550', 'D': '#221d33', 'h': '#7d77a0', 'r': '#ff4f6b', 'c': '#4ff0ff'}, [
    '....c....', '.c..d..c.', '..ddddd..', '.dhhddddD', 'cdhdrdddDc', '.ddddddDD', '..DDDDD..', '.c..D..c.', '....c....'])
add('i_drone', {'l': '#dfe6f0', 'L': '#8f9bb0', 'g': '#5fd068', 'w': '#ffffff', 'd': '#3a3550'}, [
    'LLL....LLL', '..d....d..', '..dllllld.', '.lllllllL.', '.lgwwglLL.', '.lgwwglLL.', '..LLLLLL..', '...g..g...'])
add('i_poison', {'g': '#7dff6b', 'h': '#d4ffcc', 'G': '#2f9a2a'}, shade([
    '....g....', '...ggg...', '...ggg...', '..ggggg..', '.ggggggg.', 'ggggggggg', 'ggggggggg', 'ggggggggg', '.ggggggg.', '..ggggg..'], 'g', 'h', 'G'))
add('i_drop', {'g': '#ff3b5c', 'h': '#ffb3c0', 'G': '#a3122a'}, shade([
    '....g....', '...ggg...', '...ggg...', '..ggggg..', '.ggggggg.', 'ggggggggg', 'ggggggggg', 'ggggggggg', '.ggggggg.', '..ggggg..'], 'g', 'h', 'G'))
# type icons
add('i_water', {'b': '#4fa3ff', 'h': '#bfe2ff', 'B': '#1f5fb8'}, shade([
    '....b....', '...bbb...', '...bbb...', '..bbbbb..', '.bbbbbbb.', 'bbbbbbbbb', 'bbbbbbbbb', 'bbbbbbbbb', '.bbbbbbb.', '..bbbbb..'], 'b', 'h', 'B'))
add('i_leaf', {'g': '#5fd068', 'h': '#b5f5ba', 'G': '#2f8a3a', 'n': '#8a5a32'}, [
    '......ggg.', '....ggggg.', '...gghgggG', '..ghhgggGG', '.ghggggGG.', '.gggggGG..', 'gnggGGG...', 'n.GGG.....', 'n.........'])
add('i_sun', {'y': '#ffd23f', 'h': '#fff3b0', 'o': '#ff9f1a'}, [
    '....y....', '.y..o..y.', '..yyyyy..', '..yhhyy..', 'yoyhyyyoy', '..yyyyo..', '..yyyoo..', '.y..o..y.', '....y....'])
add('i_moon', {'p': '#c07bff', 'h': '#e6ccff', 'P': '#7a3fc0'}, [
    '...ppp...', '..pph....', '.pph.....', '.pph.....', 'pphh.....', '.pph....P', '.ppph..PP', '..pppPPP.', '...PPP...'])
add('i_target', {'r': '#ff4f6b', 'w': '#ffffff'}, [
    '....r....', '..rrrrr..', '.r..r..r.', '.r.....r.', 'rrr.w.rrr', '.r.....r.', '.r..r..r.', '..rrrrr..', '....r....'])
add('i_food', {'w': '#fff3d6', 'W': '#d9c79a', 'n': '#c9a46a', 'N': '#8a5a32'}, [
    '....ww....', '...wwww...', '..wwwwww..', '.wwwnwwww.', 'wwwnwwwwwW', 'wwwwwwwwWW', 'WWWWWWWWWW', '.NNNNNNNN.'])
add('i_shuriken', {'l': '#dfe6f0', 'L': '#8f9bb0', 'k': '#3a3550'}, [
    '....l....', '....ll...', '....lL...', 'lll.k.LLL', '.LLkkkLL.', 'LLL.k.lll', '...Ll....', '...ll....', '....l....'])
add('i_smoke', {'g': '#b8b2d6', 'h': '#ece9ff', 'G': '#6f6898'}, shade([
    '...ggg....', '..ggggg.g.', '.gggggggggg', '.gggggggggg', 'gggggggggg.', 'ggggggggggg', '.ggggggggg.', '..ggg.ggg..'], 'g', 'h', 'G'))
add('i_snow', {'w': '#ffffff', 'c': '#8fe3ff'}, [
    '....w....', '.w..w..w.', '..w.c.w..', '...wcw...', 'wcccwcccw', '...wcw...', '..w.c.w..', '.w..w..w.', '....w....'])
add('i_snowball', {'w': '#ffffff', 'c': '#bfe8ff', 'C': '#7cc8f2'}, shade([
    '..wwwww..', '.wwwwwww.', 'wwwwwwwww', 'wwwwwwwww', 'wwwwwwwww', 'wwwwwwwww', '.wwwwwww.', '..wwwww..'], 'w', 'w', 'C'))
add('i_frog', {'g': '#5fd068', 'h': '#a8f2b0', 'G': '#2f8a3a', 'w': '#ffffff', 'k': '#1b1325', 'r': '#ff6b6b'}, [
    '.ww....ww.', 'wkkw..wkkw', 'wwwwggwwww', 'ggggggggggg', 'ghhgggggggG', 'gggrrrrrggG', 'ggggggggggG', '.gGGGGGGGG.', 'gg..gg..gg.'])
add('i_cauldron', {'d': '#3a3550', 'D': '#221d33', 'h': '#7d77a0', 'g': '#7dff6b', 'G': '#2f9a2a'}, [
    '..g..g....', '...g...g..', 'ggGgGgGggg', 'dddddddddd', '.dhddddddD', '.dhdddddDD', '.ddddddDDD', '..DDDDDDD.', '..D....D..'])
add('i_meteor', {'o': '#ff8c1a', 'y': '#ffd23f', 'g': '#9a8f86', 'G': '#5e554e', 'h': '#c8bdb2'}, [
    'y.........', '.oy.......', '..oy.y....', 'o..oyy....', '.o..oggg..', '..o.ghggg.', '...ghgggG.', '...gggggG.', '....gggG..', '.....GG...'])
add('i_float', {'p': '#c07bff', 'w': '#ffffff'}, [
    '...ww...', '..wppw..', '.wppppw.', 'wppppppw', '...pp...', '...pp...', '...pp...', '..wwww..', '.w....w.'])
add('i_hole', {'p': '#7b3fd1', 'P': '#3f1f78', 'k': '#140c22', 'w': '#e6d0ff'}, [
    '...wpppw..', '..pPPPPpw.', '.pPkkkkPp.', 'wPkkkkkkPp', 'pPkkkkkkPw', 'pPkkkkkkPp', '.pPkkkkPp.', '..wPPPPp..', '...pppw...'])
add('i_buff', {'r': '#ff4f6b', 'R': '#a3122a', 'w': '#ffb3c0'}, [
    '....r....', '...rwr...', '..rwrrr..', '.rwrrrrR.', 'rrrrrrrRR', '...rrR...', '...rrR...', '...rrR...', '...RRR...'])
add('i_bat', {'d': '#5a3a7a', 'D': '#2f1f45', 'r': '#ff4f6b'}, [
    'd..........d', 'dd...dd...dd', 'ddd.dddd.ddd', 'dddddrdrdddd', '.dddddddddd.', '..dDdddddD..', '..D..dd..D..', '......D.....'])
add('i_charm', {'p': '#ff6fb5', 'h': '#ffb3d9', 'P': '#c2347c', 'y': '#ffd23f', 'n': '#c9a46a'}, [
    '...........y', '.pp..pp...y.', 'phpppppp.n..', 'phpppppPn...', 'pppppppn....', '.ppppPn.....', '..ppnP......', '...nP.......', '..n.........', '.y..........'])
add('i_shrink', {'p': '#c07bff', 'P': '#7b3fd1', 'w': '#ffffff'}, [
    'pp......pp', 'ppp....ppp', '.ppp..ppp.', '..pp..pp..', '....ww....', '....ww....', '..pp..pp..', '.ppp..ppp.', 'ppp....ppp', 'pp......pp'])
add('i_clone', {'g': '#7ee05a', 'G': '#3f8a2a', 'l': '#c9f5b8'}, [
    '.ggg.lll..', 'gggglllll.', 'gGgglGlll.', 'gggglllll.', '.gg..ll...', 'ggggllllll', 'ggggllllll', 'gg.gll..ll', 'gg.gll..ll'])
add('i_ufo', {'l': '#dfe6f0', 'L': '#8f9bb0', 'c': '#4ff0ff', 'g': '#7dff6b', 'y': '#fff3a8'}, [
    '....cccc....', '...cccccc...', '.llllllllll.', 'llgllgllglll', '.LLLLLLLLLL.', '...y....y...', '..yyy..yyy..', '.yyyyyyyyyy.'])
add('i_ring', {'o': '#ff8c1a', 'y': '#ffd23f', 'r': '#e8452a'}, [
    '..yooooy..', '.yo....oy.', 'yo......oy', 'or......ro', 'or......ro', 'or......ro', 'yo......oy', '.yo....oy.', '..yooooy..'])
add('i_firewall', {'r': '#e8452a', 'o': '#ff8c1a', 'y': '#ffd23f'}, [
    '.r...r...r.', '.rr..rr..rr', 'rorrrorrror', 'royrroyrroy', 'ryyrryyrryy', 'ryyrryyrryy', 'rrrrrrrrrrr'])
# currencies: key + hero trophy
add('i_key', {'y': '#ffd23f', 'h': '#fff3a8', 'Y': '#b37a00', 'k': '#1b1325'}, [
    '..yyy.......', '.yhhhy......', 'yhy.yyyyyyyy', 'yh...yYYYYYY', 'yhy.yy...Y.Y', '.yyyy....Y.Y', '..YY........'])
add('i_htrophy', {'b': '#7fb2ff', 'h': '#d6e6ff', 'B': '#3b5bdb', 'n': '#8a5a32'}, [
    'bbbbbbbbbb', 'bhbbbbbbbB', '.bhbbbbbB.', '.bhbbbbbB.', '..bbbbBB..', '...bbBB...', '....bB....', '...bbBB...', '..nnnnnn..', '..nnnnnn..'])

# ===== world icons (shown on hero cards instead of the colour bar) =====
add('w_kingdom', {'g': '#c9cfdc', 'G': '#7d869a', 'b': '#3a6fd8', 'k': '#3a2f5a', 'y': '#ffd23f'}, [
    '....y.....', '....bb....', '....b.....', 'g.g.g.g.g.', 'gggggggggG', 'gggggggggG', 'ggggkkgggG', 'ggggkkgggG', 'GGGGkkGGGG'])
add('w_machines', {'o': '#ff8c1a', 'O': '#b35a00', 'h': '#ffc27a', 'k': '#3a2f5a'}, [
    '...oo.oo..', '..oooooo..', 'oooo..ooO.', 'ooo....oO.', '.oo....oO.', 'ooo....oOO', 'oooo..ooO.', '..ooooOO..', '...oO.OO..'])
add('w_spooky', {'w': '#ece9ff', 'W': '#a8a2c8', 'k': '#3a2f5a'}, [
    '..wwwww..', '.wwwwwww.', 'wwkwwwkwW', 'wwkwwwkwW', 'wwwwwwwwW', 'wwwkkkwwW', 'wwwwwwwwW', 'wwwwwwwWW', 'w.ww.ww.W'])
add('w_wild', {'g': '#5fd068', 'G': '#2f8a3a', 'n': '#8a5a32'}, [
    '.g..g..g.', '.g..g..g.', '.........', '..ggggg..', '.ggggggg.', '.gggggggG', '..gggggG.', '...GGG...'])
add('w_rogues', {'k': '#2a2438', 'r': '#c0392b', 'w': '#ffffff'}, [
    '..........', 'kkkkkkkkkk', 'kkwkkkkwkk', 'kwwkkkkwwk', 'kkkkrrkkkk', '.kkk..kkk.', '..........'])
add('w_cosmic', {'p': '#7b3fd1', 'h': '#c07bff', 'P': '#3f1f78', 'y': '#ffd23f'}, [
    '.........y', '...pppp...', '..phhpppP.', 'yyphppppPy', 'yyyyyyyyyy', '.yPpppPPy.', '..pPPPPP..', '...PPPP...'])

# ===== targeting styles =====
add('i_tnear', {'r': '#ff4f6b', 'R': '#a3122a', 'w': '#ffffff'}, [
    '....rr....', '..rrRRrr..', '.rR....Rr.', '.r..ww..r.', 'rR.wrrw.Rr', 'rR.wrrw.Rr', '.r..ww..r.', '.rR....Rr.', '..rrRRrr..', '....rr....'])
add('i_tback', {'y': '#ffd23f', 'Y': '#d99a00', 'g': '#9a8f86', 'G': '#5e554e', 'r': '#ff4f6b', 'R': '#a3122a'}, [
    '...yyyyy....', '..y.....y...', '.y.......y..', '.y......yyy.', 'y........y..', 'y...gg......', 'y..gggg..rr.', 'y..gGGg.rrrR', '...gGGg.rrrR', '...GGGG..RR.'])
add('i_tweak', {'e': '#5a5470', 'E': '#3a3550', 'r': '#ef3b4f', 'R': '#a3122a', 'w': '#ffffff'}, [
    '.eee...eee.', 'eeeee.eeeEE', 'eeeeewEeeeE', 'eeeeeEweeeE', 'eeeewEeeeeE', '.eeeeweeeE.', '..rrrrrrR..', '...rrrrR...', '....rrR....', '.....R.....'])
add('i_tbig', {'r': '#ef3b4f', 'h': '#ff8a96', 'R': '#a3122a', 'w': '#ffffff', 'y': '#ffd23f'}, [
    '.hhh...hhh.', 'hhrrr.hrrrR', 'hrrrrwrrrrR', 'rrrrwwwrrrR', 'rrrwwwwwrrR', '.rrrrwrrrR.', '..rrrwrrR..', '...rrrrR...', '....rrR....', '.....R.....'])
add('i_medal', {'b': '#4fa3ff', 'B': '#3b5bdb', 'r': '#ff4f6b', 'R': '#a3122a', 'y': '#ffd23f', 'Y': '#d99a00', 'h': '#fff3a8'}, [
    'bB......rR', '.bB....rR.', '..bB..rR..', '...bBrR...', '...yyyy...', '..yhhyyY..', '.yhyyyyYY.', '.yhyyyyYY.', '.yyyyyYYY.', '..yYYYYY..', '...YYYY...'])
add('i_note', {'p': '#c07bff', 'P': '#7b3fd1'}, [
    '....pppppp', '....pPPPPp', '....p....p', '....p....p', '....p....p', '.ppp...ppp', 'pppP..pppP', 'pppP..pppP', '.PP....PP.'])

add('i_wild', {'p': '#c07bff', 'P': '#7b3fd1', 'h': '#f0d8ff', 'w': '#ffffff', 'c': '#4ff0ff', 'y': '#ffd23f'}, [
    'Pp.pppppp.pP', 'Pp.phhwpp.pP', '.PppphpppPP.', '..ppcyycpp..', '...pyccypP..', '....PppPP...', '.....PP.....', '....pppP....', '...pppppP...', '...PPPPPP...'])
# ===== Rift Orbs (hero cost) =====
add('i_orb', {'b': '#3aa0ff', 'h': '#9fe8ff', 'w': '#ffffff', 'B': '#1f5fd0'}, ['...bbbbbb...', '..bbbbbbbb..', '.bhhhhbbbbB.', 'bbhwwhhbbbBB', 'bbhwwhbbbbbB', 'bbhhhbbbbbBB', 'bbbhbbbbbBBB', 'bbbbbbbbBBBB', 'bbbbbbbBBBBB', '.bbbbbBBBBB.', '..BBbBBBBB..', '...BBBBBB...'])
add('i_orb0', {'s': '#221c38', 'r': '#4a4272'}, ['...rrrrrr...', '..rrrssrrr..', '.rrssssssrr.', 'rrssssssssrr', 'rrssssssssrr', 'rssssssssssr', 'rssssssssssr', 'rrssssssssrr', 'rrssssssssrr', '.rrssssssrr.', '..rrrssrrr..', '...rrrrrr...'])
if __name__ == '__main__':
    path = 'src/sprites.json'
    d = json.load(open(path))
    common = d['_common']
    for k in list(d):
        if k.startswith('i_'): del d[k]
    d.update(ICONS)
    json.dump(d, open(path, 'w'), separators=(',', ':'))
    # preview sheet
    names = list(ICONS)
    S = 6; cols = 8; rows = math.ceil(len(names) / cols)
    sheet = Image.new('RGB', (cols * (W * S + 12) + 12, rows * (W * S + 12) + 12), '#2a2350')
    for i, n in enumerate(names):
        ic = ICONS[n]; pal = dict(common, **ic['pal'])
        im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
        for y, r in enumerate(ic['rows']):
            for x, c in enumerate(r):
                if c != '.': im.putpixel((x, y), tuple(int(pal[c][j:j + 2], 16) for j in (1, 3, 5)) + (255,))
        im = im.resize((W * S, W * S), Image.NEAREST)
        sheet.paste(im, (12 + (i % cols) * (W * S + 12), 12 + (i // cols) * (W * S + 12)), im)
    sheet.save(sys.argv[1] if len(sys.argv) > 1 else 'tmp/icons_sheet.png')
    print(len(names), 'icons')
