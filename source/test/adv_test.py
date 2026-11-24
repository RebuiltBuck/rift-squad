import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = 'tmp/shots_adv'; os.makedirs(OUT, exist_ok=True)
BUILD = sys.argv[1] if len(sys.argv) > 1 else 'test'
PORT = 8774

async def play_out(pg, tag, shoot_at=()):
    """Play a match to the result screen: add bench heroes, fight, skip."""
    for i in range(120):
        if await pg.locator('#cont').count(): return True
        if await pg.locator('.mintro').count(): await pg.click('.mintro'); await pg.wait_for_timeout(300); continue
        if await pg.locator('.offer').count(): await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(200); continue
        ph = await pg.evaluate("M ? M.phase : 'none'")
        if ph == 'setup':
            for k in range(4):
                if not await pg.locator('.bcard.fit').count(): break
                await pg.click('.bcard.fit >> nth=0'); await pg.wait_for_timeout(200)
            if i in shoot_at: await pg.screenshot(path=f'{OUT}/{tag}_setup{i}.png')
            await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(300)
            if await pg.locator('#cf-yes').count(): await pg.click('#cf-yes'); await pg.wait_for_timeout(200)
        elif ph == 'fight':
            if 'fight' in shoot_at: await pg.wait_for_timeout(2600); await pg.screenshot(path=f'{OUT}/{tag}_fight.png'); shoot_at = tuple(x for x in shoot_at if x != 'fight')
            await pg.click('text=Skip'); await pg.wait_for_timeout(300)
        else: await pg.wait_for_timeout(400)
    return False

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', f'dist/{BUILD}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto(f'http://localhost:{PORT}/index.html'); await pg.wait_for_timeout(700)
        if await pg.locator('#tut-skip').count(): await pg.click('#tut-skip'); await pg.wait_for_timeout(300)
        if await pg.locator('[data-close]').count(): await pg.click('[data-close]'); await pg.wait_for_timeout(300)
        await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/01_home.png')
        await pg.click('.advbtn'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/02_map.png')
        await pg.click('[data-lv="0"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/03_level1.png')
        await pg.click('.lvpop .lx'); await pg.wait_for_timeout(200)
        await pg.click('[data-lv="3"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/04_locked.png')
        await pg.click('.lvdim', position={'x': 10, 'y': 10}); await pg.wait_for_timeout(200)
        await pg.click('[data-lv="0"]'); await pg.wait_for_timeout(300)
        g0 = await pg.evaluate("S.gems"); c0 = await pg.evaluate("S.coins")
        await pg.click('.lvpop .lp'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=f'{OUT}/05_intro.png')
        print('match setup:', await pg.evaluate("JSON.stringify({adv: M.setup.adv, foe: M.setup.foeName, diff: M.setup.diff, hp: M.setup.foeHp})"))
        ok = await play_out(pg, 'l1', (0,))
        await pg.wait_for_timeout(1400)
        await pg.screenshot(path=f'{OUT}/06_result.png')
        print('level 1 done:', ok, await pg.evaluate("JSON.stringify({st:S.adv.st, score:M && M.score})"), 'gems', g0, '->', await pg.evaluate("S.gems"), 'coins', c0, '->', await pg.evaluate("S.coins"))
        await pg.click('#cont'); await pg.wait_for_timeout(900)
        await pg.screenshot(path=f'{OUT}/07_map_after.png')
        print('after continue: adv open', await pg.locator('#advl').count(), 'popup', await pg.locator('.lvpop').count(), 'battle hidden', await pg.evaluate("$('#battle').classList.contains('hidden')"))
        # puzzle level 3: unlock by faking stars, check fixed enemies are shown
        await pg.evaluate("S.adv.st['1-1']=3; S.adv.st['1-2']=2; persist(); openAdventure(1, 2)"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/08_puzzle_box.png')
        await pg.click('.lvpop .lp'); await pg.wait_for_timeout(600)
        if await pg.locator('.mintro').count(): await pg.click('.mintro'); await pg.wait_for_timeout(500)
        for i in range(20):
            if await pg.evaluate("M && M.phase === 'setup'"): break
            await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/09_puzzle_setup.png')
        print('puzzle ghosts:', await pg.evaluate("ghostLine() ? ghostLine().units.map(u => u.hid + '@' + u.x + ',' + u.y).join(' ') : 'none'"))
        await pg.evaluate("closeBattle && (M = null, S.activeBattle = false, lsDel(STORE_BATTLE), closeBattle())"); await pg.wait_for_timeout(300)
        # boss: unlock everything up to it
        await pg.evaluate("for (let i = 0; i < 10; i++) S.adv.st['1-' + (i + 1)] = 3; persist(); openAdventure(1, 10)"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/10_boss_box.png')
        await pg.evaluate("$('.lvpop').remove(); $('.lvdim').remove(); $('.adv-map').scrollTop = 0"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/11_map_top.png')
        await pg.evaluate("openAdventure(1, 10)"); await pg.wait_for_timeout(400)
        await pg.click('.lvpop .lp'); await pg.wait_for_timeout(600)
        print('boss setup:', await pg.evaluate("JSON.stringify({boss: M.setup.boss, fixed: M.setup.fixedFoe, bossHp: M.bossHp})"))
        ok = await play_out(pg, 'boss', (0, 'fight'))
        await pg.wait_for_timeout(1400)
        await pg.screenshot(path=f'{OUT}/12_boss_result.png')
        print('boss done:', ok, await pg.evaluate("JSON.stringify({st:S.adv.st['1-11'], score:M && M.score, bossHp:M && M.bossHp, shelf:S.shelf.map(c=>c.type)})"))
        await pg.click('#cont'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'{OUT}/13_after_boss.png')
        await b.close()
    srv.terminate(); print('ERRORS:', errs if errs else 'none')
asyncio.run(main())
