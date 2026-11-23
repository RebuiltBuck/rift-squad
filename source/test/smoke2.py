import asyncio, sys, subprocess, time, os, json
from playwright.async_api import async_playwright
OUT = 'tmp/shots'
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '-d', 'dist/pwa'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 375, 'height': 667}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('http://localhost:8766/index.html'); await pg.wait_for_timeout(600)
        await pg.click('[data-close]')
        # give a mid-game save: arena ~6, many heroes, then play an Expert battle with Ember/Chrono/Rex
        await pg.evaluate('''() => { S.trophies = 3400; S.best = 3400; for (const h of HEROES) S.heroes[h.id] = { lvl: 6, shards: 40 };
          S.squad = ['ember','chrono','rex']; S.coins = 5000; S.gems = 500; S.lastDiff = 'expert'; tick(S, Date.now()); persist(); render(); }''')
        await pg.screenshot(path=f'{OUT}/20_mid_home.png')
        await pg.click('#tabs [data-tab=road]'); await pg.wait_for_timeout(400); await pg.screenshot(path=f'{OUT}/21_road.png')
        await pg.click('#tabs [data-tab=shop]'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/22_shop.png')
        await pg.click('#tabs [data-tab=battle]'); await pg.click('text=BATTLE'); await pg.click('#fight'); await pg.wait_for_timeout(1200)
        box = await pg.locator('#bc').bounding_box(); tw, th = box['width'] / 5, box['height'] / 7
        async def tap(x, y): await pg.mouse.click(box['x'] + (x + .5) * tw, box['y'] + (y + .5) * th)
        # test ability targeting UI: select Ember (col 0), open ability mode
        await tap(4, 6); await pg.click('#b-ab'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/23_ability_mode.png')
        # simulate a reload mid-battle -> resume
        await pg.reload(); await pg.wait_for_timeout(800); await pg.screenshot(path=f'{OUT}/24_resume_prompt.png')
        await pg.click('#rs'); await pg.wait_for_timeout(1200)
        t0 = time.time()
        for turn in range(30):
            r = await pg.evaluate('''async () => { if (!B) return 'closed'; if (B.st.winner != null) return 'over';
              while (B && (B.busy || !B.turnMine)) await new Promise(r => setTimeout(r, 100));
              if (!B || B.st.winner != null) return 'over';
              const seq = aiPlanTurn(B.st, 0, 'expert', 9 + B.st.round);
              for (const q of seq) { if (B.st.winner != null) break; const ev = []; applyPlan(B.st, q.uid, q.plan, ev); await act(ev); }
              if (B && B.st.winner == null) { B.endArm = Date.now() + 9999; await endBtn(); } return 'ok'; }''')
            if turn == 3: await pg.screenshot(path=f'{OUT}/25_expert_mid.png')
            if r != 'ok': break
        await pg.wait_for_timeout(2500); await pg.screenshot(path=f'{OUT}/26_expert_result.png')
        print('expert battle took', round(time.time() - t0, 1), 's')
        if await pg.locator('#cont').count(): await pg.click('#cont')
        # backup export/import roundtrip
        code = await pg.evaluate('exportSave(S)')
        ok = await pg.evaluate('(c) => { const s2 = importSave(c); return s2.trophies === S.trophies && Object.keys(s2.heroes).length === 20; }', code)
        print('backup roundtrip', ok, len(code), 'chars')
        # season rollover: pretend the save is from last month
        await pg.evaluate("() => { S.season.id = '2026-10'; S.season.xp = 4000; S.trophies = 9000; persist(); }")
        await pg.evaluate("() => { tick(S, Date.now()); persist(); render(); pendingEvents(); }")
        await pg.wait_for_timeout(500); await pg.screenshot(path=f'{OUT}/27_season_end.png')
        print('after rollover', await pg.evaluate("JSON.stringify({tro:S.trophies, season:S.season.id, xp:S.season.xp})"))
        # offline check: service worker registered + reload offline
        await pg.wait_for_timeout(1500)
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_timeout(1000)
        print('offline reload title:', await pg.title(), '| tabs present:', await pg.locator('#tabs button').count())
        await b.close()
    srv.terminate(); print('ERRORS:', errs if errs else 'none')
asyncio.run(main())
