// One party at a time: the teacher opens it, students join during a countdown, everyone plays the
// same game instance, then results. Game instances live in ./games and are server-authoritative.
import { GAMES, LOBBY_SECS } from '../shared/minigames.js';
import { StarsGame } from './games/stars.js';
import { CatapultGame } from './games/catapult.js';
import { DefenseGame } from './games/defense.js';
import { PotatoGame } from './games/potato.js';

const CLASSES = { stars: StarsGame, catapult: CatapultGame, defense: DefenseGame, potato: PotatoGame };
const RESULTS_SECS = 9;
const TICK_HZ = 30;

export class PartyManager {
  // io: { players: Map, send(id, obj), broadcast(obj) }
  constructor(io) {
    this.io = io;
    this.party = null;
    this.nextId = 1;
    setInterval(() => this.tick(1 / TICK_HZ), 1000 / TICK_HZ);
  }

  inGame(id) { return !!this.party && this.party.phase !== 'lobby' && this.party.members.has(id); }

  snapshot() {
    const p = this.party;
    if (!p) return null;
    return {
      id: p.id, game: p.game, host: p.host, hostName: p.hostName, phase: p.phase,
      left: Math.max(0, Math.ceil((p.deadline - Date.now()) / 1000)),
      members: [...p.members].map((id) => this.io.players.get(id)).filter(Boolean)
        .map((pl) => ({ id: pl.id, n: pl.name, c: pl.char, r: pl.role === 'teacher' ? 1 : 0 })),
    };
  }
  announce() { this.io.broadcast({ t: 'party', p: this.snapshot() }); }

  onMessage(player, msg) {
    const p = this.party;
    switch (msg.t) {
      case 'party-open': {
        if (player.role !== 'teacher' || p || !GAMES[msg.game]) return;
        const secs = LOBBY_SECS.includes(msg.secs) ? msg.secs : 30;
        this.party = {
          id: this.nextId++, game: msg.game, host: player.id, hostName: player.name, phase: 'lobby',
          members: new Set([player.id]), deadline: Date.now() + secs * 1000, instance: null, lastLeft: secs,
        };
        this.announce();
        return;
      }
      case 'party-join':
        if (p && p.phase === 'lobby' && !p.members.has(player.id)) { p.members.add(player.id); this.announce(); }
        return;
      case 'party-leave':
        if (p?.members.has(player.id)) this.leave(player.id);
        return;
      case 'party-start':
        if (p && p.phase === 'lobby' && player.id === p.host) this.start();
        return;
      case 'party-cancel':
        if (p && player.id === p.host) this.close();
        return;
      case 'g':
        if (p?.phase === 'playing' && p.members.has(player.id)) p.instance.onMessage(player.id, msg);
    }
  }

  leave(id) {
    const p = this.party;
    if (!p) return;
    p.members.delete(id);
    if (p.phase === 'playing') p.instance.onLeave?.(id);
    if (id === p.host && p.phase === 'lobby') { this.close(); return; }
    if (!p.members.size && p.phase !== 'results') { this.close(); return; }
    this.announce();
  }

  start() {
    const p = this.party;
    const members = [...p.members].map((id) => this.io.players.get(id)).filter(Boolean)
      .map((pl) => ({ id: pl.id, name: pl.name, char: pl.char }));
    if (!members.length) { this.close(); return; }
    p.phase = 'playing';
    const send = (id, obj) => this.io.send(id, obj);
    const broadcast = (obj) => { for (const id of p.members) this.io.send(id, obj); };
    p.instance = new CLASSES[p.game]({ members, send, broadcast, end: (res) => this.finish(res) });
    broadcast({ t: 'g-start', game: p.game, init: p.instance.init() });
    this.announce();
  }

  finish(res) {
    const p = this.party;
    if (!p || p.phase !== 'playing') return;
    p.phase = 'results';
    p.deadline = Date.now() + RESULTS_SECS * 1000;
    for (const id of p.members) this.io.send(id, { t: 'g-end', ...res });
    this.announce();
  }

  close() {
    const p = this.party;
    if (!p) return;
    if (p.phase !== 'lobby') for (const id of p.members) this.io.send(id, { t: 'g-close' });
    this.party = null;
    this.announce();
  }

  tick(dt) {
    const p = this.party;
    if (!p) return;
    const now = Date.now();
    if (p.phase === 'lobby') {
      const left = Math.ceil((p.deadline - now) / 1000);
      if (left !== p.lastLeft) { p.lastLeft = left; this.announce(); }
      if (now >= p.deadline) this.start();
    } else if (p.phase === 'playing') {
      p.instance.tick(dt);
    } else if (p.phase === 'results' && now >= p.deadline) {
      this.close();
    }
  }
}


