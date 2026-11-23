# Rift Squad

An offline pixel-art auto-battler for your phone.

Bring a squad of 6 heroes from a mash-up cast (knights, robots, ninjas, aliens, a dino mech...). Each round you place heroes on your half of a 5x8 board, up to your slot limit, then watch them fight the AI tile by tile. Bigger heroes cost more slots. The limit grows every round, and your Captain always fights. First to 3 round wins takes the match.

Long-term progression: arenas and a Trophy Road, chests opened with keys, hero levels 1-10 with a reward road per hero, monthly seasons, daily and weekly quests, and achievements.

## Play

Open https://rebuiltbuck.github.io/rift-squad/ in Safari on your phone, then tap **Share → Add to Home Screen**. After the first load it works with no connection.

Progress is stored on the device. Use **Settings → Backup** to copy a backup code now and then.

## Files

- `index.html`, `sw.js`, `manifest.webmanifest`, `icon-*.png`: the installable game (what GitHub Pages serves)
- `source/`: the game's source; `python3 build.py` rebuilds the files above

Fonts: Jersey 10 and Pixelify Sans (SIL Open Font License).
