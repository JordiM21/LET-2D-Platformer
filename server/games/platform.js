// Base for arena games where everyone runs and jumps (stars, potato).
// Clients simulate their own movement; the server relays positions and checks they are plausible.
import { PHYS, PLAYER_W, PLAYER_H } from '../../shared/game.js';
import { arenaSpawn, ARENA_W, ARENA_H } from '../../shared/minigames.js';
import { num } from './util.js';

const MAX_SPEED = Math.hypot(PHYS.maxRun, PHYS.bounceSpeed) * 1.3;
export const COUNTDOWN = 3;

export class PlatformGame {
  constructor({ members, send, broadcast, end }, dur) {
    this.send = send; this.broadcast = broadcast; this.end = end;
    this.dur = dur;
    this.t = -COUNTDOWN; // game clock, negative during "3, 2, 1"
    this.sendT = 0; this.done = false;
    this.players = new Map();
    members.forEach((m, i) => {
      const s = arenaSpawn(i, members.length);
      this.players.set(m.id, { ...m, x: s.x, y: s.y, vx: 0, vy: 0, g: 1, f: 1, at: Date.now(), score: 0, stunUntil: 0, gone: false });
    });
  }

  initPlayers() {
    return [...this.players.values()].map(({ id, name, char, x, y }) => ({ id, name, char, x, y }));
  }

  centre(p) { return { x: p.x + PLAYER_W / 2, y: p.y + PLAYER_H / 2 }; }

  onPos(id, msg) {
    const p = this.players.get(id);
    if (!p || p.gone) return;
    const x = num(msg.x), y = num(msg.y);
    if (x === null || y === null || x < -40 || x > ARENA_W + 40 || y < -ARENA_H || y > ARENA_H + 200) return;
    const now = Date.now(), dt = Math.max(0.05, (now - p.at) / 1000);
    if (Math.hypot(x - p.x, y - p.y) > MAX_SPEED * dt + 48 && !msg.tp) {
      this.send(id, { t: 'g', a: 'snap', x: p.x, y: p.y });
      return;
    }
    Object.assign(p, { x, y, vx: num(msg.vx) ?? 0, vy: num(msg.vy) ?? 0, g: msg.g ? 1 : 0, f: msg.f < 0 ? -1 : 1, at: now });
  }

  onLeave(id) {
    const p = this.players.get(id);
    if (p) { p.gone = true; p.left = true; }
  }

  // Positions go out at 20 Hz together with the time left.
  relay(dt, extra = {}) {
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = 0.05;
    const now = Date.now();
    this.broadcast({
      t: 'g', a: 'ps', tl: this.dur ? Math.max(0, Math.ceil(this.dur - this.t)) : null, ...extra,
      p: [...this.players.values()].filter((p) => !p.left).map((p) => [
        p.id, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.vx), Math.round(p.vy), p.g, p.f,
        p.stunUntil > now ? 1 : 0, p.gone ? 1 : 0,
      ]),
    });
  }
}
