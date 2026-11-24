import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = 'tmp/shots3'; os.makedirs(OUT, exist_ok=True)
BUILD = sys.argv[1] if len(sys.argv) > 1 else 'test'
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8770', '-d', f'dist/{BUILD}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        if os.environ.get('GRID'): await ctx.add_init_script("localStorage.setItem('riftsquad.gridmove','1')")
        pg = await ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('http://localhost:8770/index.html'); await pg.wait_for_timeout(700)
        if await pg.locator('#tut-skip').count(): await pg.click('#tut-skip'); await pg.wait_for_timeout(300)
        await pg.click('[data-close]'); await pg.wait_for_timeout(300)
        await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/01_home.png')
        await pg.evaluate("setDiff('hard')")
        await pg.click('text=BATTLE'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/02_vs.png')
        await pg.click('#fight'); await pg.wait_for_timeout(500); await pg.click('.mintro'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/03_offer.png')
        for i in range(30):
            if await pg.evaluate("M && M.phase === 'setup'"): break
            await pg.wait_for_timeout(200)
        print('round 1 slots:', await pg.evaluate("[slotsUsed(M.sides[0].board), M.caps[0], M.sides[0].board.map(h => h.hid + ':' + heroCost(h.hid)).join(' '), 'foe', M.sides[1].board.map(h => h.hid + ':' + heroCost(h.hid)).join(' '), M.style]"))
        await pg.screenshot(path=f'{OUT}/04_setup.png')
        # drag a hero: find one of my units and drag to another tile
        box = await pg.locator('#bc').bounding_box(); tw = box['width'] / 5; th = tw; box['y'] += th * (await pg.evaluate('PADT / TILE')); top0 = box['y']
        u = await pg.evaluate("(() => { const u = M.rs.units.find(q => q.side === 0); return [u.x, u.y]; })()")
        await pg.mouse.move(box['x'] + (u[0] + .5) * tw, box['y'] + (u[1] + .5) * th); await pg.mouse.down()
        await pg.mouse.move(box['x'] + (u[0] + .5) * tw, box['y'] + 3.5 * th, steps=6); await pg.wait_for_timeout(100)
        await pg.screenshot(path=f'{OUT}/05_drag.png')
        await pg.mouse.up(); await pg.wait_for_timeout(200)
        moved = await pg.evaluate("(() => M.lineups[0].units.map(u => u.hid + '@' + u.x + ',' + u.y).join(' '))()")
        print('after drag:', moved)
        # tap a hero to inspect
        await pg.mouse.click(box['x'] + 2.5 * tw, box['y'] + 1.5 * th); await pg.wait_for_timeout(200)
        print('round 1 start (captain only):', await pg.evaluate("M.lineups[0].units.map(u => u.hid).join(' ')"), '| enemy ghosts:', await pg.evaluate("ghostLine() ? ghostLine().units.map(u => u.hid).join(' ') : 'none'"))
        for k in range(5):
            if not await pg.locator('.bcard.fit').count(): break
            await pg.click('.bcard.fit >> nth=0'); await pg.wait_for_timeout(450)
        before = await pg.evaluate("M.lineups[0].units.length")
        q = await pg.evaluate("(() => { const u = M.lineups[0].units.find(q => q.hid !== M.sides[0].captain); return u ? [u.x, u.y, u.hid] : null; })()")
        if q:
            await pg.mouse.click(box['x'] + (q[0] + .5) * tw, top0 + (q[1] + .5) * th); await pg.wait_for_timeout(120)
            await pg.mouse.click(box['x'] + (q[0] + .5) * tw, top0 + (q[1] + .5) * th); await pg.wait_for_timeout(500)
            print('double-tap', q[2], '-> on board', before, '->', await pg.evaluate("M.lineups[0].units.length"), '| on bench:', await pg.evaluate(f"M.sides[0].bench.some(h => h.hid === '{q[2]}')"))
        await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(300)
        if await pg.locator('#cf-yes').count(): print('unspent-orbs check shown'); await pg.click('#cf-yes')
        await pg.wait_for_timeout(2200)
        await pg.screenshot(path=f'{OUT}/06_fight.png')
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f'{OUT}/07_fight2.png')
        # play out the match: handle offers, fights (skip), until result
        t0 = time.time()
        for i in range(80):
            if await pg.locator('#cont').count(): break
            if await pg.locator('.offer').count(): await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(200); continue
            ph = await pg.evaluate("M ? M.phase : 'none'")
            if ph == 'setup':
                if await pg.locator('.bcard.fit').count(): await pg.click('.bcard.fit >> nth=0'); await pg.wait_for_timeout(250); print('added from bench, slots', await pg.evaluate("[slotsUsed(M.sides[0].board), M.caps[0], M.lineups[0].units.length]"))
                if i == 6: await pg.screenshot(path=f'{OUT}/08_round_setup.png')
                await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(300)
                if await pg.locator('#cf-yes').count(): await pg.click('#cf-yes'); await pg.wait_for_timeout(200)
            elif ph == 'fight':
                await pg.click('text=Skip'); await pg.wait_for_timeout(300)
            else: await pg.wait_for_timeout(400)
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/09_result.png')
        if await pg.locator('#cont').count(): await pg.click('#cont'); await pg.wait_for_timeout(400)
        print(await pg.evaluate("JSON.stringify({tro:S.trophies, battles:S.stats.battles, wins:S.stats.wins, rounds:S.stats.rounds, shelf:S.shelf.map(c=>c.type), keys:S.keys})"))
        # heroes modal with captain power
        await pg.click('#tabs [data-tab=heroes]'); await pg.wait_for_timeout(200)
        await pg.click('.hcard >> nth=0'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/10_hero.png')
        await b.close()
    srv.terminate(); print('ERRORS:', errs if errs else 'none')
asyncio.run(main())
