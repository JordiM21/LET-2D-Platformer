import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { spawnPoint, sanitizeName, isStandable, CHAR_IDS, EMOTES, WORLD_W, WORLD_H, PHYS } from '../shared/game.js';
import { PartyManager } from './party.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 3000;
const SEND_HZ = 20;
const MAX_PLAYERS = 16;
// No accounts yet: whoever knows this PIN joins as the teacher and can open minigame parties.
const TEACHER_PIN = String(process.env.TEACHER_PIN || '1234');
// Fastest legit movement: run + bounce. Anything faster than this (plus slack for jitter) is rejected.
const MAX_SPEED = Math.hypot(PHYS.maxRun, PHYS.bounceSpeed) * 1.25;

// Movement is simulated on each client (instant response, no input lag) and the server
// relays it after sanity checks. Fine for a friendly kids' world; revisit if it ever gets competitive.

const app = express();
app.get('/healthz', (req, res) => res.send('ok'));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use('/vendor', express.static(path.join(ROOT, 'node_modules/phaser/dist')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 });

const players = new Map(); // id -> player
let nextId = 1;
let spawnIdx = 0;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const broadcast = (obj, except) => {
  const s = JSON.stringify(obj);
  for (const ws of wss.clients) if (ws.readyState === 1 && ws !== except) ws.send(s);
};
const sockets = new Map(); // player id -> ws
const party = new PartyManager({
  players,
  send: (id, obj) => { const ws = sockets.get(id); if (ws?.readyState === 1) ws.send(JSON.stringify(obj)); },
  broadcast: (obj) => broadcast(obj),
});

wss.on('connection', (ws) => {
  let player = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    const now = Date.now();

    if (msg.t === 'join' && !player) {
      if (players.size >= MAX_PLAYERS) { ws.close(1013, 'full'); return; }
      const s = spawnPoint(spawnIdx++);
      player = {
        id: nextId++,
        name: sanitizeName(msg.name),
        char: CHAR_IDS.includes(msg.char) ? msg.char : CHAR_IDS[0],
        role: msg.pin != null && String(msg.pin) === TEACHER_PIN ? 'teacher' : 'student',
        x: s.x, y: s.y, vx: 0, vy: 0, g: 0, f: 1,
        at: now, lastEmote: 0, fresh: true, // first position after (re)joining is trusted
      };
      players.set(player.id, player);
      sockets.set(player.id, ws);
      ws.send(JSON.stringify({ t: 'welcome', id: player.id, x: s.x, y: s.y, role: player.role, party: party.snapshot() }));
      broadcast({ t: 'joined', id: player.id, name: player.name, char: player.char }, ws);
      return;
    }
    if (!player) return;

    if (msg.t?.startsWith('party-') || msg.t === 'g') { party.onMessage(player, msg); return; }

    if (msg.t === 's') {
      const x = num(msg.x), y = num(msg.y);
      if (x === null || y === null) return;
      if (x < -64 || x > WORLD_W + 64 || y < -WORLD_H || y > WORLD_H + 400) return;
      const dt = Math.max(0.05, (now - player.at) / 1000);
      const dist = Math.hypot(x - player.x, y - player.y);
      const teleportOk = msg.tp && isStandable(x, y);
      if (dist > MAX_SPEED * dt + 48 && !teleportOk && !player.fresh) {
        ws.send(JSON.stringify({ t: 'pos', x: player.x, y: player.y })); // snap back
        return;
      }
      player.fresh = false;
      Object.assign(player, {
        x, y,
        vx: Math.max(-2000, Math.min(2000, num(msg.vx) ?? 0)),
        vy: Math.max(-2000, Math.min(2000, num(msg.vy) ?? 0)),
        g: msg.g ? 1 : 0,
        f: msg.f < 0 ? -1 : 1,
        at: now,
      });
    } else if (msg.t === 'emote') {
      if (now - player.lastEmote < 600) return;
      const e = msg.e | 0;
      if (e < 0 || e >= EMOTES.length) return;
      player.lastEmote = now;
      broadcast({ t: 'emote', id: player.id, e });
    } else if (msg.t === 'char') {
      if (!CHAR_IDS.includes(msg.char)) return;
      player.char = msg.char;
    }
  });

  ws.on('close', () => {
    if (!player) return;
    party.leave(player.id);
    players.delete(player.id);
    sockets.delete(player.id);
    broadcast({ t: 'left', id: player.id, name: player.name });
  });
  ws.on('error', () => ws.terminate());
});

const r1 = (v) => Math.round(v * 10) / 10;
setInterval(() => {
  if (!players.size) return;
  broadcast({
    t: 'state',
    // players inside a minigame are hidden from the world until they come back
    p: [...players.values()].filter((p) => !party.inGame(p.id)).map(({ id, name, char, role, x, y, vx, vy, g, f }) => ({
      id, n: name, c: char, r: role === 'teacher' ? 1 : 0, x: r1(x), y: r1(y), vx: Math.round(vx), vy: Math.round(vy), g, f,
    })),
  });
}, 1000 / SEND_HZ);

// Heartbeat: keeps idle connections open through Render's proxy and drops dead ones.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`LET platformer on http://localhost:${PORT}`));
