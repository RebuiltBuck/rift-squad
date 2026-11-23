import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8776', '-d', 'dist/artifact'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('http://localhost:8776/index.html'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=f'{OUT}/a_help.png')
        await pg.click('[data-close]'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#screen').scrollTop = 9999"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f'{OUT}/b_home.png')
        await pg.click('.shelfc >> nth=0'); await pg.wait_for_timeout(300); await pg.click('.modal'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/c_open.png')
        await pg.click('[data-close]'); await pg.wait_for_timeout(200)
        await pg.click('#tabs [data-tab=heroes]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/d_heroes.png')
        await pg.click('.hcard >> nth=0'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/e_card.png')
        if await pg.locator('[data-un]').count():
            await pg.click('[data-un]'); await pg.wait_for_timeout(400); await pg.screenshot(path=f'{OUT}/f_card_unlocked.png')
        await pg.click('.modal [data-close]'); await pg.wait_for_timeout(200)
        await pg.click('#tabs [data-tab=shop]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/g_shop.png', full_page=False)
        await b.close()
    srv.terminate(); print('ERRORS:', errs if errs else 'none')
asyncio.run(main())
