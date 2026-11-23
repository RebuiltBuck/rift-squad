import asyncio, sys, subprocess, time
from playwright.async_api import async_playwright
OUT = 'tmp/shots'
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8767', '-d', 'dist/test'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('http://localhost:8767/index.html'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=f'{OUT}/30_test_welcome.png')
        await pg.click('[data-close]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/31_test_heroes.png', full_page=False)
        await pg.click('.hcard >> text=Chrono'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/32_test_chrono.png')
        await pg.click('#up'); await pg.wait_for_timeout(500)
        await pg.click('.modal .x'); await pg.click('#gear'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/33_test_tools.png')
        await pg.click('[data-ar="8800"]'); await pg.wait_for_timeout(300)
        await pg.click('#gear'); await pg.click('#tt-chests'); await pg.wait_for_timeout(300)
        await pg.click('#gear'); await pg.click('#tt-1d'); await pg.wait_for_timeout(300)
        await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/34_test_home.png')
        print(await pg.evaluate("JSON.stringify({owned:Object.keys(S.heroes).length, chrono:S.heroes.chrono.lvl, tro:S.trophies, ready:S.chests.filter(c=>c&&c.ready).length, off:S.testOffset})"))
        await b.close()
    srv.terminate(); print('ERRORS:', errs if errs else 'none')
asyncio.run(main())
