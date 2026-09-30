// Defensa del Castillo: co-op tower defense. Each player owns one tower (auto-fires) and can tap
// slimes. Kills earn coins; coins buy tower upgrades. Survive every wave to win.
import { DEF, PATH_LEN, pathPoint, waveList, hpScale } from '../../shared/minigames.js';
import { ranked, num } from './util.js';

const COUNTDOWN = 3;
const WAVE_BREAK = 5;
const SPAWN_GAP = 0.85;

export class DefenseGame {
  constructor({ members, send, broadcast, end }) {
    this.send = send; this.broadcast = broadcast; this.end = end;
    this.t = -COUNTDOWN; this.done = false; this.sendT = 0;
    this.players = new Map();
    members.forEach((m, i) => this.players.set(m.id, { ...m, slot: i % DEF.SLOTS.length, coins: 4, dmg: 0, lastTap: 0 }));
    // one tower per slot that has an owner
    this.towers = DEF.SLOTS.map(([x, y], i) => ({ i, x, y, level: 0, owner: null, cd: 0 }));
    for (const p of this.players.values()) { const tw = this.towers[p.slot]; tw.owner ??= p.id; tw.level = 1; }
    // small groups get helper towers (nobody owns them) so the game stays winnable
    for (let i = 0, need = 3 - this.players.size; need > 0 && i < this.towers.length; i++) {
      if (!this.towers[i].level) { this.towers[i].level = 1; need--; }
    }
    this.enemies = new Map(); this.nextE = 1;
    this.lives = DEF.LIVES; this.wave = 0; this.queue = []; this.spawnT = 0; this.breakT = 0;
    this.events = [];
  }

  init() {
    return {
      countdown: COUNTDOWN, lives: this.lives, waves: DEF.WAVES,
      players: [...this.players.values()].map(({ id, name, char, slot }) => ({ id, name, char, slot })),
      towers: this.towers.map((t) => [t.level, t.owner]),
    };
  }

  startWave() {
    this.wave++;
    this.queue = waveList(this.wave, this.players.size);
    this.spawnT = 0;
    const bonus = this.wave > 1 ? 3 : 0;
    for (const p of this.players.values()) p.coins += bonus;
    this.events.push({ e: 'wave', w: this.wave, bonus });
  }

  damage(e, amount, byId) {
    if (e.hp <= 0) return;
    e.hp -= amount;
    const p = this.players.get(byId);
    if (p) p.dmg += amount;
    if (e.hp <= 0) {
      this.enemies.delete(e.id);
      const coin = DEF.ENEMY[e.type].coin;
      if (p) p.coins += coin;
      const pt = pathPoint(e.d);
      this.events.push({ e: 'kill', id: e.id, by: byId, coin, x: Math.round(pt.x), y: Math.round(pt.y) });
    }
  }

  onMessage(id, msg) {
    if (this.t < 0 || this.done) return;
    const p = this.players.get(id);
    if (!p) return;
    if (msg.a === 'tap') {
      if (this.t - p.lastTap < DEF.TAP_COOLDOWN) return;
      const e = this.enemies.get(num(msg.e));
      if (!e) return;
      p.lastTap = this.t;
      this.events.push({ e: 'tap', id: e.id, by: id });
      this.damage(e, DEF.TAP_DMG, id);
    } else if (msg.a === 'up') {
      const tw = this.towers[p.slot];
      if (tw.owner !== id || tw.level >= DEF.TOWER.cost.length) return;
      const cost = DEF.TOWER.cost[tw.level];
      if (p.coins < cost) return;
      p.coins -= cost; tw.level++;
      this.events.push({ e: 'up', slot: tw.i, level: tw.level, by: id });
    }
  }

  onLeave(id) {
    const p = this.players.get(id);
    if (!p) return;
    // the tower keeps working without its owner; it just can't be upgraded
    this.players.delete(id);
  }

  tick(dt) {
    if (this.done) return;
    this.t += dt;
    if (this.t >= 0) {
      if (this.wave === 0) this.startWave();
      // spawning + wave breaks
      if (this.queue.length) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = SPAWN_GAP * (this.queue[0] === 'boss' ? 3 : 1);
          const type = this.queue.shift();
          const hp = Math.round(DEF.ENEMY[type].hp * hpScale(this.players.size));
          const e = { id: this.nextE++, type, d: 0, hp, max: hp };
          this.enemies.set(e.id, e);
        }
      } else if (!this.enemies.size) {
        if (this.wave >= DEF.WAVES) return this.finish(true);
        this.breakT += dt;
        if (this.breakT >= WAVE_BREAK) { this.breakT = 0; this.startWave(); }
      }
      // move
      for (const e of [...this.enemies.values()]) {
        e.d += DEF.ENEMY[e.type].speed * dt;
        if (e.d >= PATH_LEN) {
          this.enemies.delete(e.id);
          this.lives = Math.max(0, this.lives - DEF.ENEMY[e.type].lives);
          this.events.push({ e: 'leak', id: e.id, lives: this.lives });
          if (this.lives <= 0) return this.finish(false);
        }
      }
      // towers: target the enemy furthest along within range
      for (const tw of this.towers) {
        if (!tw.level) continue;
        tw.cd -= dt;
        if (tw.cd > 0) continue;
        const L = tw.level - 1, range = DEF.TOWER.range[L];
        let best = null;
        for (const e of this.enemies.values()) {
          const pt = pathPoint(e.d);
          if (Math.hypot(pt.x - tw.x, pt.y - tw.y) <= range && (!best || e.d > best.d)) best = e;
        }
        if (!best) continue;
        tw.cd = 1 / DEF.TOWER.rate[L];
        this.events.push({ e: 'shot', slot: tw.i, id: best.id });
        this.damage(best, DEF.TOWER.dmg[L], tw.owner);
      }
    }

    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 0.1;
      this.broadcast({
        t: 'g', a: 's', lives: this.lives, wave: this.wave, brk: this.breakT > 0 ? Math.ceil(WAVE_BREAK - this.breakT) : 0,
        e: [...this.enemies.values()].map((e) => [e.id, e.type, Math.round(e.d * 10) / 10, e.hp, e.max]),
        tw: this.towers.map((t) => t.level),
        pl: [...this.players.values()].map((p) => [p.id, p.coins, Math.round(p.dmg)]),
        ev: this.events,
      });
      this.events = [];
    }
  }

  finish(win) {
    this.done = true;
    this.end({
      game: 'defense', win, wave: this.wave, unit: '💥',
      results: ranked([...this.players.values()].map((p) => ({ id: p.id, name: p.name, char: p.char, score: Math.round(p.dmg) }))),
    });
  }
}
