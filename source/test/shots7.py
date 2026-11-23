import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8773', '-d', 'dist/artifact'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 375, 'height': 740}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        await pg.goto('http://localhost:8773/index.html'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=f'{OUT}/help.png')
        await pg.click('[data-close]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/home.png')
        await pg.click('#tabs [data-tab=heroes]'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/heroes.png')
        await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(300)
        await pg.click('text=BATTLE'); await pg.wait_for_timeout(300); await pg.click('#fight'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/offer.png')
        while await pg.locator('.offer').count(): await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(300)
        await pg.wait_for_timeout(300); await pg.click('#b-btns .btn.gold')
        for i in range(30):
            await pg.wait_for_timeout(250); await pg.screenshot(path=f'{OUT}/fight_{i:02d}.png')
        await b.close()
    srv.terminate()
asyncio.run(main())
