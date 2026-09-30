// Catapulta: two teams, one slingshot each. Players fling themselves at the other team's castle.
// The server runs the rigid-body physics (matter-js) so everyone sees the same blocks fall.
import Matter from 'matter-js';
import { GAMES, CAT, CASTLE, HILL } from '../../shared/minigames.js';
import { ranked, num } from './util.js';

const { Engine, Bodies, Body, Composite, Events, Vector } = Matter;
const STEP_MS = 1000 / 60;
const COUNTDOWN = 3;
const CROWN_HP = 7;
const BALL_LIFE = 7;

export class CatapultGame {
  constructor({ members, send, broadcast, end }) {
    this.send = send; this.broadcast = broadcast; this.end = end;
    this.dur = GAMES.catapult.secs;
    this.t = -COUNTDOWN; this.done = false; this.sendT = 0; this.acc = 0;
    this.players = new Map();
    // balance teams by join order
    members.forEach((m, i) => this.players.set(m.id, { ...m, team: i % 2, score: 0, readyAt: 0 }));

    this.engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
    this.world = this.engine.world;
    this.bodies = new Map(); // id -> body
    this.nextId = 1;

    const ground = Bodies.rectangle(CAT.W / 2, CAT.GROUND + 100, CAT.W * 3, 200, { isStatic: true, friction: 0.9, label: 'ground' });
    const hill = Bodies.fromVertices(800, 760, [HILL.map(([x, y]) => ({ x, y }))], { isStatic: true, friction: 0.8, label: 'hill' });
    Body.setPosition(hill, { x: 800, y: hill.position.y + (CAT.GROUND - hill.bounds.max.y) });
    Composite.add(this.world, [ground, hill]);

    for (const team of [0, 1]) {
      for (const [kind, lx, bottom, w, h] of CASTLE) {
        const x = team === 0 ? lx : CAT.W - lx;
        const opts = {
          label: kind, friction: 0.8, restitution: 0.05,
          density: kind === 'stone' ? 0.004 : kind === 'crown' ? 0.0015 : 0.0012,
        };
        const b = kind === 'crown'
          ? Bodies.trapezoid(x, bottom - h / 2, w, h, -0.3, opts)
          : Bodies.rectangle(x, bottom - h / 2, w, h, opts);
        this.track(b, { kind, team, w, h, hp: kind === 'crown' ? CROWN_HP : 0 });
      }
    }
    // let the towers settle before anyone sees them
    for (let i = 0; i < 90; i++) Engine.update(this.engine, STEP_MS);
    for (const b of this.bodies.values()) Matter.Sleeping.set(b, true);

    this.events = []; this.removed = []; this.spawned = [];
    Events.on(this.engine, 'collisionStart', (ev) => this.onCollide(ev));
  }

  track(b, meta) {
    b.gid = this.nextId++;
    b.meta = meta;
    this.bodies.set(b.gid, b);
    Composite.add(this.world, b);
    return b;
  }

  describe(b) {
    const m = b.meta;
    return { id: b.gid, k: m.kind, team: m.team, w: m.w, h: m.h, r: m.r, c: m.char, x: r1(b.position.x), y: r1(b.position.y), a: r2(b.angle) };
  }

  init() {
    return {
      dur: this.dur, countdown: COUNTDOWN,
      players: [...this.players.values()].map(({ id, name, char, team }) => ({ id, name, char, team })),
      bodies: [...this.bodies.values()].map((b) => this.describe(b)),
    };
  }

  crownsLeft(team) {
    let n = 0;
    for (const b of this.bodies.values()) if (b.meta.kind === 'crown' && b.meta.team === team && !b.meta.dead) n++;
    return n;
  }

  onCollide(ev) {
    for (const pair of ev.pairs) {
      const { bodyA: a, bodyB: b } = pair;
      if (!a.meta && !b.meta) continue;
      const rel = Vector.magnitude(Vector.sub(a.velocity, b.velocity));
      // who gets the credit: the ball's owner, passed along to blocks it knocks into
      for (const [x, y] of [[a, b], [b, a]]) {
        if (!x.meta || !y.meta) continue;
        const owner = x.meta.kind === 'ball' ? x.meta.owner : x.meta.lastHit;
        if (owner && rel > 1.5) y.meta.lastHit = owner;
      }
      for (const [x, other] of [[a, b], [b, a]]) {
        const m = x.meta;
        if (!m) continue;
        if (m.kind === 'crown' && !m.dead && rel > 2.2) {
          m.hp -= rel;
          if (m.hp <= 0) this.popCrown(x);
          else this.events.push({ e: 'hit', id: x.gid, s: r1(rel) });
        } else if ((m.kind === 'wood' || m.kind === 'plank' || m.kind === 'stone') && other.meta?.kind === 'ball' && rel > 3) {
          const shooter = this.players.get(other.meta.owner);
          if (shooter && shooter.team !== m.team && !m.scoredBy?.has(other.gid)) {
            (m.scoredBy ||= new Set()).add(other.gid);
            shooter.score += 5;
          }
          this.events.push({ e: 'thud', x: r1(x.position.x), y: r1(x.position.y), s: r1(rel), k: m.kind });
        }
      }
    }
  }

  popCrown(b) {
    const m = b.meta;
    m.dead = true;
    const scorer = this.players.get(m.lastHit);
    if (scorer && scorer.team !== m.team) scorer.score += 100;
    this.events.push({ e: 'crown', id: b.gid, team: m.team, by: m.lastHit || null, x: r1(b.position.x), y: r1(b.position.y) });
    Composite.remove(this.world, b);
    this.bodies.delete(b.gid);
    this.removed.push(b.gid);
  }

  onMessage(id, msg) {
    if (msg.a !== 'fire' || this.t < 0 || this.done) return;
    const p = this.players.get(id);
    const ang = num(msg.ang), pow = num(msg.pow);
    if (!p || ang === null || pow === null || this.t < p.readyAt) return;
    p.readyAt = this.t + CAT.COOLDOWN;
    const s = CAT.SLING[p.team];
    const speed = Math.max(0.15, Math.min(1, pow)) * CAT.MAX_SPEED;
    const ball = Bodies.circle(s.x, s.y, CAT.BALL_R, { label: 'ball', density: 0.006, restitution: 0.35, friction: 0.6, frictionAir: 0 });
    this.track(ball, { kind: 'ball', owner: id, team: p.team, r: CAT.BALL_R, char: p.char, born: this.t });
    Body.setVelocity(ball, { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed });
    Body.setAngularVelocity(ball, (p.team === 0 ? 1 : -1) * 0.15);
    this.events.push({ e: 'fire', by: id, team: p.team });
    this.spawned.push(this.describe(ball));
  }

  onLeave(id) { this.players.delete(id); }

  tick(dt) {
    if (this.done) return;
    this.events ||= []; this.removed ||= []; this.spawned ||= [];
    this.t += dt;
    if (this.t >= 0) {
      this.acc += dt * 1000;
      while (this.acc >= STEP_MS) { Engine.update(this.engine, STEP_MS); this.acc -= STEP_MS; }
      for (const b of [...this.bodies.values()]) {
        const off = b.position.y > CAT.H + 200 || b.position.x < -300 || b.position.x > CAT.W + 300;
        if (b.meta.kind === 'crown' && off && !b.meta.dead) { this.popCrown(b); continue; }
        if (off || (b.meta.kind === 'ball' && this.t - b.meta.born > BALL_LIFE)) {
          Composite.remove(this.world, b); this.bodies.delete(b.gid); this.removed.push(b.gid);
        }
      }
    }

    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 0.05;
      const moving = [];
      for (const b of this.bodies.values()) if (!b.isSleeping && !b.isStatic) moving.push([b.gid, r1(b.position.x), r1(b.position.y), r2(b.angle)]);
      this.broadcast({
        t: 'g', a: 'f', b: moving, add: this.spawned, rm: this.removed, ev: this.events,
        tl: Math.max(0, Math.ceil(this.dur - Math.max(0, this.t))), cr: [this.crownsLeft(0), this.crownsLeft(1)],
        sc: [...this.players.values()].map((p) => [p.id, p.score, Math.max(0, Math.round((p.readyAt - this.t) * 10) / 10)]),
      });
      this.events = []; this.removed = []; this.spawned = [];
    }

    const c0 = this.crownsLeft(0), c1 = this.crownsLeft(1);
    if (this.t >= this.dur || c0 === 0 || c1 === 0) {
      this.done = true;
      const winner = c0 === c1 ? null : c0 > c1 ? 0 : 1;
      this.end({
        game: 'catapult', winner, crowns: [c0, c1], unit: 'pts',
        results: ranked([...this.players.values()].map((p) => ({ id: p.id, name: p.name, char: p.char, team: p.team, score: p.score + (winner === p.team ? 50 : 0) }))),
      });
    }
  }
}

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
