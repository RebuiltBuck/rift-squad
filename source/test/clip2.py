import asyncio, sys, subprocess, time, os, base64, shutil, json
from playwright.async_api import async_playwright
OUT = sys.argv[1]; shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT + '/f')
SQUAD = sys.argv[2] if len(sys.argv) > 2 else "['chrono','zip','kit','dusty','nova','zorp']"
DUR = float(sys.argv[3]) if len(sys.argv) > 3 else 6
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8775', '-d', 'dist/test'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        await pg.goto('http://localhost:8775/index.html'); await pg.wait_for_timeout(600)
        await pg.click('[data-close]'); await pg.wait_for_timeout(200)
        await pg.evaluate("() => { S.squad = " + SQUAD + "; S.lastDiff = 'normal'; " + (sys.argv[4] if len(sys.argv) > 4 else '') + " persist(); render(); }")
        await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(200)
        await pg.click('text=BATTLE'); await pg.wait_for_timeout(200); await pg.click('#fight'); await pg.wait_for_timeout(300)
        rnd = 0
        while rnd < 3:
            while await pg.locator('.offer').count():
                await pg.click('.offer >> nth=0'); await pg.wait_for_timeout(250)
            await pg.wait_for_timeout(300)
            if await pg.locator('#b-btns .btn.gold:not(.off)').count(): rnd += 1
            if rnd >= 3: break
            if rnd >= 1:
                await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(300); await pg.click('#b-btns .btn.purple')
                for i in range(40):
                    await pg.wait_for_timeout(200)
                    if await pg.locator('.offer').count() or await pg.locator('#b-btns .btn.gold:not(.off)').count(): break
        box = await pg.locator('#bc').bounding_box()
        json.dump(box, open(OUT + '/box.json', 'w'))
        await pg.wait_for_timeout(1200)
        frames = []; loc = pg.locator('#bc')
        async def grab(n_ms):
            t1 = time.time() + n_ms / 1000
            while time.time() < t1:
                frames.append((time.time(), await pg.screenshot(clip=box, animations='allow', caret='initial', scale='device')))
        await grab(700)
        await pg.click('#b-btns .btn.gold')
        await grab(DUR * 1000)
        for i, (ts, d) in enumerate(frames): open(f'{OUT}/f/{i:04d}.png', 'wb').write(d)
        json.dump([ts for ts, d in frames], open(OUT + '/ts.json', 'w'))
        print('frames', len(frames), 'span', frames[-1][0] - frames[0][0])
        await b.close()
    srv.terminate()
asyncio.run(main())
