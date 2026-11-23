import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = 'tmp/shots'; os.makedirs(OUT, exist_ok=True)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '-d', 'dist/pwa'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('http://localhost:8765/index.html'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/01_welcome.png')
        await pg.click('[data-close]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/02_home.png')
        # open starter chest
        await pg.click('.cslot.ready'); await pg.wait_for_timeout(300)
        await pg.click('.modal'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=f'{OUT}/03_chest.png')
        await pg.click('.modal [data-close]'); await pg.wait_for_timeout(200)
        for t in ['heroes', 'season', 'road', 'shop']:
            await pg.click(f'#tabs [data-tab={t}]'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{OUT}/04_{t}.png')
        await pg.click('#tabs [data-tab=heroes]'); await pg.wait_for_timeout(200)
        await pg.click('.hcard >> nth=0'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/05_hero.png')
        await pg.click('.modal .x'); await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(200)
        await pg.click('text=BATTLE'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/06_vs.png')
        await pg.click('#fight'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'{OUT}/07_battle.png')
        # play: tap our hero, move forward, then let AI-driven helper play our side for some turns
        box = await pg.locator('#bc').bounding_box()
        tw, th = box['width'] / 5, box['height'] / 7
        async def tap(x, y): await pg.mouse.click(box['x'] + (x + .5) * tw, box['y'] + (y + .5) * th)
        await tap(2, 6); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/08_selected.png')
        await tap(2, 4); await pg.wait_for_timeout(900)
        await pg.screenshot(path=f'{OUT}/09_moved.png')
        # play remaining turns using the expert AI for our side via page JS
        for turn in range(30):
            done = await pg.evaluate('''async () => {
              if (!B) return 'closed'; if (B.st.winner != null) return 'over';
              while (B && (B.busy || !B.turnMine)) await new Promise(r => setTimeout(r, 100));
              if (!B || B.st.winner != null) return 'over';
              const seq = aiPlanTurn(B.st, 0, 'hard', 5 + B.st.round);
              for (const q of seq) { if (B.st.winner != null) break; const ev = []; applyPlan(B.st, q.uid, q.plan, ev); await act(ev); }
              if (B && B.st.winner == null) { B.endArm = Date.now() + 9999; await endBtn(); }
              return 'ok';
            }''')
            if turn == 2: await pg.screenshot(path=f'{OUT}/10_midbattle.png')
            if done != 'ok': break
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f'{OUT}/11_result.png')
        if await pg.locator('#cont').count(): await pg.click('#cont'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/12_home_after.png')
        st = await pg.evaluate('JSON.stringify({tro:S.trophies, battles:S.stats.battles, wins:S.stats.wins, chests:S.chests.map(c=>c&&c.type)})')
        print('state', st)
        await b.close()
    srv.terminate()
    print('ERRORS:', errs if errs else 'none')
asyncio.run(main())
