// Shared by server (validation) and client (simulation + rendering). Pure functions, no I/O.

export const TILE = 32;
export const PLAYER_W = 22;
export const PLAYER_H = 28;

// Movement tuning. Values are px/s and px/s^2. Everything that makes the jump feel good lives here.
export const PHYS = {
  maxRun: 250,
  accelGround: 2600,
  decelGround: 3400,
  turnGround: 5200,      // reversing direction on the ground is faster than starting from rest
  accelAir: 1800,
  decelAir: 1000,
  gravity: 2100,
  jumpSpeed: 700,
  jumpCutGravity: 2.6,   // releasing jump early cuts the jump short (variable height)
  apexThreshold: 90,     // |vy| below this while holding jump = floaty apex
  apexGravity: 0.5,
  fallGravity: 1.35,     // fall faster than rise, so jumps feel snappy not floaty
  maxFall: 980,
  coyote: 0.1,           // can still jump this long after walking off a ledge
  buffer: 0.13,          // jump pressed this long before landing still counts
  bounceSpeed: 1200,
  cornerNudge: 10,       // head bumps that clip a corner by this much get nudged around it
};

// Tile types
export const T_EMPTY = 0, T_SOLID = 1, T_ONEWAY = 2, T_BOUNCE = 3;

export const COLS = 280;
export const ROWS = 23;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
export const BASE_ROW = 19; // default ground surface row

export const CHARACTERS = [
  { id: 'fox',   name: 'Kiko',  kind: 'Zorro',  body: '#F5883A', belly: '#FFE6CC', dark: '#B9561A', cheek: '#FF9E8A' },
  { id: 'frog',  name: 'Rita',  kind: 'Rana',   body: '#5CC75A', belly: '#D9F7C8', dark: '#2F8A3A', cheek: '#FF9EAE' },
  { id: 'cat',   name: 'Mishi', kind: 'Gato',   body: '#9C82FF', belly: '#EEE8FF', dark: '#6049C9', cheek: '#FFA6C9' },
  { id: 'bunny', name: 'Lola',  kind: 'Coneja', body: '#FF8DBA', belly: '#FFE8F1', dark: '#C8487F', cheek: '#FF6F9C' },
  { id: 'dino',  name: 'Dino',  kind: 'Dino',   body: '#33C4A9', belly: '#D6FFF3', dark: '#16806C', cheek: '#FF9E8A' },
  { id: 'robot', name: 'Bip',   kind: 'Robot',  body: '#58B8F2', belly: '#DDF2FF', dark: '#2A76B5', cheek: '#FF9EAE' },
];
export const CHAR_IDS = CHARACTERS.map((c) => c.id);

// the last two are full-body actions (see ACTS in public/rig.js)
export const EMOTES = ['👋', '❤️', '⭐', '😂', '🕺', '💀'];

// ---------------------------------------------------------------- world

const grid = new Uint8Array(COLS * ROWS);
export const groundTop = new Array(COLS).fill(null); // surface row per column, null = pit

function set(c, r, v) { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r * COLS + c] = v; }
function ground(c0, c1, top) {
  for (let c = c0; c <= c1; c++) {
    groundTop[c] = top;
    for (let r = top; r < ROWS; r++) set(c, r, T_SOLID);
  }
}
function plank(c0, c1, r) { for (let c = c0; c <= c1; c++) set(c, r, T_ONEWAY); }
function block(c0, c1, r0, r1) { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) set(c, r, T_SOLID); }
function bounce(c) { set(c, groundTop[c], T_BOUNCE); }

const B = BASE_ROW;
// Home meadow
ground(0, 26, B);
ground(27, 29, B - 1);
ground(30, 33, B - 2);
ground(34, 39, B);
plank(29, 33, B - 5);
// first pit (3 wide), then a bounce pad up to a secret ledge
ground(43, 58, B);
bounce(50);
plank(46, 54, B - 9);
// Plaza
ground(59, 84, B);
plank(62, 65, B - 3);
// rolling hills with floating islands
ground(85, 87, B - 1);
ground(88, 90, B - 2);
ground(91, 93, B - 3);
ground(94, 96, B - 2);
block(89, 92, B - 6, B - 6);
ground(97, 98, B);
// gap with a stepping plank
plank(100, 101, B - 2);
ground(104, 128, B);
// Quest board area, then a platforming run
plank(132, 134, B - 3);
plank(137, 139, B - 5);
plank(142, 144, B - 3);
ground(129, 130, B);
ground(147, 150, B);
// Library plateau
ground(151, 152, B - 1);
ground(153, 176, B - 2);
plank(158, 161, B - 5);
ground(177, 178, B - 1);
// Forest with small gaps and a bounce pad
ground(179, 186, B);
ground(189, 196, B);
ground(199, 210, B);
bounce(193);
plank(190, 196, B - 8);
// Challenge tower: climb the zig-zag or take the bounce pad
bounce(205);
plank(207, 211, B - 3);
plank(202, 206, B - 6);
plank(207, 211, B - 9);
ground(212, 222, B - 11); // tower top (solid column all the way down)
ground(223, 230, B);
plank(223, 226, B - 5);
// Far meadow and the edge of the known world
ground(231, 240, B);
ground(241, 243, B - 1);
ground(244, 262, B - 2);
ground(263, COLS - 1, B);

export function tileAt(c, r) {
  if (c < 0 || c >= COLS) return T_SOLID; // world side walls
  if (r < 0 || r >= ROWS) return T_EMPTY;
  return grid[r * COLS + c];
}

// Points of interest. col = centre column, row = surface row they stand on.
export const POIS = [
  { id: 'home',    name: 'Mi Casa',          icon: '🏠', col: 13,  w: 6, color: '#CA4B15' },
  { id: 'plaza',   name: 'Plaza Central',    icon: '🎪', col: 71,  w: 8, color: '#7B5CFF' },
  { id: 'arcade',  name: 'Sala de Juegos',   icon: '🎮', col: 81,  w: 5, color: '#13A889' },
  { id: 'quests',  name: 'Tablón de Misiones', icon: '📜', col: 116, w: 5, color: '#F2A516' },
  { id: 'library', name: 'Biblioteca',       icon: '📚', col: 167, w: 7, color: '#2A8BD8' },
  { id: 'arena',   name: 'Torre de Retos',   icon: '🏆', col: 217, w: 7, color: '#E0364F' },
].map((p) => ({ ...p, row: groundTop[p.col], x: p.col * TILE + TILE / 2, y: groundTop[p.col] * TILE }));

// Collectible stars: [col, rowAboveSurface]. Placed on the fun routes.
const STAR_SPOTS = [
  [20, 1], [24, 2], [30, B - 6], [31, B - 7], [32, B - 6], [41, 4], [47, B - 10], [50, B - 11], [53, B - 10],
  [63, B - 4], [64, B - 4], [57, 3], [90, B - 7], [91, B - 7], [99, 5], [100, B - 3], [102, 5],
  [120, 1], [125, 2], [133, B - 4], [138, B - 6], [143, B - 4], [146, 3], [159, B - 6], [160, B - 6],
  [172, 1], [188, 4], [192, B - 9], [194, B - 9], [197, 4], [205, B - 3], [209, B - 10], [204, B - 7],
  [226, B - 6], [236, 1], [250, 1], [256, 2], [270, 1],
];
export const STARS = STAR_SPOTS.map(([c, r], i) => {
  const row = r < 8 ? (groundTop[c] ?? B) - r : r; // small numbers are "tiles above ground"
  return { id: i, x: c * TILE + TILE / 2, y: row * TILE + TILE / 2 };
});

export const SPAWN = { x: 8 * TILE, y: (B - 1) * TILE };

export function spawnPoint(i = 0) {
  return { x: SPAWN.x + (i % 4) * 12, y: SPAWN.y };
}

// ---------------------------------------------------------------- physics

export function newBody(x, y) {
  return { x, y, vx: 0, vy: 0, onGround: false, groundType: 0, coyote: 0, buffer: 0, drop: 0, jumping: false, prevJump: false, prevDown: false };
}

function approach(v, target, delta) {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}

// A "map" is anything with tileAt(c, r). The world is the default; minigame arenas bring their own.
export const WORLD_MAP = { tileAt };

function hitsSolid(map, x, y) {
  const tileAt = map.tileAt;
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + PLAYER_W - 0.001) / TILE);
  const r0 = Math.floor(y / TILE), r1 = Math.floor((y + PLAYER_H - 0.001) / TILE);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const t = tileAt(c, r);
      if (t === T_SOLID || t === T_BOUNCE) return true;
    }
  return false;
}

// First floor crossed when the feet move from prevBottom down to newBottom.
function findFloor(map, x, prevBottom, newBottom, dropping) {
  const tileAt = map.tileAt;
  const c0 = Math.floor(x / TILE), c1 = Math.floor((x + PLAYER_W - 0.001) / TILE);
  const rStart = Math.ceil((prevBottom - 0.01) / TILE), rEnd = Math.floor(newBottom / TILE);
  for (let r = rStart; r <= rEnd; r++) {
    let best = 0;
    for (let c = c0; c <= c1; c++) {
      const t = tileAt(c, r);
      if (t === T_SOLID) best = T_SOLID;
      else if (t === T_BOUNCE && best !== T_SOLID) best = T_BOUNCE;
      else if (t === T_ONEWAY && !dropping && !best) best = T_ONEWAY;
    }
    if (best) return { y: r * TILE, type: best };
  }
  return null;
}

// Advance one body by dt with input {left,right,jump,down}. Returns events for juice:
// {jump, land: impactSpeed, bounce, bump, turn}
export function stepPlayer(p, input, dt, map = WORLD_MAP) {
  const ev = {};
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  // Horizontal: accelerate toward target speed, faster when reversing.
  let a;
  if (p.onGround) {
    if (dir === 0) a = PHYS.decelGround;
    else if (p.vx !== 0 && Math.sign(p.vx) !== dir) { a = PHYS.turnGround; if (Math.abs(p.vx) > 150) ev.turn = true; }
    else a = PHYS.accelGround;
  } else a = dir === 0 ? PHYS.decelAir : PHYS.accelAir;
  p.vx = approach(p.vx, dir * PHYS.maxRun, a * dt);

  // Jump buffer + coyote time.
  const jumpPressed = input.jump && !p.prevJump;
  const downPressed = input.down && !p.prevDown;
  p.prevJump = !!input.jump; p.prevDown = !!input.down;
  p.buffer = jumpPressed ? PHYS.buffer : Math.max(0, p.buffer - dt);
  p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - dt);
  p.drop = Math.max(0, p.drop - dt);

  if (downPressed && p.onGround && p.groundType === T_ONEWAY) {
    p.drop = 0.22; p.onGround = false; p.coyote = 0; p.y += 2;
  }
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -PHYS.jumpSpeed; p.buffer = 0; p.coyote = 0; p.onGround = false; p.jumping = true; ev.jump = true;
  }

  let g = PHYS.gravity;
  if (p.vy < 0 && p.jumping && !input.jump) g *= PHYS.jumpCutGravity;
  else if (Math.abs(p.vy) < PHYS.apexThreshold && input.jump) g *= PHYS.apexGravity;
  else if (p.vy > 0) g *= PHYS.fallGravity;
  p.vy = Math.min(p.vy + g * dt, PHYS.maxFall);
  if (p.vy >= 0) p.jumping = false;

  // X axis.
  let nx = p.x + p.vx * dt;
  if (hitsSolid(map, nx, p.y)) {
    nx = p.vx > 0 ? Math.floor((nx + PLAYER_W) / TILE) * TILE - PLAYER_W : (Math.floor(nx / TILE) + 1) * TILE;
    p.vx = 0;
  }
  p.x = nx;

  // Y axis.
  const wasGround = p.onGround;
  const prevBottom = p.y + PLAYER_H;
  let ny = p.y + p.vy * dt;
  p.onGround = false;
  if (p.vy >= 0) {
    const floor = findFloor(map, p.x, prevBottom, ny + PLAYER_H, p.drop > 0);
    if (floor) {
      ny = floor.y - PLAYER_H;
      if (!wasGround) ev.land = p.vy;
      if (floor.type === T_BOUNCE) {
        p.vy = -PHYS.bounceSpeed; p.jumping = false; ev.bounce = true; ev.land = 0;
      } else {
        p.vy = 0; p.onGround = true; p.groundType = floor.type;
      }
    }
  } else if (hitsSolid(map, p.x, ny)) {
    let nudged = false;
    for (let s = 1; s <= PHYS.cornerNudge && !nudged; s++) {
      for (const d of [s, -s]) {
        if (!hitsSolid(map, p.x + d, ny)) { p.x += d; nudged = true; break; }
      }
    }
    if (!nudged) {
      ny = (Math.floor(ny / TILE) + 1) * TILE;
      p.vy = 0; p.jumping = false; ev.bump = true;
    }
  }
  p.y = ny;
  return ev;
}

// True if a body at (x,y) is standing on something: used to validate respawn teleports.
export function isStandable(x, y, map = WORLD_MAP) {
  if (hitsSolid(map, x, y)) return false;
  return !!findFloor(map, x, y + PLAYER_H, y + PLAYER_H + 1, false);
}

export function sanitizeName(raw) {
  const s = String(raw ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 12);
  return s || 'Jugador';
}
