import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8778', '-d', 'dist/artifact'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8778/index.html'); await pg.wait_for_timeout(600)
        await pg.click('[data-close]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/01_home.png')
        await pg.evaluate("document.querySelector('#screen').scrollTop = 9999"); await pg.wait_for_timeout(200)
        await pg.click('.shelfc >> nth=1'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/02_chest.png')
        await pg.click('.co-stage'); await pg.wait_for_timeout(350)
        await pg.screenshot(path=f'{OUT}/03_crack.png')
        await pg.wait_for_timeout(400); await pg.screenshot(path=f'{OUT}/04_burst.png')
        await pg.wait_for_timeout(1300); await pg.screenshot(path=f'{OUT}/05_spin.png')
        await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}/06_slow.png')
        await pg.wait_for_timeout(2400); await pg.screenshot(path=f'{OUT}/07_land.png')
        await pg.wait_for_timeout(600); await pg.screenshot(path=f'{OUT}/08_reveal.png')
        for i in range(6):
            if await pg.locator('#co-ok').count(): break
            await pg.click('.co-body'); await pg.wait_for_timeout(200); await pg.click('.co-body'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'{OUT}/09_summary.png')
        if await pg.locator('#co-ok').count(): await pg.click('#co-ok'); await pg.wait_for_timeout(300)
        await pg.click('#tabs [data-tab=heroes]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/10_heroes.png')
        await pg.click('.hcard >> nth=0'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/11_card.png')
        await b.close()
    srv.terminate(); print('ERRORS:', errs or 'none')
asyncio.run(main())
