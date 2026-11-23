import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = 'tmp/shots4'; os.makedirs(OUT, exist_ok=True)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8771', '-d', 'dist/test'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        await pg.goto('http://localhost:8771/index.html'); await pg.wait_for_timeout(700)
        await pg.click('[data-close]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/a_heroes.png')
        await pg.click('.hcard >> nth=0'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/b_captain.png'); await pg.click('.modal .x')
        await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/c_home.png')
        await pg.evaluate("() => { S.trophies = 4300; S.best = 4300; S.lastDiff = 'normal'; persist(); render(); }")
        await pg.click('text=BATTLE'); await pg.click('#fight'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/d_offer.png')
        while await pg.locator('.offer').count(): await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(300)
        await pg.wait_for_timeout(500); await pg.screenshot(path=f'{OUT}/e_setup.png')
        await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(3500); await pg.screenshot(path=f'{OUT}/f_fight.png')
        await b.close()
    srv.terminate()
asyncio.run(main())
