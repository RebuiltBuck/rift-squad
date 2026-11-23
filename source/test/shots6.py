import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = sys.argv[1]; W = int(sys.argv[2]); os.makedirs(OUT, exist_ok=True)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8772', '-d', 'dist/test'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': W, 'height': 740}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        await pg.goto('http://localhost:8772/index.html'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=f'{OUT}/0_help.png')
        await pg.click('[data-close]'); await pg.wait_for_timeout(300)
        for t in ['shop','season','road']:
            await pg.click(f'#tabs [data-tab={t}]'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/t_{t}.png')
        await pg.click('#tabs [data-tab=heroes]'); await pg.wait_for_timeout(300)
        await pg.click('.hcard >> nth=7'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/h_hero.png'); await pg.click('.modal .x')
        await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(300)
        await pg.click('text=BATTLE'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/v_vs.png')
        await pg.click('#fight'); await pg.wait_for_timeout(400)
        while await pg.locator('.offer').count(): await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(300)
        await pg.wait_for_timeout(400); await pg.screenshot(path=f'{OUT}/s_setup.png')
        await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(2600); await pg.screenshot(path=f'{OUT}/f_fight.png')
        await b.close()
    srv.terminate()
asyncio.run(main())
