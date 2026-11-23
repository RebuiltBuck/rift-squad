# Rift Squad source

- `src/data.js` heroes, arenas, economy numbers · `src/battle.js` rules + AI · `src/progress.js` chests, road, seasons, quests, shop, saves
- `src/render.js` pixel renderer · `src/ui.js` screens and battle flow · `src/music.js` chiptune battle music · `src/tutorial.js` first-match tutorial · `src/sprites.json` all pixel art
- Hero art (GBA style, 16x20): `python3 art/gba.py` writes `art/sprites_gba.json`; encode it into `src/sprites_gba.json` (see build notes)
- Build: `python3 build.py` (needs Pillow) → `dist/pwa/` (copy its files to the repo root) and `dist/artifact/`
- Tests: `python3 test/scroll_check.py artifact 667` (lists any screen or popup that needs scrolling on a small phone), `python3 test/tut_test.py` (plays the whole tutorial in Chrome), `node test/ability_test.js` (every ability fires), `node test/auto_test.js ladder` (AI difficulty ladder), `node test/auto_test.js heroes` (hero balance), `node test/econ_sim.js 6 0` (3-year pacing sim)
