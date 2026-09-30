// Lluvia de Estrellas: free-for-all. Stars fall from the sky; stomping someone knocks stars out of them.
import { PLAYER_W, PLAYER_H } from '../../shared/game.js';
import { GAMES, ARENA_W, starPos, starLandTime, arenaFloorBelow, STAR_LIFE_LANDED } from '../../shared/minigames.js';
import { PlatformGame } from './platform.js';
import { ranked, rnd, num } from './util.js';

export class StarsGame extends PlatformGame {
  constructor(ctx) {
    super(ctx, GAMES.stars.secs);
    this.stars = new Map();
    this.nextStar = 1;
    this.spawnT = 0.4; this.bigT = 8;
  }

  init() { return { players: this.initPlayers(), dur: this.dur } ; }

  spawn(s) {
    s.id = this.nextStar++;
    s.born = this.t;
    s.dies = this.t + starLandTime(s) + STAR_LIFE_LANDED;
    this.stars.set(s.id, s);
    return s;
  }

  fallingStar(big) {
    const x = rnd(40, ARENA_W - 40);
    return this.spawn({ kind: 'fall', x, y: -20, ph: rnd(0, 6), big: big ? 1 : 0, landY: arenaFloorBelow(x, 0) });
  }

  onMessage(id, msg) {
    if (msg.a === 'pos') return this.onPos(id, msg);
    if (this.t < 0 || this.done) return;
    const p = this.players.get(id);
    if (!p) return;

    if (msg.a === 'pick') {
      const s = this.stars.get(msg.s | 0);
      if (!s) return;
      const sp = starPos(s, this.t - s.born), c = this.centre(p);
      if (Math.hypot(sp.x - c.x, sp.y - c.y) > 64) return;
      this.stars.delete(s.id);
      p.score += s.big ? 5 : 1;
      this.broadcast({ t: 'g', a: 'pick', s: s.id, by: id, score: p.score, big: s.big });
    } else if (msg.a === 'stomp') {
      const v = this.players.get(num(msg.v));
      const now = Date.now();
      if (!v || v === p || v.stunUntil > now || p.stunUntil > now) return;
      const dx = (p.x + PLAYER_W / 2) - (v.x + PLAYER_W / 2), feet = p.y + PLAYER_H;
      if (Math.abs(dx) > 36 || feet < v.y - 30 || feet > v.y + 20) return;
      v.stunUntil = now + 1300;
      const loss = Math.min(3, v.score);
      v.score -= loss;
      const stars = [];
      for (let i = 0; i < loss; i++) {
        const x = v.x + PLAYER_W / 2, y = v.y;
        const vx = (i - (loss - 1) / 2) * 260 + rnd(-40, 40);
        const fx = Math.max(20, Math.min(ARENA_W - 20, x + vx / 3));
        stars.push(this.spawn({ kind: 'drop', x, y, vx, ph: 0, big: 0, landY: arenaFloorBelow(fx, y + PLAYER_H - 2) }));
      }
      this.broadcast({ t: 'g', a: 'stomp', by: id, v: v.id, loss, vScore: v.score, stars });
    }
  }

  tick(dt) {
    if (this.done) return;
    this.t += dt;
    if (this.t >= 0) {
      const n = this.players.size;
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = Math.max(0.3, 0.95 - 0.07 * n) * rnd(0.7, 1.3);
        this.broadcast({ t: 'g', a: 'star', s: this.fallingStar(false) });
      }
      this.bigT -= dt;
      if (this.bigT <= 0) {
        this.bigT = rnd(8, 12);
        this.broadcast({ t: 'g', a: 'star', s: this.fallingStar(true) });
      }
      for (const s of this.stars.values()) if (this.t > s.dies) this.stars.delete(s.id);
    }
    this.relay(dt);
    if (this.t >= this.dur) {
      this.done = true;
      this.end({
        game: 'stars',
        results: ranked([...this.players.values()].map((p) => ({ id: p.id, name: p.name, char: p.char, score: p.score }))),
        unit: '⭐',
      });
    }
  }
}
