# Walks through the whole tutorial on a fresh save (artifact build), taking screenshots
import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = 'tmp/tut'; os.makedirs(OUT, exist_ok=True)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8771', '-d', 'dist/artifact'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        if os.environ.get('GRID'): await ctx.add_init_script("localStorage.setItem('riftsquad.gridmove','1')")
        pg = await ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('http://localhost:8771/index.html'); await pg.wait_for_timeout(800)
        shot = lambda n: pg.screenshot(path=f'{OUT}/{n}.png')
        await shot('00_intro')
        await pg.click('#tut-go'); await pg.wait_for_timeout(1500); await shot('00b_intro'); await pg.wait_for_selector('.coach .cnext', timeout=8000); await pg.wait_for_timeout(400)
        await shot('01_board')
        await pg.click('.coach .cnext'); await pg.wait_for_timeout(500)
        await shot('02_tap_gus')
        box = await pg.locator('#bc').bounding_box(); tw = box['width'] / 5; th = box['height'] / ((await pg.evaluate('BH')) + 5 / 18); oy = box['y'] + th * 5 / 18
        g = await pg.evaluate("(() => { const u = M.rs.units.find(q => q.side === 0 && q.hid === 'gus'); return [u.x, u.y]; })()")
        await pg.mouse.click(box['x'] + (g[0] + .5) * tw, oy + (g[1] + .5) * th); await pg.wait_for_timeout(500)
        await shot('03_gus_info')
        await pg.click('.coach .cnext'); await pg.wait_for_timeout(400)
        await shot('04_bruno')
        await pg.click('.coach .cnext'); await pg.wait_for_timeout(400)
        await shot('05_zip')
        await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(1500)
        await shot('06_fight')
        # tap one of my heroes mid-fight to see its target line
        u = await pg.evaluate("(() => { const u = M.rs.units.find(q => q.side === 0 && q.alive && q.hid === 'gus') || M.rs.units.find(q => q.side === 0 && q.alive); return [u.x, u.y]; })()")
        await pg.mouse.click(box['x'] + (u[0] + .5) * tw, oy + (u[1] + .5) * th); await pg.wait_for_timeout(1800)
        await shot('07_fight_sel')
        seen_taunt = False
        for i in range(60):
            txt = await pg.evaluate("(document.querySelector('#coach .ctext')||{}).textContent || ''")
            if 'Taunt!' in txt and not seen_taunt: seen_taunt = True; await shot('08_taunt')
            if 'bench' in txt: break
            ph = await pg.evaluate("M ? M.phase : 'none'")
            if ph == 'between': await shot('09_round_won') if i % 50 == 0 or not os.path.exists(f'{OUT}/09_round_won.png') else None
            await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(300)
        await shot('10_bench')
        await pg.click('.bcard.fit >> nth=0'); await pg.wait_for_timeout(900)
        await shot('11_ghosts')
        await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(500)
        slow_seen = False
        for i in range(160):
            if await pg.locator('#cont').count(): break
            if await pg.locator('.offer').count(): await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(300); continue
            st = await pg.evaluate("M ? [M.phase, M.slowUntil > performance.now(), !!document.querySelector('.bigban')] : ['none', false, false]")
            if st[1] and not slow_seen: slow_seen = True; await pg.wait_for_timeout(150); await shot('12_slowmo')
            if st[2] and not os.path.exists(f'{OUT}/13_victory.png'): await pg.wait_for_timeout(700); await shot('13_victory')
            if st[0] == 'setup': await pg.click('#b-btns .btn.gold')
            await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(1200)
        await shot('14_result')
        await pg.click('#cont'); await pg.wait_for_timeout(900)
        await shot('15_home_chest')
        await pg.click('.shelfc.can >> nth=0'); await pg.wait_for_timeout(300)
        await pg.click('.co-stage'); await pg.wait_for_timeout(1500)
        await pg.click('#co-skip'); await pg.wait_for_timeout(500)
        await pg.click('#co-ok'); await pg.wait_for_timeout(700)
        await shot('16_final')
        await pg.click('.coach .cnext'); await pg.wait_for_timeout(500)
        print(await pg.evaluate("JSON.stringify({tut:S.tutorialDone, battles:S.stats.battles, shelf:S.shelf.length, keys:S.keys, coach:!!document.querySelector('#coach'), ach:S.ach})"))
        await pg.click('#prof'); await pg.wait_for_timeout(600)
        await shot('17_profile')
        print('slowmo seen', slow_seen)
        await b.close()
    srv.terminate(); print('ERRORS:', errs if errs else 'none')
asyncio.run(main())
