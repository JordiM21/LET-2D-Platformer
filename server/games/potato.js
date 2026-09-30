// Papa Caliente: someone holds the bomb; touching another player passes it. When the fuse runs out
// the holder is out (becomes a ghost). Last one standing wins.
import { PLAYER_W, PLAYER_H } from '../../shared/game.js';
import { PlatformGame } from './platform.js';
import { ranked, rnd, num } from './util.js';

export class PotatoGame extends PlatformGame {
  constructor(ctx) {
    super(ctx, 0);
    this.holder = null; this.fuse = 0; this.fuseMax = 0;
    this.pause = 0; this.round = 0; this.outOrder = [];
    this.noBack = new Map(); // id -> {from, until}
  }

  init() { return { players: this.initPlayers() }; }

  alive() { return [...this.players.values()].filter((p) => !p.gone); }

  newRound() {
    const alive = this.alive();
    if (alive.length === 0) return;
    this.round++;
    this.holder = alive[Math.floor(Math.random() * alive.length)].id;
    this.fuseMax = this.fuse = Math.max(8, 18 - alive.length) * rnd(0.85, 1.25);
    this.noBack.clear();
    this.broadcast({ t: 'g', a: 'bomb', holder: this.holder, from: null, fuse: this.fuse, fuseMax: this.fuseMax, round: this.round });
  }

  onMessage(id, msg) {
    if (msg.a === 'pos') return this.onPos(id, msg);
    if (msg.a !== 'tag' || this.t < 0 || this.done || this.pause > 0 || id !== this.holder) return;
    const p = this.players.get(id), v = this.players.get(num(msg.v));
    if (!v || v.gone || v === p) return;
    const nb = this.noBack.get(id);
    if (nb && nb.from === v.id && nb.until > Date.now()) return; // can't hand it straight back
    const dx = (p.x + PLAYER_W / 2) - (v.x + PLAYER_W / 2), dy = (p.y + PLAYER_H / 2) - (v.y + PLAYER_H / 2);
    if (Math.hypot(dx, dy) > 52) return;
    this.holder = v.id;
    this.noBack.set(v.id, { from: id, until: Date.now() + 900 });
    this.fuse = Math.max(this.fuse, 2.5); // never explode the instant you receive it
    this.broadcast({ t: 'g', a: 'bomb', holder: v.id, from: id, fuse: this.fuse, fuseMax: this.fuseMax, round: this.round });
  }

  onLeave(id) {
    super.onLeave(id);
    if (id === this.holder && !this.done) { this.holder = null; this.pause = 1.5; }
    this.checkEnd();
  }

  checkEnd() {
    if (this.done || this.t < 0) return;
    const alive = this.alive();
    if (alive.length <= 1 && this.players.size > 1 || alive.length === 0) {
      this.done = true;
      // winner first, then reverse elimination order
      const order = [...alive.map((p) => p.id), ...this.outOrder.slice().reverse()];
      const n = order.length;
      const results = ranked([...this.players.values()].map((p) => ({
        id: p.id, name: p.name, char: p.char, score: n - Math.max(0, order.indexOf(p.id)),
      })));
      this.end({ game: 'potato', results, unit: 'pts' });
    }
  }

  tick(dt) {
    if (this.done) return;
    this.t += dt;
    if (this.t >= 0) {
      if (this.holder === null) {
        if (this.pause > 0) this.pause -= dt;
        else this.newRound();
      } else {
        this.fuse -= dt;
        if (this.fuse <= 0) {
          const v = this.players.get(this.holder);
          if (v) { v.gone = true; this.outOrder.push(v.id); }
          this.broadcast({ t: 'g', a: 'boom', v: this.holder, x: v?.x, y: v?.y });
          this.holder = null; this.pause = 2.8;
          this.checkEnd();
        }
      }
    }
    this.relay(dt, { h: this.holder, fu: this.holder ? Math.round(this.fuse * 10) / 10 : 0 });
  }
}
