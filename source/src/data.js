// ===== Rift Squad: game data =====
const RARITIES = {
  common:    { name: 'Common',    color: '#aab3c0', order: 0, shardCoin: 20,  weight: 1.0,  arena: 0 },
  rare:      { name: 'Rare',      color: '#4fa3ff', order: 1, shardCoin: 240,  weight: 0.8,  arena: 1 },
  epic:      { name: 'Epic',      color: '#b36bff', order: 2, shardCoin: 120, weight: 0.6,  arena: 3 },
  mythic:    { name: 'Mythic',    color: '#ff4f6b', order: 3, shardCoin: 50, weight: 0.45, arena: 6 },
  legendary: { name: 'Legendary', color: '#ffd23f', order: 4, shardCoin: 500, weight: 0.35, arena: 9 },
};

// Four simple roles. Small whole numbers: tanks ~10-16 health, squishy heroes ~4-6, most hits do 1-2.
// as = seconds between attacks, rng = attack range in tiles (each hero can override hp / dmg / as)
const ROLES = {
  tank:    { name: 'Tank',    icon: 'i_arm',    hp: 12, dmg: 1, as: 1.3, rng: 1, blurb: 'Lots of health, stands in front' },
  fighter: { name: 'Fighter', icon: 'i_swords', hp: 7,  dmg: 2, as: 1.0, rng: 1, blurb: 'Hits hard up close' },
  ranged:  { name: 'Ranged',  icon: 'i_bow',    hp: 4,  dmg: 1, as: 1.0, rng: 2, blurb: 'Attacks from a distance' },
  healer:  { name: 'Healer',  icon: 'i_healer', hp: 5,  dmg: 1, as: 1.1, rng: 2, blurb: 'Keeps the team alive' },
};
// Attack looks. d = seconds from the swing / shot until the hit lands (heavy swings land later)
const LOOKS = {
  slash: { d: 0.1, body: 'lunge' }, slash2: { d: 0.07, body: 'quick' }, stab: { d: 0.06, body: 'quick' }, claw: { d: 0.08, body: 'lunge' },
  punch: { d: 0.08, body: 'lunge' }, whip: { d: 0.14, body: 'lunge' }, chomp: { d: 0.2, body: 'lunge' },
  smash: { d: 0.32, body: 'heavy' }, chop: { d: 0.32, body: 'heavy' },
  bolt: { d: 0.12, shot: 1 }, bullet: { d: 0.07, shot: 1 }, zap: { d: 0.05, shot: 1 }, orb: { d: 0.22, shot: 1 },
  star: { d: 0.18, shot: 1 }, hex: { d: 0.24, shot: 1 }, fireball: { d: 0.26, shot: 1 }, lob: { d: 0.34, shot: 1 },
};

// ===== Abilities: every hero has 3 of its own. Unlocked at 2 / 5 / 10 hero trophies (plus coins), one equipped at a time.
// kind: 'charge' = fills the purple bar then fires (cd = seconds), 'start' = fires once when the round begins, 'passive' = always on
// hero level = hero trophies collected (1-10). Level 1 unlocks the hero and its first ability; 5 and 10 open the other two.
const ABILITY_TROPHIES = [1, 5, 10];
const ABILITY_COINS = [0, 500, 2000];
// each hero's own road: a reward for every level it reaches (claimed from the hero's card)
const HERO_ROAD = [null,
  { kind: 'ab', k: 0 },               // 1: the hero + first ability
  { kind: 'coins', n: 100 },          // 2
  { kind: 'keys', n: 2 },             // 3
  { kind: 'gems', n: 10 },            // 4
  { kind: 'ab', k: 1 },               // 5: second ability
  { kind: 'coins', n: 300 },          // 6
  { kind: 'chest', chest: 'hero' },   // 7
  { kind: 'keys', n: 3 },             // 8
  { kind: 'gems', n: 20 },            // 9
  { kind: 'ab', k: 2, gold: true },   // 10: third ability + gold card
];
const HERO_MAX = 10;
// wild trophies: a rare chest drop you can put on any hero you like
const WILD_CHANCE = { hero: 0.07, mega: 0.4, resource: 0 };
const AB_KIND = { charge: 'Charge', start: 'Round start', passive: 'Passive' };
const ABILITIES = {
  // Sir Bruno
  bash:      { name: 'Shield Bash',     icon: 'i_hit',      kind: 'charge', cd: 6, desc: '+1 damage and knocks the enemy back a tile.' },
  rally:     { name: 'Rally',           icon: 'i_shield',   kind: 'start',  desc: 'Friends next to him get a 2 shield.' },
  taunt:     { name: 'Taunt',           icon: 'i_taunt',    kind: 'charge', cd: 8, desc: 'Every enemy on the board must attack him for 3 seconds.' },
  // Captain Marla
  cannon:    { name: 'Cannon Shot',     icon: 'i_cannon',   kind: 'start',  desc: '3 damage to the first enemy in her lane.' },
  plunder:   { name: 'Plunder',         icon: 'coin',       kind: 'passive', desc: '+1 damage for each enemy she defeats.' },
  hook:      { name: 'Grappling Hook',  icon: 'i_hook',     kind: 'start',  desc: 'Pulls the farthest enemy in her lane next to her.' },
  // Rocco
  boulder:   { name: 'Boulder Toss',    icon: 'i_rock',     kind: 'charge', cd: 6, desc: '+2 damage to an enemy up to 2 tiles away.' },
  stoneskin: { name: 'Stone Skin',      icon: 'i_stone',    kind: 'passive', desc: 'The first 3 hits on him each round do nothing.' },
  quake:     { name: 'Quake',           icon: 'i_quake',    kind: 'charge', cd: 8, desc: 'Stuns every enemy next to him for 2 seconds.' },
  // Mumbo
  wrap:      { name: 'Wrap',            icon: 'i_wrap',     kind: 'charge', cd: 7, desc: 'Bandages an enemy up to 2 tiles away: stunned for 2 seconds.' },
  curse:     { name: 'Curse',           icon: 'i_skull',    kind: 'start',  desc: 'The closest enemy takes +1 from every hit for 5 seconds.' },
  sandstorm: { name: 'Sandstorm',       icon: 'i_whirl',    kind: 'charge', cd: 8, desc: 'Enemies within 2 tiles take 1 and are slowed for 3 seconds.' },
  // Titan Rex
  chomp3:    { name: 'Chomp Combo',     icon: 'i_teeth',    kind: 'charge', cd: 6, desc: 'Bites his target 3 times quickly.' },
  overdrive: { name: 'Overdrive',       icon: 'i_ff',       kind: 'passive', desc: 'Below half health, attacks twice as fast.' },
  missiles:  { name: 'Missile Barrage', icon: 'i_missile',  kind: 'start',  desc: '2 damage to the 3 closest enemies.' },
  // Chrono
  mend:      { name: 'Mend',            icon: 'i_cross',    kind: 'charge', cd: 6, desc: 'Heals every friend for 1.' },
  haste:     { name: 'Haste',           icon: 'i_ff',       kind: 'charge', cd: 8, desc: 'Friends within 2 tiles attack twice as fast for 3 seconds.' },
  slowtime:  { name: 'Slow Time',       icon: 'i_clock',    kind: 'start',  desc: 'All enemies move and attack at half speed for 4 seconds.' },
  // Zip-9
  laser:     { name: 'Laser',           icon: 'i_laser',    kind: 'start',  desc: 'A beam down his lane: +2 damage to every enemy in it.' },
  overclock: { name: 'Overclock',       icon: 'i_gear',     kind: 'charge', cd: 7, desc: 'Fires twice as fast for 3 seconds.' },
  mine:      { name: 'Shock Mine',      icon: 'i_mine',     kind: 'start',  desc: 'Plants a mine 2 tiles ahead. The first enemy on it takes 2 and is stunned for 2 seconds.' },
  // Nova
  heal:      { name: 'Heal',            icon: 'i_cross',    kind: 'charge', cd: 6, desc: 'Heals the most hurt friend for 3.' },
  bubble:    { name: 'Bubble',          icon: 'i_shield',   kind: 'charge', cd: 7, desc: 'Gives the most hurt friend a 3 shield.' },
  drone:     { name: 'Med Drone',       icon: 'i_drone',    kind: 'start',  desc: 'A drone heals the most hurt friend for 1 every 2 seconds.' },
  // Gus
  poison:    { name: 'Poison Dagger',   icon: 'i_poison',   kind: 'passive', desc: 'His hits poison: 1 damage a second for 3 seconds.' },
  scrap:     { name: 'Scrap Bomb',      icon: 'i_bomb',     kind: 'charge', cd: 7, desc: 'Throws a bomb: +1 damage to his target and the enemies next to it.' },
  backstab:  { name: 'Backstab',        icon: 'i_dash',     kind: 'charge', cd: 7, desc: 'Jumps behind his target and hits for +2.' },
  // Dusty
  quickdraw: { name: 'Quick Draw',      icon: 'i_target',   kind: 'start',  desc: 'Instantly shoots the closest enemy for 3.' },
  bomb:      { name: 'Bomb Toss',       icon: 'i_bomb',     kind: 'start',  desc: 'Throws a bomb 3 tiles ahead: +1 damage to every enemy around it.' },
  lasso:     { name: 'Lasso',           icon: 'i_hook',     kind: 'charge', cd: 7, desc: 'Pulls his target a tile closer and stuns it for 1 second.' },
  // Chef Bao
  snack:     { name: 'Snack Toss',      icon: 'i_food',     kind: 'charge', cd: 6, desc: 'Heals the 2 most hurt friends for 2.' },
  pepper:    { name: 'Pepper Toss',     icon: 'i_flame',    kind: 'charge', cd: 7, desc: 'His target and the enemies next to it burn: 1 damage a second for 3 seconds.' },
  feast:     { name: 'Feast',           icon: 'i_heart',    kind: 'start',  desc: 'Every friend gets +2 health this round.' },
  // Kit
  dash:      { name: 'Shadow Dash',     icon: 'i_dash',     kind: 'start',  desc: 'Leaps behind the enemy back line and strikes for +1.' },
  shuriken:  { name: 'Shuriken Storm',  icon: 'i_shuriken', kind: 'charge', cd: 6, desc: '1 damage to the 3 closest enemies.' },
  smoke:     { name: 'Smoke Bomb',      icon: 'i_smoke',    kind: 'charge', cd: 8, desc: 'Vanishes for 2 seconds: enemies lose track of him.' },
  // Yuki
  freeze:    { name: 'Freeze',          icon: 'i_snow',     kind: 'charge', cd: 7, desc: 'Freezes an enemy up to 2 tiles away for 2 seconds.' },
  snowfort:  { name: 'Snow Fort',       icon: 'i_shield',   kind: 'passive', desc: 'The first time he drops below half health, he gets a 4 shield.' },
  avalanche: { name: 'Avalanche',       icon: 'i_snowball', kind: 'start',  desc: 'Snow rolls down his lane: enemies in it take 1 and are slowed for 4 seconds.' },
  // Volt
  turbo:     { name: 'Turbo Punch',     icon: 'i_arm',      kind: 'charge', cd: 6, desc: '+2 damage to his target.' },
  nitro:     { name: 'Nitro',           icon: 'i_boot',     kind: 'start',  desc: 'Moves and attacks twice as fast for 4 seconds.' },
  chain:     { name: 'Chain Lightning', icon: 'i_bolt',     kind: 'charge', cd: 7, desc: '+1 damage to his target, then 1 damage to 2 more enemies nearby.' },
  // Hex
  frog:      { name: 'Frog Hex',        icon: 'i_frog',     kind: 'charge', cd: 8, desc: 'Turns her target into a frog for 2 seconds: it can\'t attack.' },
  drain:     { name: 'Soul Drain',      icon: 'i_drop',     kind: 'charge', cd: 6, desc: '+1 damage to her target and heals the most hurt friend for 2.' },
  cauldron:  { name: 'Cauldron',        icon: 'i_cauldron', kind: 'start',  desc: 'Drops a cauldron 2 tiles ahead: enemies next to it take 1 damage a second for 4 seconds.' },
  // Luna
  meteor:    { name: 'Meteor',          icon: 'i_meteor',   kind: 'start',  desc: '3 damage to the toughest enemy.' },
  zerog:     { name: 'Zero Gravity',    icon: 'i_float',    kind: 'charge', cd: 8, desc: 'Her target and the enemies next to it float for 2 seconds and can\'t act.' },
  blackhole: { name: 'Black Hole',      icon: 'i_hole',     kind: 'charge', cd: 8, desc: 'Pulls the enemies around her target together and hits each for 1.' },
  // Ragnar
  whirl:     { name: 'Whirlwind',       icon: 'i_whirl',    kind: 'charge', cd: 6, desc: 'Spins: +1 damage to every enemy next to him.' },
  berserk:   { name: 'Berserk',         icon: 'i_buff',     kind: 'passive', desc: 'Below half health, deals +1 damage.' },
  warcry:    { name: 'War Cry',         icon: 'i_swords',   kind: 'start',  desc: 'Friends next to him get +1 damage this round.' },
  // Countess Vex
  lifedrain: { name: 'Life Drain',      icon: 'i_drop',     kind: 'passive', desc: 'Heals 1 every time she hits.' },
  batform:   { name: 'Bat Form',        icon: 'i_bat',      kind: 'start',  desc: 'Flies next to the weakest enemy.' },
  charm:     { name: 'Charm',           icon: 'i_charm',    kind: 'charge', cd: 9, desc: 'Her target attacks its own friends for 3 seconds.' },
  // Zorp
  shrink:    { name: 'Shrink Ray',      icon: 'i_shrink',   kind: 'charge', cd: 7, desc: 'His target shrinks and takes double damage for 3 seconds.' },
  clone:     { name: 'Clone',           icon: 'i_clone',    kind: 'start',  desc: 'Makes a copy of himself with 2 health.' },
  abduct:    { name: 'Abduct',          icon: 'i_ufo',      kind: 'start',  desc: 'Beams up the closest enemy: it\'s gone for the first 4 seconds.' },
  // Ember
  fireball:  { name: 'Fireball',        icon: 'i_flame',    kind: 'charge', cd: 6, desc: '+1 damage to her target and the enemies next to it.' },
  flamering: { name: 'Flame Ring',      icon: 'i_ring',     kind: 'charge', cd: 7, desc: '1 damage to every enemy within 2 tiles.' },
  firewall:  { name: 'Fire Wall',       icon: 'i_firewall', kind: 'start',  desc: 'Sets 3 tiles 2 ahead of her on fire for 6 seconds: 1 damage a second to enemies in them.' },
};
const HERO_ABILITIES = {
  bruno: ['bash', 'rally', 'taunt'], marla: ['cannon', 'plunder', 'hook'], rocco: ['boulder', 'stoneskin', 'quake'],
  mumbo: ['wrap', 'curse', 'sandstorm'], rex: ['chomp3', 'overdrive', 'missiles'], chrono: ['mend', 'haste', 'slowtime'],
  zip: ['laser', 'overclock', 'mine'], nova: ['heal', 'bubble', 'drone'], gus: ['poison', 'scrap', 'backstab'],
  dusty: ['quickdraw', 'bomb', 'lasso'], bao: ['snack', 'pepper', 'feast'], kit: ['dash', 'shuriken', 'smoke'],
  yuki: ['freeze', 'snowfort', 'avalanche'], volt: ['turbo', 'nitro', 'chain'], hex: ['frog', 'drain', 'cauldron'],
  luna: ['meteor', 'zerog', 'blackhole'], ragnar: ['whirl', 'berserk', 'warcry'], vex: ['lifedrain', 'batform', 'charm'],
  zorp: ['shrink', 'clone', 'abduct'], ember: ['fireball', 'flamering', 'firewall'],
};
// How each hero picks who to attack (shown on its card and in battle)
const TARGETING = {
  near: { name: 'Closest',   icon: 'i_tnear', desc: 'Attacks the closest enemy.' },
  back: { name: 'Back line', icon: 'i_tback', desc: 'Runs past the front to hit enemies in the back row.' },
  weak: { name: 'Weakest',   icon: 'i_tweak', desc: 'Goes after the enemy with the least health.' },
  big:  { name: 'Toughest',  icon: 'i_tbig',  desc: 'Goes after the enemy with the most health.' },
};
function rangeText(n) { return n <= 1 ? 'Has to stand right next to an enemy to hit it (not diagonally).' : `Hits enemies up to ${n} tiles away. Tiles count up, down, left and right, not diagonally.`; }
function heroTarget(hid) { return (typeof GRID_MODE !== 'undefined' && GRID_MODE) ? 'near' : HERO[hid].tg || 'near'; } // grid test mode: everyone hits the closest

// Movement speed: seconds to cross one tile
const SPEEDS = { slow: { name: 'Slow', t: 0.75 }, normal: { name: 'Normal', t: 0.55 }, fast: { name: 'Fast', t: 0.38 } };
const ROLE_SPEED = { tank: 'slow', fighter: 'normal', ranged: 'normal', healer: 'normal' };
function heroSpeed(hid) { const h = HERO[hid]; return h.spd || ROLE_SPEED[h.role]; }

// Worlds: 2 heroes from the same world on the board = +1 health each, 3+ = +2 health each
const WORLD_BONUS = [1, 2];
// Worlds and world team-ups are switched off for now (kept for later). true = shown and +health bonuses on.
const WORLDS_ON = false;
const WORLDS = {
  kingdom:  { name: 'Kingdom',  color: '#ffd23f' },
  machines: { name: 'Machines', color: '#4ff0ff' },
  spooky:   { name: 'Spooky',   color: '#b36bff' },
  wild:     { name: 'Wild',     color: '#5fd068' },
  rogues:   { name: 'Rogues',   color: '#ff4f6b' },
  cosmic:   { name: 'Cosmic',   color: '#8fd3ff' },
};

// cap = Captain power (Captains only)
const HEROES = [
  { id: 'bruno',  captain: true, name: 'Sir Bruno',     world: 'kingdom',  origin: 'Knight',           rarity: 'common',    role: 'tank',    color: '#3a6fd8', hp: 15, dmg: 1, as: 1.2, cost: 3, rng: 1, look: 'slash', lc: '#ffffff', spd: 'normal',
    cap: { name: 'Shield Wall', desc: 'Team starts each round with a 2 shield.', fx: { shieldStart: 2 } } },
  { id: 'marla',  captain: true, name: 'Captain Marla', world: 'rogues',   origin: 'Pirate',           rarity: 'common',    role: 'fighter', color: '#c0392b', hp: 10, dmg: 2, as: 1.1, cost: 2, rng: 1, look: 'slash2', lc: '#ffe9a8',
    cap: { name: 'Plunder', desc: 'Team abilities deal +1 damage.', fx: { abilDmg: 1 } } },
  { id: 'rocco',  captain: true, name: 'Rocco',         world: 'wild',     origin: 'Living Mountain',  rarity: 'common',    role: 'tank',    color: '#9a8f86', hp: 16, dmg: 2, as: 1.8, cost: 3, rng: 1, look: 'smash', lc: '#c8b8a8',
    cap: { name: 'Bedrock', desc: 'Team takes 1 less damage from abilities.', fx: { abilBlock: 1 } } },
  { id: 'mumbo',  captain: true, name: 'Mumbo',         world: 'spooky',   origin: 'Mummy King',       rarity: 'epic',      role: 'tank',    color: '#e8dcc0', hp: 14, dmg: 1, as: 1.3, cost: 3, rng: 2, look: 'whip', lc: '#ece0c4',
    cap: { name: 'Undying', desc: 'First friend to fall gets back up with half health.', fx: { revive: 0.5 } } },
  { id: 'rex',    captain: true, name: 'Titan Rex',     world: 'machines', origin: 'Dino Mech',        rarity: 'legendary', role: 'tank',    color: '#4caf50', hp: 16, dmg: 2, as: 1.6, cost: 4, rng: 1, look: 'chomp', lc: '#ffffff',
    cap: { name: 'Titan Plating', desc: 'Every hero on the team gets +2 health.', fx: { hp: 2 } } },
  { id: 'chrono', captain: true, name: 'Chrono',        world: 'cosmic',   origin: 'Time Wizard',      rarity: 'legendary', role: 'healer',  color: '#3b5bdb', hp: 8, dmg: 1, as: 1.2, cost: 2, rng: 3, look: 'orb', lc: '#7fb2ff', spd: 'slow',
    cap: { name: 'Haste', desc: 'Team abilities charge faster.', fx: { abilHaste: 0.6 } } },
  { id: 'zip',    name: 'Zip-9',        world: 'machines', origin: 'Robot',          rarity: 'common',    role: 'ranged',  color: '#4ff0ff', hp: 4, dmg: 1, as: 1.0, cost: 1, rng: 3, look: 'bolt', lc: '#4ff0ff' },
  { id: 'nova',   name: 'Nova',         world: 'cosmic',   origin: 'Space Medic',    rarity: 'common',    role: 'healer',  color: '#ff7ab8', hp: 5, dmg: 1, as: 1.1, cost: 1, rng: 2, look: 'orb', lc: '#ff8ac8', spd: 'fast' },
  { id: 'gus',    name: 'Gus',          world: 'wild',     origin: 'Goblin',         rarity: 'common',    role: 'fighter', color: '#6cc24a', hp: 6, dmg: 1, as: 0.7, tg: 'back', cost: 1, rng: 1, look: 'stab', lc: '#e8eef5', spd: 'fast' },
  { id: 'dusty',  name: 'Dusty',        world: 'rogues',   origin: 'Cowboy',         rarity: 'common',    role: 'ranged',  color: '#c98a3a', hp: 4, dmg: 2, as: 1.6, tg: 'weak', cost: 2, rng: 4, look: 'bullet', lc: '#ffd23f' },
  { id: 'bao',    name: 'Chef Bao',     world: 'kingdom',  origin: 'Royal Chef',     rarity: 'common',    role: 'healer',  color: '#ff9aa8', hp: 6, dmg: 1, as: 1.3, cost: 2, rng: 2, look: 'lob', lc: '#fff3d6', spd: 'slow' },
  { id: 'kit',    name: 'Kit',          world: 'rogues',   origin: 'Ninja',          rarity: 'rare',      role: 'fighter', color: '#e03c3c', hp: 5, dmg: 1, as: 0.6, tg: 'back', cost: 1, rng: 1, look: 'slash2', lc: '#ffffff', spd: 'fast' },
  { id: 'yuki',   name: 'Yuki',         world: 'wild',     origin: 'Yeti',           rarity: 'rare',      role: 'tank',    color: '#7cc8f2', hp: 13, dmg: 1, as: 1.4, cost: 2, rng: 1, look: 'punch', lc: '#bfe8ff' },
  { id: 'volt',   name: 'Volt',         world: 'machines', origin: 'Mech Racer',     rarity: 'rare',      role: 'fighter', color: '#ffd23f', hp: 7, dmg: 1, as: 0.8, cost: 1, rng: 1, look: 'punch', lc: '#ffe94f', spd: 'fast' },
  { id: 'hex',    name: 'Hex',          world: 'spooky',   origin: 'Witch',          rarity: 'epic',      role: 'ranged',  color: '#7b3fd1', hp: 4, dmg: 1, as: 1.2, tg: 'weak', cost: 2, rng: 3, look: 'hex', lc: '#c07bff' },
  { id: 'luna',   name: 'Luna',         world: 'cosmic',   origin: 'Astronaut',      rarity: 'epic',      role: 'ranged',  color: '#8fd3ff', hp: 5, dmg: 1, as: 1.1, cost: 2, rng: 3, look: 'star', lc: '#fff3a8' },
  { id: 'ragnar', name: 'Ragnar',       world: 'kingdom',  origin: 'Viking',         rarity: 'epic',      role: 'fighter', color: '#e07b2a', hp: 9, dmg: 3, as: 1.9, tg: 'big', cost: 3, rng: 1, look: 'chop', lc: '#ffffff' },
  { id: 'vex',    name: 'Countess Vex', world: 'spooky',   origin: 'Vampire',        rarity: 'mythic',    role: 'fighter', color: '#e0193a', hp: 7, dmg: 2, as: 1.0, tg: 'back', cost: 2, rng: 1, look: 'claw', lc: '#ff3b5c', spd: 'fast' },
  { id: 'zorp',   name: 'Zorp',         world: 'cosmic',   origin: 'Alien',          rarity: 'mythic',    role: 'ranged',  color: '#7ee05a', hp: 4, dmg: 1, as: 1.0, tg: 'weak', cost: 2, rng: 3, look: 'zap', lc: '#7dff6b' },
  { id: 'ember',  name: 'Ember',        world: 'kingdom',  origin: 'Fire Mage',      rarity: 'mythic',    role: 'ranged',  color: '#ff8a2a', hp: 4, dmg: 2, as: 1.5, cost: 3, rng: 4, look: 'fireball', lc: '#ff8a2a' },
];
const HERO = {}; HEROES.forEach(h => HERO[h.id] = h);
const CAPTAIN_IDS = HEROES.filter(h => h.captain).map(h => h.id);
const START_HEROES = ['bruno', 'zip', 'nova', 'gus', 'dusty', 'bao'];
// Captains: one big, tough leader per world (their bigger stats are set above). Only Captains can fill the Captain slot.
const SQUAD_SIZE = 6; // Captain + 5
// slots: every hero costs 1-4 slots; your slot limit grows each round, and the team that lost the last round gets 1 extra
const SLOT_START = 5, SLOT_MAX = 9, COMEBACK_SLOTS = 1;
function slotCap(round) { return Math.min(SLOT_START + Math.max(0, round - 1), SLOT_MAX); }
function heroCost(hid) { return (HERO[hid] && HERO[hid].cost) || 2; }
function slotsUsed(list) { return list.reduce((n, h) => n + heroCost(h.hid || h), 0); }
// bigger heroes are built stronger: health and damage grow with cost
const COST_HP = { 1: 0.85, 2: 1.3, 3: 1.8, 4: 1.8 }, COST_DMG = { 1: 0, 2: 0, 3: 0, 4: 0 };

const ARENAS = [
  { name: 'Training Meadow', t: 0,     lvl: 1,  floor: ['#5fae4e', '#57a347', '#7cc464'], obs: 'rock',    obsPal: null, bg: '#2f5d3a' },
  { name: 'Goblin Woods',    t: 300,   lvl: 2,  floor: ['#3f7f3a', '#3a7534', '#5a9a46'], obs: 'rock',    obsPal: { a: '#7c8a6a', b: '#55604a', c: '#a3b38c' }, bg: '#1f3b22' },
  { name: 'Sandstone Ruins', t: 700,   lvl: 2,  floor: ['#d9b26f', '#cfa762', '#e8c88a'], obs: 'pillar',  obsPal: null, bg: '#7a5a2e' },
  { name: 'Pirate Cove',     t: 1200,  lvl: 3,  floor: ['#b98b55', '#ad7f4b', '#cfa46e'], obs: 'crate',   obsPal: null, bg: '#1e4f6e' },
  { name: 'Frostpeak',       t: 1800,  lvl: 4,  floor: ['#dfe9f3', '#d1dde9', '#f4f9ff'], obs: 'crystal', obsPal: null, bg: '#4a6f94' },
  { name: 'Neon City',       t: 2500,  lvl: 5,  floor: ['#2b2d42', '#26283b', '#ff4fd8'], obs: 'crate',   obsPal: { a: '#3a3f5a', b: '#262a40', c: '#4ff0ff' }, bg: '#141526' },
  { name: 'Mummy Tomb',      t: 3300,  lvl: 5,  floor: ['#c2a36b', '#b59660', '#d8bd86'], obs: 'pillar',  obsPal: { a: '#b8a07a', b: '#8a7452', c: '#e0cca4' }, bg: '#4a3a22' },
  { name: 'Lava Forge',      t: 4200,  lvl: 6,  floor: ['#4a3a3a', '#403232', '#ff6a2a'], obs: 'rock',    obsPal: { a: '#5a4a48', b: '#3a2e2c', c: '#ff8a4a' }, bg: '#2a1414' },
  { name: 'Haunted Manor',   t: 5200,  lvl: 7,  floor: ['#4b3f5e', '#433756', '#6a5a82'], obs: 'pillar',  obsPal: { a: '#6a6478', b: '#4a4458', c: '#8e88a0' }, bg: '#1e1828' },
  { name: 'Robot Factory',   t: 6300,  lvl: 7,  floor: ['#6d7682', '#646c78', '#ffb02e'], obs: 'crate',   obsPal: { a: '#8a96a6', b: '#5a6474', c: '#c3ccd8' }, bg: '#2a3038' },
  { name: 'Dino Jungle',     t: 7500,  lvl: 8,  floor: ['#4f9a3e', '#46902f', '#7cc45a'], obs: 'rock',    obsPal: { a: '#8a7a5a', b: '#5e523a', c: '#b0a07a' }, bg: '#1d3a17' },
  { name: 'Moon Base',       t: 8800,  lvl: 9,  floor: ['#9aa0ad', '#8e94a1', '#c3c8d2'], obs: 'crystal', obsPal: { a: '#c9a6ff', b: '#8a5ad6', c: '#efe0ff' }, bg: '#0f1226' },
  { name: 'Crystal Caverns', t: 10200, lvl: 9,  floor: ['#3b2f5c', '#342a52', '#ff7ad8'], obs: 'crystal', obsPal: { a: '#ff9ae0', b: '#c04a9a', c: '#ffe0f5' }, bg: '#1a1330' },
  { name: 'Clockwork Tower', t: 11700, lvl: 10,  floor: ['#8a6a3a', '#7d5f33', '#ffd23f'], obs: 'pillar',  obsPal: { a: '#c9a24a', b: '#8a6a2a', c: '#f0d48a' }, bg: '#3a2a14' },
  { name: 'The Rift',        t: 13300, lvl: 11, floor: ['#1d1730', '#191428', '#b36bff'], obs: 'crystal', obsPal: { a: '#b36bff', b: '#6a2fc0', c: '#e6d0ff' }, bg: '#0a0714' },
];

// Rift Events: one per match, and the event decides the special tiles.
// Layouts describe YOUR half (rows 5-9, first string = the row touching the middle); the enemy half is a mirror image.
const EVENTS = {
  clear:   { name: 'Clear Skies',     tile: null,     color: '#9fc3d6', desc: 'No special tiles.', layouts: [] },
  lava:    { name: 'Lava Fields',     tile: 'lava',   color: '#ff6a2a', desc: 'Lava hurts heroes standing on it.',
             layouts: [['.x.x.', '..x..', '.....'], ['x...x', '.x.x.', '.....']] },
  springs: { name: 'Healing Springs', tile: 'spring', color: '#4fa3ff', desc: 'Springs heal heroes standing on them.',
             layouts: [['.....', 'x...x', '.....'], ['..x..', '.....', 'x...x']] },
  rocks:   { name: 'Rock Garden',     tile: 'rock',   color: '#a8a4b8', desc: 'Rocks block the way.',
             layouts: [['.x.x.', '.....', '..x..'], ['x...x', '.....', '.x.x.']] },
};
const EVENT_IDS = Object.keys(EVENTS);

// ===== Chests & keys =====
// Every win drops a chest onto your shelf. Opening any chest uses 1 key. Keys refill 1 every 5 hours (up to 10).
const KEY_HOURS = 5, KEY_MAX = 10, SHELF_MAX = 20;
const CHESTS = {
  hero:     { name: 'Hero Chest',     what: 'Hero trophies',                 trophies: [1, 2], coins: 0,   pal: { a: '#3a6fd8', A: '#1f3f8a', b: '#ffd23f', B: '#b37a00' } },
  resource: { name: 'Resource Chest', what: 'Coins, sometimes gems and keys', trophies: [0, 0], coins: 60,  pal: { a: '#5a9a46', A: '#2f5d2a', b: '#d9a066', B: '#8a5a32' } },
  mega:     { name: 'Mega Chest',     what: 'Lots of hero trophies, coins and gems', trophies: [4, 6], coins: 200, pal: { a: '#c0392b', A: '#7a1f1f', b: '#ffd23f', B: '#d99a00' } },
};
// Win-chest order (H hero, R resource, M mega), 20 long
const CHEST_CYCLE = 'HRHRHHRHRHRHHRHRHRHM';
const CHEST_CODE = { H: 'hero', R: 'resource', M: 'mega' };
const TROPHY_COIN = 50; // extra hero trophies for a fully unlocked hero turn into coins

const DIFFS = [
  { id: 'easy',   name: 'Easy',   lvlOff: -1, win: 6,  loss: 3,  xpWin: 15, xpLoss: 5,  coin: 0.4, color: '#5fd068' },
  { id: 'normal', name: 'Normal', lvlOff: 0,  win: 16, loss: 8,  xpWin: 30, xpLoss: 10, coin: 0.8, color: '#4fa3ff' },
  { id: 'hard',   name: 'Hard',   lvlOff: 1,  win: 28, loss: 12, xpWin: 40, xpLoss: 12, coin: 1.0, color: '#ff9f2a' },
  { id: 'expert', name: 'Expert', lvlOff: 2,  win: 40, loss: 14, xpWin: 50, xpLoss: 15, coin: 1.3, color: '#ff4f6b' },
];
const DIFF = {}; DIFFS.forEach((d, i) => { DIFF[d.id] = d; d.idx = i; });

const ARENA_EVENT = ['springs', 'springs', 'rocks', 'clear', 'rocks', 'clear', 'rocks', 'lava', 'clear', 'rocks', 'springs', 'rocks', 'clear', 'lava', null];
const ROUNDS_TO_WIN = 3, ROUND_TIME = 40, GRID_ROUND_TIME = 60;
const SEASON_TIERS = 30, SEASON_TIER_XP = 300;
const SEASON_RESET_FLOOR = 4000;
const DAILY_WIN_COIN_CAP = 10;

const RIVAL_NAMES = ['Captain Chaos', 'Lord Snorkel', 'Baron Von Byte', 'Madame Mayhem', 'The Rift Lurker', 'Professor Pickle',
  'Duke Dropkick', 'Sir Sulks-a-Lot', 'Glitch Queen', 'Count Crumble', 'The Pixel Pirate', 'Turbo Tim', 'Grumblewort',
  'Nightshade Nell', 'Admiral Anchovy', 'Rusty Rivet', 'Lady Lightning', 'The Masked Muffin', 'Boss Bramble', 'Major Meltdown'];

const QUEST_POOL_DAILY = [
  { id: 'win3',   text: 'Win 3 matches',                   stat: 'wins',    target: 3,  xp: 120, coins: 7 },
  { id: 'play5',  text: 'Play 5 matches',                  stat: 'battles', target: 5,  xp: 100, coins: 6 },
  { id: 'dmg',    text: 'Deal {n} damage',                 stat: 'dmg',     target: -1, xp: 100, coins: 6 },
  { id: 'abil',   text: 'Use 25 abilities',                 stat: 'abil',    target: 25,  xp: 100, coins: 6 },
  { id: 'kills',  text: 'Defeat 25 enemy heroes',          stat: 'kills',   target: 25,  xp: 120, coins: 7 },
  { id: 'sweep',  text: 'Win a match 3–0', stat: 'sweeps', target: 1, xp: 150, coins: 8 },
  { id: 'hard',   text: 'Win a match on Hard or Expert',           stat: 'hardWins', target: 1, xp: 150, coins: 8 },
  { id: 'chests', text: 'Open 2 chests',                   stat: 'chests',  target: 2,  xp: 100, coins: 6 },
  { id: 'flaw',   text: 'Win a round without losing a hero', stat: 'flawless', target: 1, xp: 150, coins: 8 },
  { id: 'hero',   text: 'Win 2 matches with {hero} as Captain', stat: 'heroWins', target: 2, xp: 120, coins: 7 },
];
const QUEST_POOL_WEEKLY = [
  { id: 'w_win',    text: 'Win 15 matches',            stat: 'wins',     target: 15, xp: 450, coins: 28, gems: 8 },
  { id: 'w_kills',  text: 'Defeat 120 enemy heroes',   stat: 'kills',    target: 120, xp: 450, coins: 28, gems: 8 },
  { id: 'w_abil',   text: 'Use 120 abilities',         stat: 'abil',     target: 120, xp: 400, coins: 23, gems: 6 },
  { id: 'w_syn',    text: 'Win 5 matches with a 3-hero world bonus', stat: 'synWins', target: 5, xp: 450, coins: 28, gems: 8 },
  { id: 'w_expert', text: 'Win 3 matches on Expert',   stat: 'expertWins', target: 3, xp: 500, coins: 35, gems: 10 },
  { id: 'w_up',     text: 'Unlock a hero ability',     stat: 'upgrades', target: 1,  xp: 400, coins: 70, gems: 6 },
  { id: 'w_chests', text: 'Open 10 chests',            stat: 'chests',   target: 10, xp: 400, coins: 23, gems: 6 },
];

// ===== Achievements =====
// v: what's counted (see achValue in progress.js), n: goal, r: reward
const ACHIEVEMENTS = [
  { id: 'win1',    name: 'First Victory',     icon: 'trophy',     v: 'wins',       n: 1,    desc: 'Win a match',                        r: { gems: 10 } },
  { id: 'win25',   name: 'Squad Leader',      icon: 'trophy',     v: 'wins',       n: 25,   desc: 'Win 25 matches',                     r: { gems: 20 } },
  { id: 'win100',  name: 'Veteran',           icon: 'trophy',     v: 'wins',       n: 100,  desc: 'Win 100 matches',                    r: { gems: 40 } },
  { id: 'win500',  name: 'Rift Legend',       icon: 'trophy',     v: 'wins',       n: 500,  desc: 'Win 500 matches',                    r: { gems: 100 } },
  { id: 'streak3', name: 'On a Roll',         icon: 'i_ff',       v: 'bestStreak', n: 3,    desc: 'Win 3 matches in a row',             r: { keys: 2 } },
  { id: 'streak10',name: 'Unstoppable',       icon: 'i_ff',       v: 'bestStreak', n: 10,   desc: 'Win 10 matches in a row',            r: { gems: 50 } },
  { id: 'sweep',   name: 'Clean Sweep',       icon: 'i_whirl',    v: 'sweeps',     n: 1,    desc: 'Win a match 3–0',                    r: { keys: 2 } },
  { id: 'flaw10',  name: 'Not a Scratch',     icon: 'i_shield',   v: 'flawless',   n: 10,   desc: 'Win 10 rounds without losing a hero', r: { gems: 20 } },
  { id: 'comeback',name: 'Comeback Kid',      icon: 'i_up',       v: 'comebacks',  n: 1,    desc: 'Win a match after being down 0–2',   r: { gems: 25 } },
  { id: 'solo',    name: 'Last One Standing', icon: 'i_heart',    v: 'clutch',     n: 1,    desc: 'Win a round with only 1 hero left',  r: { keys: 2 } },
  { id: 'expert',  name: 'Expert Tactician',  icon: 'i_crown',    v: 'expertWins', n: 1,    desc: 'Win a match on Expert',              r: { gems: 30 } },
  { id: 'arena3',  name: 'Pirate Waters',     icon: 'relic',      v: 'arena',      n: 4,    desc: 'Reach Arena 4: Pirate Cove',         r: { keys: 3 } },
  { id: 'arena8',  name: 'Into the Fire',     icon: 'relic',      v: 'arena',      n: 8,    desc: 'Reach Arena 8: Lava Forge',          r: { gems: 40 } },
  { id: 'arena15', name: 'The Rift',          icon: 'relic',      v: 'arena',      n: 15,   desc: 'Reach the final arena',              r: { gems: 150 } },
  { id: 'hero10',  name: 'Recruiter',         icon: 'i_htrophy',  v: 'owned',      n: 10,   desc: 'Unlock 10 heroes',                   r: { keys: 3 } },
  { id: 'hero20',  name: 'Full Squad',        icon: 'i_htrophy',  v: 'owned',      n: 20,   desc: 'Unlock all 20 heroes',               r: { gems: 100 } },
  { id: 'caps',    name: 'Captain\'s Table',  icon: 'i_crown',    v: 'captains',   n: 6,    desc: 'Unlock all 6 Captains',              r: { gems: 60 } },
  { id: 'ab1',     name: 'New Trick',         icon: 'i_up',       v: 'ab2',        n: 1,    desc: 'Unlock a hero\'s second ability',     r: { gems: 10 } },
  { id: 'ab15',    name: 'Bag of Tricks',     icon: 'i_up',       v: 'abilities',  n: 30,   desc: 'Unlock 30 hero abilities',           r: { gems: 40 } },
  { id: 'ab60',    name: 'Master of All',     icon: 'i_up',       v: 'abilities',  n: 60,   desc: 'Unlock all 60 abilities',            r: { gems: 200 } },
  { id: 'max1',    name: 'Fully Trained',     icon: 'star',       v: 'maxed',      n: 1,    desc: 'Get a hero to level 10',             r: { keys: 3 } },
  { id: 'chest25', name: 'Treasure Hunter',   icon: 'i_key',      v: 'chests',     n: 25,   desc: 'Open 25 chests',                     r: { gems: 20 } },
  { id: 'chest250',name: 'Dragon Hoard',      icon: 'i_key',      v: 'chests',     n: 250,  desc: 'Open 250 chests',                    r: { gems: 80 } },
  { id: 'kill250', name: 'Monster Hunter',    icon: 'i_skull',    v: 'kills',      n: 250,  desc: 'Defeat 250 enemy heroes',            r: { gems: 20 } },
  { id: 'kill2500',name: 'Rift Breaker',      icon: 'i_skull',    v: 'kills',      n: 2500, desc: 'Defeat 2,500 enemy heroes',          r: { gems: 80 } },
  { id: 'abil500', name: 'Showtime',          icon: 'i_buff',     v: 'abil',       n: 500,  desc: 'Use 500 abilities in battle',        r: { gems: 30 } },
  { id: 'taunt',   name: 'Look at Me!',       icon: 'i_taunt',    v: 'tauntAll',   n: 1,    desc: 'Taunt 4 or more enemies at once',    r: { keys: 2 } },
  { id: 'laser',   name: 'Lane Cleaner',      icon: 'i_laser',    v: 'laser3',     n: 1,    desc: 'Hit 3 enemies with one Laser',       r: { keys: 2 } },
];
const ACH = {}; ACHIEVEMENTS.forEach(a => ACH[a.id] = a);

if (typeof module !== 'undefined') module.exports = { RARITIES, ROLES, ABILITIES, HERO_ABILITIES, ABILITY_TROPHIES, ABILITY_COINS, HERO_ROAD, HERO_MAX, WILD_CHANCE, WORLD_BONUS, WORLDS, HEROES, HERO, START_HEROES, SQUAD_SIZE, ARENAS, EVENTS, EVENT_IDS, CHESTS, CHEST_CYCLE, CHEST_CODE, KEY_HOURS, KEY_MAX, SHELF_MAX, DIFFS, DIFF, SEASON_TIERS, SEASON_TIER_XP, SEASON_RESET_FLOOR, DAILY_WIN_COIN_CAP, RIVAL_NAMES, QUEST_POOL_DAILY, QUEST_POOL_WEEKLY, TARGETING, heroTarget, ACHIEVEMENTS, ACH };
