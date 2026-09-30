import { LEVEL, TILE, PLAYER_W, PLAYER_H, LEVEL_W, LEVEL_H } from '/shared/game.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const nameInput = document.getElementById('name');
const statusEl = document.getElementById('status');

let ws, myId = null;
const remote = new Map(); // id -> {name,color,f, x,y (rendered), tx,ty (target)}
const input = { left: false, right: false, jump: false };
let lastSent = '';

// Keyboard (both e.code and arrows/WASD so layout doesn't matter much)
const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['ArrowUp', 'KeyW', 'Space'],
};
const down = new Set();
function recompute() {
  for (const [action, codes] of Object.entries(KEYS)) input[action] = codes.some((c) => down.has(c));
  const s = JSON.stringify(input);
  if (s !== lastSent && ws?.readyState === 1) {
    ws.send(JSON.stringify({ t: 'input', ...input }));
    lastSent = s;
  }
}
addEventListener('keydown', (e) => {
  if (document.activeElement === nameInput) return;
  if (Object.values(KEYS).flat().includes(e.code)) e.preventDefault();
  down.add(e.code); recompute();
});
addEventListener('keyup', (e) => { down.delete(e.code); recompute(); });
addEventListener('blur', () => { down.clear(); recompute(); });

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: nameInput.value }));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'welcome') myId = m.id;
    else if (m.t === 'state') applyState(m.p);
  };
  ws.onclose = () => {
    statusEl.textContent = 'Desconectado. Recarga la página.';
    remote.clear();
  };
}

function applyState(list) {
  const seen = new Set();
  for (const p of list) {
    seen.add(p.id);
    let r = remote.get(p.id);
    if (!r) { r = { x: p.x, y: p.y }; remote.set(p.id, r); }
    Object.assign(r, { name: p.name, color: p.color, f: p.f || r.f || 1, tx: p.x, ty: p.y });
  }
  for (const id of remote.keys()) if (!seen.has(id)) remote.delete(id);
}

document.getElementById('play').onclick = start;
nameInput.onkeydown = (e) => { if (e.key === 'Enter') start(); };
function start() {
  menu.style.display = 'none';
  canvas.style.display = 'block';
  nameInput.blur();
  connect();
  requestAnimationFrame(frame);
}

// Procedural "assets": no image files needed yet.
function drawTile(x, y) {
  ctx.fillStyle = '#7a4b1e'; ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#3fae49'; ctx.fillRect(x, y, TILE, 6);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.strokeRect(x + .5, y + .5, TILE - 1, TILE - 1);
}
function drawPlayer(r, isMe) {
  const { x, y, color, f = 1, name } = r;
  ctx.fillStyle = color; ctx.fillRect(x, y, PLAYER_W, PLAYER_H);
  ctx.fillStyle = '#fff';
  const ex = f >= 0 ? x + 14 : x + 4;
  ctx.fillRect(ex, y + 6, 6, 6);
  ctx.fillStyle = '#000'; ctx.fillRect(ex + (f >= 0 ? 3 : 0), y + 8, 3, 3);
  if (isMe) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, PLAYER_W, PLAYER_H); }
  ctx.font = '12px system-ui'; ctx.textAlign = 'center';
  ctx.fillStyle = '#000'; ctx.fillText(name, x + PLAYER_W / 2 + 1, y - 5);
  ctx.fillStyle = '#fff'; ctx.fillText(name, x + PLAYER_W / 2, y - 6);
}

function frame() {
  // Smooth toward the latest server position (simple interpolation, no prediction).
  for (const r of remote.values()) {
    r.x += (r.tx - r.x) * 0.35;
    r.y += (r.ty - r.y) * 0.35;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(Math.round((canvas.width - LEVEL_W) / 2), Math.round((canvas.height - LEVEL_H) / 2));
  LEVEL.forEach((row, ty) => [...row].forEach((c, tx) => { if (c === '#') drawTile(tx * TILE, ty * TILE); }));
  for (const [id, r] of remote) drawPlayer(r, id === myId);
  ctx.restore();
  statusEl.textContent = ws?.readyState === 1 ? `Jugadores: ${remote.size}` : statusEl.textContent;
  requestAnimationFrame(frame);
}
