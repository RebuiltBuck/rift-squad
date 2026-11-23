import asyncio, sys, subprocess, time, os, glob, shutil
from playwright.async_api import async_playwright
OUT = sys.argv[1]; shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8774', '-d', 'dist/test'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, record_video_dir=OUT + '/vid', record_video_size={'width': 780, 'height': 1688})
        pg = await ctx.new_page()
        await pg.goto('http://localhost:8774/index.html'); await pg.wait_for_timeout(600)
        await pg.click('[data-close]'); await pg.wait_for_timeout(200)
        await pg.evaluate("() => { S.squad = ['chrono','zip','kit','dusty','nova','zorp']; S.lastDiff = 'normal'; persist(); render(); }")
        await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(200)
        await pg.click('text=BATTLE'); await pg.wait_for_timeout(200); await pg.click('#fight'); await pg.wait_for_timeout(300)
        while await pg.locator('.offer').count():
            await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(1500); await pg.screenshot(path=f'{OUT}/setup1.png')
        t0 = time.time()
        await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(9000)
        await pg.click('#b-btns .btn.purple')
        for i in range(40):
            await pg.wait_for_timeout(250)
            if await pg.locator('.offer').count(): break
        while await pg.locator('.offer').count():
            await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(1800); await pg.screenshot(path=f'{OUT}/setup2.png')
        open(f'{OUT}/t0.txt', 'w').write(str(t0 - ctx_start))
        await ctx.close(); await b.close()
    srv.terminate()
ctx_start = time.time()
asyncio.run(main())
