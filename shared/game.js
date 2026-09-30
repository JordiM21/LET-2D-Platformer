// Shared by server (authoritative) and client (rendering). Pure functions, no I/O.

export const TILE = 32;
export const PLAYER_W = 24;
export const PLAYER_H = 30;

export const PHYS = {
  gravity: 1800,
  moveSpeed: 220,
  jumpSpeed: 620,
  maxFall: 900,
};

// '#' solid, '.' empty, 'S' spawn marker (treated as empty)
export const LEVEL = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '.........#####................',
  '..............................',
  '...####............####.......',
  '..............................',
  '.S..........####..............',
  '..............................',
  '..........#.......#...........',
  '##############..##############',
];

export const LEVEL_W = LEVEL[0].length * TILE;
export const LEVEL_H = LEVEL.length * TILE;

const spawns = [];
LEVEL.forEach((row, y) => [...row].forEach((c, x) => {
  if (c === 'S') spawns.push({ x: x * TILE + 4, y: y * TILE });
}));
if (!spawns.length) spawns.push({ x: 64, y: 64 });

export function spawnPoint(i = 0) {
  return spawns[i % spawns.length];
}

export function isSolid(tx, ty) {
  if (tx < 0 || tx >= LEVEL[0].length) return true; // side walls
  if (ty < 0) return false;
  if (ty >= LEVEL.length) return false;
  return LEVEL[ty][tx] === '#';
}

function overlapsSolid(x, y) {
  const x0 = Math.floor(x / TILE);
  const x1 = Math.floor((x + PLAYER_W - 0.001) / TILE);
  const y0 = Math.floor(y / TILE);
  const y1 = Math.floor((y + PLAYER_H - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (isSolid(tx, ty)) return true;
  return false;
}

// Advance one player by dt seconds. p: {x,y,vx,vy,onGround,input:{left,right,jump}}
export function stepPlayer(p, dt) {
  const { left, right, jump } = p.input;
  p.vx = ((right ? 1 : 0) - (left ? 1 : 0)) * PHYS.moveSpeed;

  if (jump && p.onGround) {
    p.vy = -PHYS.jumpSpeed;
    p.onGround = false;
  }
  p.vy = Math.min(p.vy + PHYS.gravity * dt, PHYS.maxFall);

  // Axis-separated resolution: X then Y. Steps are small enough (<TILE) to avoid tunnelling.
  let nx = p.x + p.vx * dt;
  if (overlapsSolid(nx, p.y)) {
    nx = p.vx > 0
      ? Math.floor((nx + PLAYER_W) / TILE) * TILE - PLAYER_W
      : (Math.floor(nx / TILE) + 1) * TILE;
  }
  p.x = nx;

  let ny = p.y + p.vy * dt;
  p.onGround = false;
  if (overlapsSolid(p.x, ny)) {
    if (p.vy > 0) {
      ny = Math.floor((ny + PLAYER_H) / TILE) * TILE - PLAYER_H;
      p.onGround = true;
    } else {
      ny = (Math.floor(ny / TILE) + 1) * TILE;
    }
    p.vy = 0;
  }
  p.y = ny;
}

export function sanitizeName(raw) {
  const s = String(raw ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 12);
  return s || 'Player';
}
