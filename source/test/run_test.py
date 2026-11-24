# Rift Run: draft, fights, rewards, lives, hearts, resume, payout
import asyncio, sys, subprocess, time, os
from playwright.async_api import async_playwright
OUT = 'tmp/shots_run'; os.makedirs(OUT, exist_ok=True)
BUILD = sys.argv[1] if len(sys.argv) > 1 else 'test'
PORT = 8783
async def play_fight(pg, shots=False, tag=''):
    for i in range(150):
        if await pg.locator('#cont').count(): return True
        if await pg.locator('.mintro').count(): await pg.click('.mintro'); await pg.wait_for_timeout(300); continue
        ph = await pg.evaluate("M ? M.phase : 'none'")
        if ph == 'setup':
            for k in range(6):
                if not await pg.locator('.bcard.fit').count(): break
                await pg.click('.bcard.fit >> nth=0'); await pg.wait_for_timeout(120)
            if shots: await pg.screenshot(path=f'{OUT}/{tag}_setup.png'); shots = False
            await pg.click('#b-btns .btn.gold'); await pg.wait_for_timeout(250)
            if await pg.locator('#cf-yes').count(): await pg.click('#cf-yes'); await pg.wait_for_timeout(150)
        elif ph == 'fight': await pg.click('text=Skip'); await pg.wait_for_timeout(300)
        else: await pg.wait_for_timeout(300)
    return False
async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', f'dist/{BUILD}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8); errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 393, 'height': 793}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto(f'http://localhost:{PORT}/index.html'); await pg.wait_for_timeout(800)
        if await pg.locator('#tut-skip').count(): await pg.click('#tut-skip'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelectorAll('.modal-bg').forEach(m=>m.remove())")
        await pg.click('#tabs [data-tab=battle]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/01_home.png')
        await pg.click('.duelbtn'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}/01b_modes.png'); await pg.click('[data-mode=run]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{OUT}/01c_home_run.png')
        await pg.click('.battlebtn'); await pg.wait_for_timeout(400); await pg.screenshot(path=f'{OUT}/02_intro.png')
        await pg.click('#run-go'); await pg.wait_for_timeout(400); await pg.screenshot(path=f'{OUT}/03_captain.png')
        await pg.click('[data-o="0"]'); await pg.wait_for_timeout(400)
        for k in range(3):
            if k == 1: await pg.screenshot(path=f'{OUT}/04_draft.png')
            await pg.click('[data-o="0"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/05_map.png')
        print('run:', await pg.evaluate("JSON.stringify({phase:S.run.phase, cap:S.run.cap.hid, squad:S.run.squad.map(u=>u.hid+':'+u.ab)})"))
        g0, c0 = await pg.evaluate("S.gems"), await pg.evaluate("S.coins")
        stage_log = []
        for f in range(40):
            R = await pg.evaluate("S.run ? S.run.phase : 'none'")
            if R in ('none', 'over'): break
            if R == 'reward':
                if f == 1: await pg.screenshot(path=f'{OUT}/07_reward.png')
                await pg.click('[data-o="0"]'); await pg.wait_for_timeout(400); continue
            await pg.click('#run-fight'); await pg.wait_for_timeout(600)
            if f == 0: print('setup:', await pg.evaluate("JSON.stringify({run:M.setup.run, orbs:M.setup.orbs, toWin:M.setup.toWin, diff:M.setup.diff, foeHp:M.setup.foeHp, deck:M.setup.myDeck.length})"))
            ok = await play_fight(pg, f == 0, 's%d' % f)
            await pg.wait_for_timeout(1300)
            if f == 0: await pg.screenshot(path=f'{OUT}/06_result.png')
            stage_log.append(await pg.evaluate("JSON.stringify({st:S.run.stage, hearts:S.run.hearts, phase:S.run.phase, sq:S.run.squad.map(u=>u.hid+u.lives+(u.up?'*'+u.up:'')).join(' ')})"))
            await pg.click('#cont'); await pg.wait_for_timeout(500)
        for l in stage_log: print('  ', l)
        await pg.screenshot(path=f'{OUT}/08_after.png')
        if await pg.evaluate("S.run && S.run.phase !== 'over'"): await pg.click('#run-quit'); await pg.wait_for_timeout(300); await pg.click('#rq-go'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/09_over.png')
        await pg.click('#run-collect'); await pg.wait_for_timeout(1500)
        print('payout gems', g0, '->', await pg.evaluate("S.gems"), 'coins', c0, '->', await pg.evaluate("S.coins"), 'best', await pg.evaluate("S.runBest"), 'run', await pg.evaluate("S.run"))
        await pg.screenshot(path=f'{OUT}/10_intro_after.png')
        # resume mid-fight, then forfeit counts as a loss
        await pg.evaluate("document.querySelectorAll('.modal-bg,.copen').forEach(m=>m.remove())")
        await pg.evaluate("runStart(S, 12345); runChoose(S,0); runChoose(S,0); runChoose(S,0); runChoose(S,0); persist(); closeRun(); beginMatch(runSetup(S), null)"); await pg.wait_for_timeout(800)
        await pg.reload(); await pg.wait_for_timeout(1000)
        await pg.click('#ff'); await pg.wait_for_timeout(400)
        print('forfeit:', await pg.evaluate("JSON.stringify({hearts:S.run.hearts, phase:S.run.phase, stage:S.run.stage, active:S.activeBattle})"))
        # boss stage
        await pg.evaluate("S.run.stage = 10; S.run.phase = 'map'; persist(); openRun()"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'{OUT}/11_boss_map.png')
        await pg.click('#run-fight'); await pg.wait_for_timeout(600)
        print('boss setup:', await pg.evaluate("JSON.stringify({boss:M.setup.boss, fixed:M.setup.fixedFoe.map(u=>u.hid)})"))
        ok = await play_fight(pg, True, 'boss'); await pg.wait_for_timeout(1300)
        await pg.screenshot(path=f'{OUT}/12_boss_result.png')
        print('boss result:', await pg.evaluate("JSON.stringify({phase:S.run.phase, won:S.run.won, hearts:S.run.hearts})"))
        await b.close()
    srv.terminate(); print('ERRORS:', errs if errs else 'none')
asyncio.run(main())
