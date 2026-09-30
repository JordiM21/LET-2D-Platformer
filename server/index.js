import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { stepPlayer, spawnPoint, sanitizeName, LEVEL_H } from '../shared/game.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 3000;
const TICK_HZ = 60;   // simulation rate
const SEND_HZ = 30;   // snapshot rate
const MAX_PLAYERS = 16;
const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45'];

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

function respawn(p) {
  const s = spawnPoint(spawnIdx++);
  Object.assign(p, { x: s.x, y: s.y, vx: 0, vy: 0, onGround: false });
}

wss.on('connection', (ws) => {
  let player = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.t === 'join' && !player) {
      if (players.size >= MAX_PLAYERS) { ws.close(1013, 'full'); return; }
      const id = nextId++;
      player = {
        id,
        name: sanitizeName(msg.name),
        color: COLORS[id % COLORS.length],
        input: { left: false, right: false, jump: false },
      };
      respawn(player);
      players.set(id, player);
      ws.send(JSON.stringify({ t: 'welcome', id }));
    } else if (msg.t === 'input' && player) {
      player.input = { left: !!msg.left, right: !!msg.right, jump: !!msg.jump };
    }
  });

  ws.on('close', () => { if (player) players.delete(player.id); });
  ws.on('error', () => ws.terminate());
});

setInterval(() => {
  for (const p of players.values()) {
    stepPlayer(p, 1 / TICK_HZ);
    if (p.y > LEVEL_H + 200) respawn(p);
  }
}, 1000 / TICK_HZ);

setInterval(() => {
  if (!players.size) return;
  const msg = JSON.stringify({
    t: 'state',
    p: [...players.values()].map(({ id, name, color, x, y, vx }) => ({
      id, name, color, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, f: vx < 0 ? -1 : vx > 0 ? 1 : 0,
    })),
  });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(msg);
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
