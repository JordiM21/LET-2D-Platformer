// Starts nothing itself: run `npm start` first, then `npm test`.
import { WebSocket } from 'ws';
import { stepPlayer, spawnPoint } from '../shared/game.js';

// 1) physics: player dropped from spawn must land and stay on solid ground
const s = spawnPoint();
const p = { x: s.x, y: s.y, vx: 0, vy: 0, onGround: false, input: { left: false, right: true, jump: false } };
for (let i = 0; i < 600; i++) stepPlayer(p, 1 / 60);
console.log('physics: y=%d onGround=%s x=%d', p.y, p.onGround, p.x);
if (!p.onGround) throw new Error('player did not land');

// 2) two clients see each other
const url = `ws://localhost:${process.env.PORT || 3000}/ws`;
const open = (name) => new Promise((res) => {
  const ws = new WebSocket(url); const last = {};
  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', name })));
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'state') last.state = m.p; if (m.t === 'welcome') last.id = m.id; });
  res({ ws, last });
});
const a = await open('Ana'), b = await open('Beto');
b.ws.on('open', () => b.ws.send(JSON.stringify({ t: 'input', left: false, right: true, jump: false })));
await new Promise((r) => setTimeout(r, 1000));
const names = a.last.state.map((x) => x.name).sort();
console.log('client A sees:', names.join(', '));
if (names.join() !== 'Ana,Beto') throw new Error('sync failed');
const beto = a.last.state.find((x) => x.name === 'Beto');
const ana = a.last.state.find((x) => x.name === 'Ana');
console.log('Beto moved right relative to Ana:', beto.x > ana.x);
a.ws.close(); b.ws.close();
console.log('OK');
process.exit(0);
