# Measures which screens / popups need scrolling on a phone-sized screen
import asyncio, sys, subprocess, time, os, json
from playwright.async_api import async_playwright
BUILD = sys.argv[1] if len(sys.argv) > 1 else 'test'
H = int(sys.argv[2]) if len(sys.argv) > 2 else 844
OUT = f'tmp/scroll_{BUILD}_{H}'; os.makedirs(OUT, exist_ok=True)
MEASURE = """(() => { const sc = document.querySelector('#screen'), md = document.querySelector('.modal');
  const f = el => el ? { over: Math.max(0, el.scrollHeight - el.clientHeight) } : null;
  return { screen: f(sc), modal: f(md) }; })()"""
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8776', '-d', f'dist/{BUILD}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.7); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': H}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8776/index.html'); await pg.wait_for_timeout(700)
        if await pg.locator('#tut-skip').count(): await pg.click('#tut-skip'); await pg.wait_for_timeout(300)
        await pg.click('[data-close]'); await pg.wait_for_timeout(300)
        res = {}
        async def snap(name):
            await pg.wait_for_timeout(350); res[name] = await pg.evaluate(MEASURE); await pg.screenshot(path=f'{OUT}/{name}.png')
        for tab in ['battle', 'season', 'road', 'shop', 'heroes']:
            await pg.click(f'#tabs [data-tab={tab}]'); await snap('tab_' + tab)
        await pg.click('#tabs [data-tab=season]'); await pg.click('text=Rewards'); await snap('season_track')
        await pg.click('#tabs [data-tab=road]'); await pg.evaluate("ROAD_PAGE = 999; render()"); await snap('road_last')
        for name, js in [('help', 'openHelp()'), ('shelf', "for (let i = 0; i < 12; i++) addToShelf(S, 'hero', 0); openShelf()"), ('hero_info', "heroInfo('kit')"), ('hero_locked', "heroInfo(HEROES.find(h => !(S.heroes[h.id] && S.heroes[h.id].tr >= 1)) ? HEROES.find(h => !(S.heroes[h.id] && S.heroes[h.id].tr >= 1)).id : 'rex')"), ('captain_info', "heroInfo('bruno')"),
                         ('profile', 'openProfile()'), ('settings', 'openSettings()'), ('pick', 'pickSquad(1)')]:
            await pg.evaluate("document.querySelectorAll('.modal-bg,.mbg,#modal-root > *').forEach(e => e.remove())")
            await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(150)
            await pg.evaluate(js); await snap(name)
        await pg.evaluate("document.querySelectorAll('#modal-root > *').forEach(e => e.remove())")
        await pg.click('text=BATTLE'); await pg.wait_for_timeout(300); await snap('vs')
        await pg.click('#fight'); await pg.wait_for_timeout(700); await pg.screenshot(path=f'{OUT}/intro.png'); await pg.click('.mintro'); await pg.wait_for_timeout(400)
        for i in range(10):
            if await pg.locator('.offer').count(): await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(300)
        await pg.wait_for_timeout(300)
        await pg.evaluate("finishMatch(false)"); await pg.wait_for_timeout(2900); await snap('results')
        res['board_setup'] = await pg.evaluate("(() => { const r = document.querySelector('#bc').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })()")
        await pg.screenshot(path=f'{OUT}/battle_setup.png')
        await b.close()
    srv.terminate()
    for k, v in res.items(): print(k.ljust(14), v)
    print('ERRORS:', errs or 'none')
asyncio.run(main())
