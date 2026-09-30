// Starts nothing itself: run `npm start` first, then `npm test`.
import { WebSocket } from 'ws';
import { stepPlayer, newBody, spawnPoint, POIS, PLAYER_H, TILE } from '../shared/game.js';

// 1) physics: a body dropped at spawn lands, runs right and stays on the ground
const s = spawnPoint();
const p = newBody(s.x, s.y);
for (let i = 0; i < 240; i++) stepPlayer(p, { right: true }, 1 / 120);
console.log('physics: y=%d onGround=%s x=%d', p.y, p.onGround, Math.round(p.x));
if (!p.onGround) throw new Error('player did not land');

// 2) every POI stands on real ground
for (const poi of POIS) if (poi.row == null) throw new Error(`POI ${poi.id} has no ground`);

// 3) two clients see each other, movement relays, teleport cheats are rejected
const url = `ws://localhost:${process.env.PORT || 3000}/ws`;
const open = (name, char, pin) => new Promise((res) => {
  const ws = new WebSocket(url); const last = { gstars: 0 };
  ws.on('open', () => { ws.send(JSON.stringify({ t: 'join', name, char, pin })); res({ ws, last }); });
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'state') last.state = m.p;
    if (m.t === 'welcome') last.id = m.id;
    if (m.t === 'pos') last.snapped = true;
    if (m.t === 'party') last.party = m.p;
    if (m.t === 'g-start') last.gstart = m;
    if (m.t === 'g' && m.a === 'star') last.gstars++;
  });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const a = await open('Ana', 'frog'), b = await open('Beto', 'robot');
await wait(300);
b.ws.send(JSON.stringify({ t: 's', x: s.x + 20, y: s.y, vx: 200, vy: 0, g: 1, f: 1 }));
await wait(400);
const names = a.last.state.map((x) => x.n).sort();
console.log('client A sees:', names.join(', '));
if (names.join() !== 'Ana,Beto') throw new Error('sync failed');
const beto = a.last.state.find((x) => x.n === 'Beto');
console.log('Beto char=%s moved=%s', beto.c, beto.x > s.x + 10);
if (beto.c !== 'robot' || !(beto.x > s.x + 10)) throw new Error('relay failed');
b.ws.send(JSON.stringify({ t: 's', x: s.x + 3000, y: s.y, vx: 0, vy: 0, g: 1, f: 1 }));
await wait(200);
console.log('teleport rejected:', !!b.last.snapped);
if (!b.last.snapped) throw new Error('teleport not rejected');
// legit respawn teleport onto the home ground is allowed
b.last.snapped = false;
b.ws.send(JSON.stringify({ t: 's', tp: 1, x: POIS[0].x, y: POIS[0].row * TILE - PLAYER_H, vx: 0, vy: 0, g: 1, f: 1 }));
await wait(200);
if (b.last.snapped) throw new Error('respawn teleport rejected');

// 4) parties: only the teacher can open one; students join; the game starts and sends frames
const t = await open('Profe', 'robot', process.env.TEACHER_PIN || '1234');
await wait(300);
a.ws.send(JSON.stringify({ t: 'party-open', game: 'stars', secs: 20 }));
await wait(150);
if (a.last.party) throw new Error('student opened a party');
t.ws.send(JSON.stringify({ t: 'party-open', game: 'stars', secs: 20 }));
await wait(150);
b.ws.send(JSON.stringify({ t: 'party-join' }));
await wait(150);
console.log('lobby:', a.last.party.members.map((m) => m.n).join(', '));
if (a.last.party.members.length !== 2) throw new Error('join failed');
t.ws.send(JSON.stringify({ t: 'party-start' }));
await wait(3800); // 3 s countdown, then stars start falling
if (!b.last.gstart || !b.last.gstars) throw new Error('game did not start');
console.log('game started, stars falling:', b.last.gstars);
t.ws.send(JSON.stringify({ t: 'party-cancel' }));
await wait(150);
if (a.last.party !== null) throw new Error('party not closed');
a.ws.close(); b.ws.close(); t.ws.close();
console.log('OK');
process.exit(0);
