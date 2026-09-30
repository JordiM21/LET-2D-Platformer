// Minigame definitions shared by server (simulation) and client (rendering).
import { TILE, T_EMPTY, T_SOLID, T_ONEWAY, T_BOUNCE } from './game.js';

export const GAMES = {
  stars: {
    name: 'Lluvia de Estrellas', icon: '🌟', mode: 'Todos contra todos', color: '#7B5CFF', secs: 75,
    blurb: 'Atrapa las estrellas que caen del cielo. ¡Salta sobre la cabeza de los demás para robarles estrellas!',
    how: ['⬅️➡️ moverte', '⤒ saltar', '🌟 = 1 · 💫 = 5', '🦶 pisa cabezas'],
  },
  catapult: {
    name: 'Catapulta', icon: '🏰', mode: 'Equipos', color: '#E0364F', secs: 150,
    blurb: '¡Lánzate con el tirachinas y derriba las coronas del otro equipo antes de que ellos tiren las vuestras!',
    how: ['👆 arrastra hacia atrás', '🎯 suelta para lanzar', '👑 tira sus coronas', '🛡️ protege las tuyas'],
  },
  defense: {
    name: 'Defensa del Castillo', icon: '🛡️', mode: 'Cooperativo', color: '#13A889', secs: 0,
    blurb: 'Los slimes quieren entrar al castillo. Cada uno tiene su torre: mejórala con monedas y toca a los slimes para frenarlos.',
    how: ['🗼 tu torre dispara sola', '👆 toca slimes', '🪙 mejora tu torre', '❤️ ¡que no lleguen!'],
  },
  potato: {
    name: 'Papa Caliente', icon: '💣', mode: 'Todos contra todos', color: '#F28C1B', secs: 0,
    blurb: '¡Alguien tiene la bomba! Tócale a otro para pasársela antes de que explote. El último que quede, gana.',
    how: ['⬅️➡️ moverte', '⤒ saltar', '💣 toca a alguien', '🏃 ¡huye de la bomba!'],
  },
};
export const GAME_IDS = Object.keys(GAMES);
export const LOBBY_SECS = [20, 30, 60];

// ------------------------------------------------------------ platform arena (stars, potato)
// '#' solid, '=' one-way plank, 'B' bounce pad
const ARENA_ROWS = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..........==========..........',
  '..............................',
  '..............................',
  '.========............========.',
  '..............................',
  '..............................',
  '..........==========..........',
  '..............................',
  '..............................',
  '=====.......======.......=====',
  '..............................',
  '..............................',
  '#B##########################B#',
];
export const ARENA_COLS = ARENA_ROWS[0].length;
export const ARENA_ROWS_N = ARENA_ROWS.length;
export const ARENA_W = ARENA_COLS * TILE;
export const ARENA_H = ARENA_ROWS_N * TILE;
const CODE = { '#': T_SOLID, '=': T_ONEWAY, B: T_BOUNCE };
const arenaGrid = ARENA_ROWS.map((row) => [...row].map((ch) => CODE[ch] || T_EMPTY));

export const ARENA_MAP = {
  cols: ARENA_COLS, rows: ARENA_ROWS_N,
  tileAt(c, r) {
    if (c < 0 || c >= ARENA_COLS) return T_SOLID;
    if (r < 0 || r >= ARENA_ROWS_N) return T_EMPTY;
    return arenaGrid[r][c];
  },
};
export function arenaSpawn(i, n) {
  const x = TILE * 3 + ((i + 0.5) / Math.max(1, n)) * (ARENA_W - TILE * 6);
  return { x: Math.round(x - 11), y: (ARENA_ROWS_N - 1) * TILE - 28 };
}
// y of the first surface at or below y in the column under x
export function arenaFloorBelow(x, y) {
  const c = Math.max(0, Math.min(ARENA_COLS - 1, Math.floor(x / TILE)));
  for (let r = Math.max(0, Math.floor(y / TILE)); r < ARENA_ROWS_N; r++) if (ARENA_MAP.tileAt(c, r)) return r * TILE;
  return ARENA_H;
}

// Star motion: deterministic from spawn params so server and clients agree without streaming positions.
// s = {x, y, kind: 'fall'|'drop', vx, ph, landY}; t = seconds since spawn
export const STAR_R = 12;
export const STAR_LIFE_LANDED = 6;
export function starPos(s, t) {
  let x, y;
  if (s.kind === 'drop') {
    x = s.x + (s.vx * (1 - Math.exp(-3 * t))) / 3;
    const t1 = (90 + 360) / 900;
    y = t < t1 ? s.y - 360 * t + 450 * t * t : s.y - 360 * t1 + 450 * t1 * t1 + 90 * (t - t1);
    if (t < t1) return { x, y, landed: false };
  } else {
    x = s.x + Math.sin(t * 1.6 + s.ph) * 14;
    y = s.y + (s.big ? 55 : 75) * t;
  }
  if (y >= s.landY - STAR_R) return { x, y: s.landY - STAR_R, landed: true };
  return { x, y, landed: false };
}
export function starLandTime(s) {
  // time until landed (numeric search is fine: called once per star)
  for (let t = 0; t < 20; t += 0.02) if (starPos(s, t).landed) return t;
  return 20;
}

// ------------------------------------------------------------ catapult
export const CAT = {
  W: 1600, H: 900, GROUND: 820,
  SLING: [{ x: 330, y: 690 }, { x: 1270, y: 690 }], // team 0 left, team 1 right
  MAX_PULL: 110, MAX_SPEED: 17, // px per physics step (60 Hz)
  GRAVITY_STEP: 0.2777, // px/step^2 with matter default gravity
  COOLDOWN: 2.4, BALL_R: 17,
  TEAMS: [{ name: 'Rojo', color: '#E0364F' }, { name: 'Azul', color: '#2A8BD8' }],
};

// Castle layout for the left team; mirrored for the right. [kind, x, y(bottom), w, h]
export const CASTLE = [
  ['stone', 40, CAT.GROUND, 40, 40],
  ['stone', 40, CAT.GROUND - 40, 40, 40],
  ['wood', 90, CAT.GROUND, 18, 96],
  ['wood', 196, CAT.GROUND, 18, 96],
  ['crown', 143, CAT.GROUND, 34, 28],
  ['plank', 143, CAT.GROUND - 96, 150, 16],
  ['wood', 100, CAT.GROUND - 112, 16, 80],
  ['wood', 186, CAT.GROUND - 112, 16, 80],
  ['plank', 143, CAT.GROUND - 192, 124, 16],
  ['crown', 143, CAT.GROUND - 208, 34, 28],
  ['stone', 248, CAT.GROUND, 36, 36],
  ['wood', 248, CAT.GROUND - 36, 16, 60],
  ['crown', 248, CAT.GROUND - 96, 34, 28],
];

// Central hill that forces an arc: polygon points (convex)
export const HILL = [[640, CAT.GROUND], [720, 720], [800, 690], [880, 720], [960, CAT.GROUND]];

// ------------------------------------------------------------ defense
export const DEF = {
  W: 1280, H: 720,
  PATH: [[-40, 150], [260, 150], [260, 470], [620, 470], [620, 190], [960, 190], [960, 560], [1150, 560]],
  CASTLE: { x: 1185, y: 540 },
  LIVES: 20, WAVES: 5,
  ENEMY: {
    slime: { hp: 8, speed: 72, r: 16, lives: 1, coin: 1, color: '#5CC75A' },
    fast: { hp: 5, speed: 128, r: 13, lives: 1, coin: 1, color: '#FFC83D' },
    big: { hp: 28, speed: 46, r: 24, lives: 3, coin: 3, color: '#9C82FF' },
    boss: { hp: 220, speed: 32, r: 38, lives: 10, coin: 15, color: '#E0364F' },
  },
  TOWER: {
    dmg: [1, 2, 3, 4, 6], rate: [1.0, 1.3, 1.7, 2.1, 2.6], range: [150, 170, 190, 215, 245],
    cost: [0, 6, 12, 22, 36],
  },
  TAP_DMG: 1, TAP_COOLDOWN: 0.18,
  SLOTS: [
    [150, 250], [350, 80], [360, 300], [170, 400], [440, 380], [520, 560], [720, 330], [520, 250],
    [760, 110], [850, 290], [1060, 300], [860, 420], [1060, 470], [860, 640], [1060, 650], [400, 640],
  ],
};

// Path helpers (cumulative distances)
const segs = [];
let total = 0;
for (let i = 1; i < DEF.PATH.length; i++) {
  const [x0, y0] = DEF.PATH[i - 1], [x1, y1] = DEF.PATH[i];
  const len = Math.hypot(x1 - x0, y1 - y0);
  segs.push({ x0, y0, x1, y1, len, start: total });
  total += len;
}
export const PATH_LEN = total;
export function pathPoint(d) {
  d = Math.max(0, Math.min(PATH_LEN, d));
  for (const s of segs) {
    if (d <= s.start + s.len) {
      const k = (d - s.start) / s.len;
      return { x: s.x0 + (s.x1 - s.x0) * k, y: s.y0 + (s.y1 - s.y0) * k, dx: Math.sign(s.x1 - s.x0) };
    }
  }
  const l = segs[segs.length - 1];
  return { x: l.x1, y: l.y1, dx: 1 };
}

// Wave composition, scaled by player count
export function waveList(wave, players) {
  const n = 6 + wave * 3 + Math.min(players, 8);
  const list = [];
  for (let i = 0; i < n; i++) {
    let type = 'slime';
    if (wave >= 2 && i % 4 === 3) type = 'fast';
    if (wave >= 3 && i % 7 === 6) type = 'big';
    list.push(type);
  }
  if (wave === DEF.WAVES) list.push('boss');
  return list;
}
export const hpScale = (players) => 1 + 0.18 * Math.max(0, players - 1);
