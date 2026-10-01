// Shared pieces for minigame scenes: DOM HUD, camera fitting, backgrounds, countdown, and a base
// scene for the run-and-jump arena games.
import * as G from '/shared/game.js';
import { ARENA_MAP, ARENA_W, ARENA_H, ARENA_COLS, ARENA_ROWS_N } from '/shared/minigames.js';
import { RES } from '../art.js';
import { Rig } from '../rig.js';
import { sfx } from '../audio.js';
import { makeGameArt } from './gameart.js';

const { TILE, PLAYER_W, PLAYER_H } = G;
export const S = 1 / RES;
const STEP = 1 / 120;
const INTERP_DELAY = 100;
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

// ------------------------------------------------------------ DOM HUD
export class GameHud {
  constructor(def) {
    this.el = document.createElement('div');
    this.el.className = 'ghud';
    this.el.style.setProperty('--gc', def.color);
    this.el.innerHTML = `
      <div class="ghud-top">
        <div class="gchip gtitle"><span>${def.icon}</span><b>${esc(def.name)}</b></div>
        <div class="gchip gtimer hidden" id="gTimer">⏱ <b>0:00</b></div>
        <div class="gchip gscore hidden" id="gScore"></div>
      </div>
      <div class="gboard" id="gBoard"></div>
      <div class="gcenter" id="gCenter"></div>
      <div class="gbottom" id="gBottom"></div>`;
    document.body.appendChild(this.el);
    this.$ = (id) => this.el.querySelector('#' + id);
  }
  timer(sec) {
    const t = this.$('gTimer');
    if (sec == null) { t.classList.add('hidden'); return; }
    t.classList.remove('hidden');
    t.querySelector('b').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    t.classList.toggle('hurry', sec <= 10 && sec > 0);
    if (sec <= 5 && sec > 0 && sec !== this.lastTick) { this.lastTick = sec; sfx.tap(); }
  }
  score(html) { const s = this.$('gScore'); s.classList.remove('hidden'); if (s.innerHTML !== html) { s.innerHTML = html; s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); } }
  board(rows, myId) {
    this.$('gBoard').innerHTML = rows.slice(0, 6).map((r, i) =>
      `<div class="grow${r.id === myId ? ' me' : ''}"><span class="gpos">${i + 1}</span><span class="gname">${esc(r.name)}</span><b>${r.score}</b></div>`).join('');
  }
  bottom(html) { this.$('gBottom').innerHTML = html; }
  center(html, ms = 1400, cls = '') {
    const c = this.$('gCenter');
    const d = document.createElement('div');
    d.className = 'gmsg ' + cls; d.innerHTML = html;
    c.appendChild(d);
    if (ms) setTimeout(() => { d.classList.add('bye'); setTimeout(() => d.remove(), 300); }, ms);
    return d;
  }
  // "3, 2, 1, ¡YA!" — calls done when finished
  countdown(n, done) {
    const step = (k) => {
      if (k === 0) { this.center('¡YA!', 700, 'go'); sfx.discover(); done?.(); return; }
      this.center(String(k), 800, 'count'); sfx.near();
      setTimeout(() => step(k - 1), 1000);
    };
    step(n);
  }
  destroy() { this.el.remove(); }
}

// ------------------------------------------------------------ camera + background
export function fitCamera(scene, W, H, cam = scene.cameras.main) {
  const sw = scene.scale.width, sh = scene.scale.height;
  const z = Math.min(sw / W, sh / H);
  cam.setZoom(z);
  cam.centerOn(W / 2, H / 2);
  return z;
}

export function gradientTexture(scene, key, stops) {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  scene.textures.addCanvas(key, c);
}

// A background that fills the whole screen whatever the zoom: drawn by a second, unzoomed camera.
export function screenBackground(scene, key, worldLayer) {
  const bgLayer = scene.add.layer();
  const img = bgLayer.add(scene.add.image(0, 0, key).setOrigin(0));
  const bgCam = scene.cameras.main;
  const cam = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
  bgCam.ignore(worldLayer); cam.ignore(bgLayer);
  const size = () => {
    const w = scene.scale.width, h = scene.scale.height;
    img.setDisplaySize(w, h); bgCam.setSize(w, h); cam.setSize(w, h);
  };
  size();
  return { bgLayer, cam, size, img };
}

// ------------------------------------------------------------ base arena scene (run & jump games)
export class ArenaScene extends Phaser.Scene {
  init(data) {
    this.ready = false;
    this.ui = data.ui; this.net = data.net; this.profile = data.profile;
    this.def = data.def; this.initData = data.init; this.hud = data.hud;
    this.myId = this.net.id;
  }

  // subclasses: bgKey(), setupGame(), onGame(msg), afterStep(ev), extraUpdate(dt)
  create() {
    makeGameArt(this);
    this.world = this.add.layer();
    this.bg = screenBackground(this, this.bgKey(), this.world);
    this.cam = this.bg.cam;
    this.buildArena();

    this.fx = {
      dust: this.addParticles('p_puff', { speed: { min: 20, max: 90 }, angle: { min: 180, max: 360 }, scale: { start: 0.55, end: 0 }, alpha: { start: 0.9, end: 0 }, lifespan: 420, gravityY: -60 }, 33),
      spark: this.addParticles('p_star', { speed: { min: 90, max: 260 }, scale: { start: 0.9, end: 0 }, rotate: { start: 0, end: 360 }, lifespan: 600, gravityY: 300, tint: [0xFFC83D, 0xFFE27A, 0xFFFFFF, 0xFF8DE8] }, 36),
      confetti: this.addParticles('p_dot', { speed: { min: 140, max: 380 }, angle: { min: 220, max: 320 }, scale: { start: 0.8, end: 0.2 }, lifespan: 1100, gravityY: 700, tint: [0xFF5A5F, 0xFFC83D, 0x3CC7A8, 0x58B8F2, 0xB982FF, 0xCA4B15] }, 36),
    };

    this.players = new Map(); // id -> {rig, buf, name, char, stun, gone}
    for (const p of this.initData.players) {
      const me = p.id === this.myId;
      const rig = new Rig(this, this.world, p.char, p.name, me, ARENA_MAP);
      rig.update(0, p.x + PLAYER_W / 2, p.y + PLAYER_H, 0, 0, true);
      this.players.set(p.id, { id: p.id, rig, buf: [], name: p.name, char: p.char, stun: 0, gone: 0, wasG: true, airVy: 0 });
      if (me) { this.body = G.newBody(p.x, p.y); this.prevPos = { x: p.x, y: p.y }; }
    }
    this.me = this.players.get(this.myId);
    this.acc = 0; this.jumpLatch = false; this.sendT = 0; this.locked = true; this.stunnedUntil = 0;

    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN,SPACE,A,D,W,S');
    this.input.keyboard.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    this.input.keyboard.on('keydown', (e) => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code) && !e.repeat) this.jumpLatch = true; });
    this.ui.onJump = () => { this.jumpLatch = true; };
    this.ui.showTouch(true);

    this.onResize();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.onResize, this); });
    this.setupGame();
    this.hud.countdown(3, () => { this.locked = false; });
    this.ready = true;
  }

  addParticles(key, cfg, depth) {
    const p = this.add.particles(0, 0, key, { emitting: false, ...cfg }).setDepth(depth);
    this.world.add(p);
    return p;
  }

  buildArena() {
    const solid = (c, r) => { const t = ARENA_MAP.tileAt(c, r); return t === G.T_SOLID || t === G.T_BOUNCE; };
    this.pads = new Map();
    for (let r = 0; r < ARENA_ROWS_N; r++) for (let c = 0; c < ARENA_COLS; c++) {
      const t = ARENA_MAP.tileAt(c, r), x = c * TILE, y = r * TILE;
      if (t === G.T_SOLID || t === G.T_BOUNCE) {
        const key = `t_${solid(c, r - 1) ? 0 : 1}${solid(c - 1, r) ? 0 : 1}${solid(c + 1, r) ? 0 : 1}`;
        this.world.add(this.add.image(x - 0.3, y - 0.3, key).setOrigin(0).setScale(S * (TILE + 0.6) / TILE).setDepth(20));
        // fill below the floor so the arena never looks cut off
        for (let k = 1; k < 8; k++) this.world.add(this.add.image(x - 0.3, y + k * TILE - 0.3, k > 2 ? 't_deep' : 't_000').setOrigin(0).setScale(S * (TILE + 0.6) / TILE).setDepth(20));
        if (t === G.T_BOUNCE) {
          const pad = this.add.image(x + TILE / 2, y + 6, 'pad').setOrigin(0.5, 1).setScale(S).setDepth(21);
          this.world.add(pad); this.pads.set(c, pad);
        }
      } else if (t === G.T_ONEWAY) {
        const l = ARENA_MAP.tileAt(c - 1, r) === G.T_ONEWAY, rr = ARENA_MAP.tileAt(c + 1, r) === G.T_ONEWAY;
        const key = !l && !rr ? 'plank_s' : !l ? 'plank_l' : !rr ? 'plank_r' : 'plank_m';
        this.world.add(this.add.image(x - 0.3, y, key).setOrigin(0).setScale(S * (TILE + 0.6) / TILE, S).setDepth(20));
      }
    }
  }

  onResize() {
    this.bg.size();
    const sw = this.scale.width, sh = this.scale.height;
    // leave room for the HUD on top and thumbs at the bottom on phones
    const z = Math.min(sw / (ARENA_W + 16), sh / (ARENA_H + 90));
    this.cam.setZoom(z).centerOn(ARENA_W / 2, ARENA_H / 2 - 10);
  }

  readInput() {
    if (this.locked || this.ui.blocked || this.time.now < this.stunnedUntil) return { left: false, right: false, jump: false, down: false };
    const k = this.keys, t = this.ui.touch;
    return {
      left: k.LEFT.isDown || k.A.isDown || t.left,
      right: k.RIGHT.isDown || k.D.isDown || t.right,
      down: k.DOWN.isDown || k.S.isDown || t.down,
      jump: k.UP.isDown || k.W.isDown || k.SPACE.isDown || t.jump || this.jumpLatch,
    };
  }

  onNet(m) {
    if (m.a === 'ps') return this.onPositions(m);
    if (m.a === 'snap' && this.body) { Object.assign(this.body, { x: m.x, y: m.y, vx: 0, vy: 0 }); this.prevPos = { x: m.x, y: m.y }; return; }
    this.onGame(m);
  }

  onPositions(m) {
    const now = performance.now();
    if (m.tl != null) this.hud.timer(m.tl);
    for (const [id, x, y, vx, vy, g, f, stun, gone] of m.p) {
      const p = this.players.get(id);
      if (!p) continue;
      p.stun = stun; p.gone = gone;
      if (id === this.myId) continue;
      p.buf.push({ t: now, x, y, vx, vy, g });
      if (p.buf.length > 30) p.buf.shift();
    }
    this.onPositionsExtra?.(m);
  }

  update(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const b = this.body;
    if (b) {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.prevPos.x = b.x; this.prevPos.y = b.y;
        const input = this.readInput();
        const prevVy = b.vy;
        const ev = G.stepPlayer(b, input, STEP, ARENA_MAP);
        if (input.jump) this.jumpLatch = false;
        this.juice(ev, b);
        this.afterStep?.(ev, prevVy);
        this.acc -= STEP;
      }
      const a = this.acc / STEP;
      this.myX = this.prevPos.x + (b.x - this.prevPos.x) * a;
      this.myY = this.prevPos.y + (b.y - this.prevPos.y) * a;
      this.me.rig.update(dt, this.myX + PLAYER_W / 2, this.myY + PLAYER_H, b.vx, b.vy, b.onGround);
      this.sendT -= dt;
      if (this.sendT <= 0) {
        this.sendT = 0.05;
        this.net.send({ t: 'g', a: 'pos', x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, vx: Math.round(b.vx), vy: Math.round(b.vy), g: b.onGround ? 1 : 0, f: this.me.rig.facing });
      }
    }
    // remote players, rendered slightly in the past for smoothness
    const rt = performance.now() - INTERP_DELAY;
    for (const p of this.players.values()) {
      if (p.id === this.myId) continue;
      const buf = p.buf;
      if (!buf.length) { p.rig.update(dt, p.rig.root.x, p.rig.root.y, 0, 0, true); continue; }
      while (buf.length >= 3 && buf[1].t <= rt) buf.shift();
      let s;
      if (buf.length >= 2 && buf[0].t <= rt) {
        const [p0, p1] = buf, k = Math.min(1, (rt - p0.t) / Math.max(1, p1.t - p0.t));
        s = { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k, vx: p1.vx, vy: p1.vy, g: p1.g };
      } else s = buf[buf.length - 1];
      if (!s.g) p.airVy = s.vy;
      if (s.g && !p.wasG) { const k = Math.min(1, p.airVy / 900); p.rig.kick(1 + 0.4 * k, 1 - 0.35 * k); this.fx.dust.explode(3 + Math.round(6 * k), s.x + PLAYER_W / 2, s.y + PLAYER_H); }
      p.wasG = !!s.g;
      p.x = s.x; p.y = s.y;
      p.rig.update(dt, s.x + PLAYER_W / 2, s.y + PLAYER_H, s.vx, s.vy, !!s.g);
    }
    for (const p of this.players.values()) {
      p.rig.root.setAlpha(p.gone ? 0.35 : 1);
      if (p.stun) p.rig.rig.angle = Math.sin(time * 0.03) * 14; // dizzy wobble
    }
    this.extraUpdate?.(dt, time);
  }

  // positions of everyone this frame (for overlap checks)
  posOf(p) { return p.id === this.myId ? { x: this.myX, y: this.myY } : { x: p.x ?? p.rig.root.x - PLAYER_W / 2, y: p.y ?? p.rig.root.y - PLAYER_H }; }

  juice(ev, b) {
    const x = b.x + PLAYER_W / 2, y = b.y + PLAYER_H, rig = this.me.rig;
    if (ev.jump) { rig.kick(0.7, 1.35); sfx.jump(); this.fx.dust.explode(8, x, y); }
    if (ev.land !== undefined && !ev.bounce) { const s = Math.min(1, ev.land / 900); rig.kick(1 + 0.45 * s, 1 - 0.38 * s); this.fx.dust.explode(4 + Math.round(10 * s), x, y); sfx.land(s); }
    if (ev.bounce) {
      rig.kick(0.6, 1.5); sfx.bounce(); this.fx.spark.explode(10, x, y); this.cam.shake(120, 0.004);
      const pad = this.pads.get(Math.floor(x / TILE));
      if (pad) this.tweens.add({ targets: pad, scaleY: S * 0.45, scaleX: S * 1.35, duration: 70, yoyo: true });
    }
  }

  // a "+N" that pops and floats
  floatText(x, y, text, color = '#FFC83D') {
    const t = this.add.text(x, y, text, { fontFamily: 'Fredoka, sans-serif', fontSize: '18px', fontStyle: '700', color, stroke: '#1F1A3D', strokeThickness: 4 })
      .setOrigin(0.5).setResolution(3).setDepth(60).setScale(0.4);
    this.world.add(t);
    this.tweens.add({ targets: t, scale: 1, y: y - 36, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 250, onComplete: () => t.destroy() });
  }
}
