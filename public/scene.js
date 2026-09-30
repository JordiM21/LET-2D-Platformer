import * as G from '/shared/game.js';
import { makeArt, makeWater, RES } from './art.js';
import { makeCharTextures } from './characters.js';
import { Rig } from './rig.js';
import { sfx } from './audio.js';

const { TILE, PLAYER_W, PLAYER_H, WORLD_W, WORLD_H, COLS, ROWS, tileAt } = G;
const S = 1 / RES;
const STEP = 1 / 120;          // fixed physics step
const INTERP_DELAY = 110;      // ms remote players are rendered behind real time
const GROUND_Y = G.BASE_ROW * TILE;
const BUILDING_H = { home: 150, plaza: 170, quests: 130, library: 160, arena: 150 };

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export class WorldScene extends Phaser.Scene {
  constructor() { super('world'); }

  init(data) { this.ui = data.ui; this.net = data.net; this.profile = data.profile; this.onReady = data.onReady; }

  create() {
    makeArt(this); makeWater(this); makeCharTextures(this, RES);
    this.bgLayer = this.add.layer();
    this.worldLayer = this.add.layer();
    this.bgCam = this.cameras.main;
    this.cam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.bgCam.ignore(this.worldLayer);
    this.cam.ignore(this.bgLayer);
    this.cam.setBounds(0, 0, WORLD_W, WORLD_H);

    this.buildParallax();
    this.buildTiles();
    this.buildDecor();
    this.buildPois();
    this.buildStars();
    this.buildFx();
    this.buildLife();

    // local player
    const s = G.spawnPoint(0);
    this.body = G.newBody(s.x, s.y);
    this.prevPos = { x: s.x, y: s.y };
    this.lastSafe = { x: s.x, y: s.y };
    this.acc = 0; this.jumpLatch = false; this.frozen = false; this.respawning = false;
    this.me = new Rig(this, this.worldLayer, this.profile.char, this.profile.name, true);
    this.me.onStep = () => { if (this.body.onGround) sfx.step(); };
    this.remotes = new Map();
    this.nearPoi = null; this.starCombo = 0; this.lastStarAt = 0; this.dustT = 0;
    this.sendT = 0; this.lastSent = ''; this.lastSentAt = 0; this.mapT = 0;

    this.zoomBoost = 1; this.baseZoom = 1;
    this.camX = s.x; this.camY = s.y - 40; this.lookX = 0; this.camGroundY = s.y;
    this.onResize();
    this.cam.centerOn(this.camX, this.camY);
    this.scale.on('resize', this.onResize, this);

    this.setupInput();
    this.setupNet();
    this.spawnFx(s.x + PLAYER_W / 2, s.y + PLAYER_H);
    this.onReady?.();
  }

  // ---------------------------------------------------------------- building the world
  w(obj) { this.worldLayer.add(obj); return obj; }
  img(x, y, key, depth = 10) { return this.w(this.add.image(x, y, key).setScale(S).setDepth(depth)); }

  buildParallax() {
    const L = this.bgLayer;
    this.sky = L.add(this.add.image(0, 0, 'sky').setOrigin(0));
    this.sunRays = L.add(this.add.image(0, 0, 'rays').setScale(S));
    this.sun = L.add(this.add.image(0, 0, 'sun').setScale(S));
    this.tweens.add({ targets: this.sun, scale: S * 1.06, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // anchor = texture unit row that sits at world ground level (+dy)
    this.layers = [
      { key: 'clouds', f: 0.06, anchor: 200, dy: -330, drift: 5 },
      { key: 'mountains', f: 0.14, anchor: 300, dy: -20 },
      { key: 'hills_far', f: 0.3, anchor: 150, dy: -10 },
      { key: 'hills_near', f: 0.5, anchor: 140, dy: 10 },
    ].map((l) => {
      l.tw = this.textures.get(l.key).getSourceImage().width / RES; // strip width in units
      l.imgs = [];
      return l;
    });
    this.birds = [];
    const r = rng(77);
    for (let i = 0; i < 5; i++) {
      const b = L.add(this.add.image(0, 0, 'bird').setScale(S * (0.7 + r() * 0.5)));
      b.u = r(); b.v = 0.08 + r() * 0.22; b.speed = 0.012 + r() * 0.014; b.ph = r() * 6;
      this.birds.push(b);
    }
  }

  buildTiles() {
    const solid = (c, r) => { const t = tileAt(c, r); return t === G.T_SOLID || t === G.T_BOUNCE; };
    const r = rng(5);
    this.pads = new Map();
    for (let row = 0; row < ROWS; row++) for (let c = 0; c < COLS; c++) {
      const t = tileAt(c, row), x = c * TILE, y = row * TILE;
      if (t === G.T_SOLID || t === G.T_BOUNCE) {
        const top = !solid(c, row - 1);
        let depth = 0; while (depth < 3 && solid(c, row - depth - 1)) depth++;
        let key;
        if (top) key = `t_1${solid(c - 1, row) ? 0 : 1}${solid(c + 1, row) ? 0 : 1}`;
        else if (depth >= 2) key = r() < 0.3 ? 't_deep2' : 't_deep';
        else key = `t_0${solid(c - 1, row) ? 0 : 1}${solid(c + 1, row) ? 0 : 1}`;
        if (key === 't_000' && r() < 0.3) key = 't_dirt2';
        // tiny overlap hides seams at fractional zoom
        this.w(this.add.image(x - 0.3, y - 0.3, key).setOrigin(0).setScale(S * (TILE + 0.6) / TILE).setDepth(20));
        if (t === G.T_BOUNCE) {
          const pad = this.img(x + TILE / 2, y + 6, 'pad', 21).setOrigin(0.5, 1);
          this.pads.set(c, pad);
          this.tweens.add({ targets: pad, scaleY: S * 0.92, scaleX: S * 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      } else if (t === G.T_ONEWAY) {
        const l = tileAt(c - 1, row) === G.T_ONEWAY, rr = tileAt(c + 1, row) === G.T_ONEWAY;
        const key = !l && !rr ? 'plank_s' : !l ? 'plank_l' : !rr ? 'plank_r' : 'plank_m';
        this.w(this.add.image(x - 0.3, y, key).setOrigin(0).setScale(S * (TILE + 0.6) / TILE, S).setDepth(20));
        if (!l || !rr) this.w(this.add.image(x + (l ? TILE - 5 : 5), y + 10, 'rope').setOrigin(0.5, 0).setScale(S, S * 3).setDepth(19).setAlpha(0.8));
      }
    }
    // water in every pit
    for (let c = 0; c < COLS; c++) {
      if (G.groundTop[c] !== null) continue;
      const wtr = this.w(this.add.tileSprite(c * TILE - 0.3, WORLD_H - 44, TILE * RES + 1, 64 * RES, 'water').setOrigin(0).setScale(S).setDepth(22));
      this.waters = this.waters || [];
      this.waters.push(wtr);
    }
  }

  buildDecor() {
    const r = rng(2024);
    const busy = new Set();
    for (const p of G.POIS) for (let c = p.col - Math.ceil(p.w / 2) - 1; c <= p.col + Math.ceil(p.w / 2) + 1; c++) busy.add(c);
    for (const c of [50, 193, 205]) busy.add(c);
    const flat = (c, n) => { for (let i = -n; i <= n; i++) if (G.groundTop[c + i] !== G.groundTop[c]) return false; return true; };
    this.tufts = []; this.flowers = []; this.trees = [];
    let nextTree = 3;
    for (let c = 1; c < COLS - 1; c++) {
      const top = G.groundTop[c];
      if (top === null) continue;
      const gy = top * TILE, x = c * TILE + TILE / 2;
      const forest = c > 176 && c < 212;
      if (c >= nextTree && !busy.has(c) && flat(c, 1) && c !== 212) {
        const key = forest ? (r() < 0.7 ? 'tree_pine' : 'tree_round') : (r() < 0.25 ? 'tree_fruit' : r() < 0.8 ? 'tree_round' : 'tree_pine');
        const t = this.img(x + (r() - 0.5) * 12, gy + 2, key, 6 + r()).setOrigin(0.5, 1);
        t.setScale(S * (0.8 + r() * 0.35));
        if (r() < 0.5) t.setFlipX(true);
        this.trees.push(t);
        nextTree = c + (forest ? 3 + Math.floor(r() * 3) : 7 + Math.floor(r() * 8));
      }
      if (!busy.has(c) && r() < 0.18) this.img(x + (r() - 0.5) * 20, gy + 3, 'bush', 8).setOrigin(0.5, 1).setScale(S * (0.8 + r() * 0.4));
      if (r() < 0.14 && !busy.has(c)) this.img(x, gy + 2, 'rock', 9).setOrigin(0.5, 1);
      for (let k = 0; k < 2; k++) {
        if (r() < 0.55) {
          const t = this.img(c * TILE + r() * TILE, gy + 2, 'tuft', 34).setOrigin(0.5, 1);
          t.bend = 0; t.ph = r() * 6; this.tufts.push(t);
        }
      }
      if (r() < 0.3) {
        const f = this.img(c * TILE + r() * TILE, gy + 2, `flower${Math.floor(r() * 5)}`, 11).setOrigin(0.5, 1);
        f.ph = r() * 6; f.bend = 0; this.flowers.push(f);
      }
    }
    // home fence and plaza furniture
    for (const c of [4, 5, 21, 22]) this.img(c * TILE, GROUND_Y + 2, 'fence', 9).setOrigin(0, 1);
    for (const c of [66, 77]) this.img(c * TILE, GROUND_Y + 2, 'lamp', 9).setOrigin(0.5, 1);
    this.fountain = this.img(60.5 * TILE, GROUND_Y + 2, 'fountain', 9).setOrigin(0.5, 1);
    // edge of the world sign
    const sx = 272 * TILE;
    this.img(sx, GROUND_Y + 2, 'sign', 9).setOrigin(0.5, 1);
    this.w(this.add.text(sx, GROUND_Y - 38, '🚧 ¡Pronto!', { fontFamily: 'Fredoka, sans-serif', fontSize: '11px', fontStyle: '600', color: '#1F1A3D' }).setOrigin(0.5).setResolution(3).setDepth(9));
  }

  buildPois() {
    this.poiViews = G.POIS.map((p) => {
      const h = BUILDING_H[p.id];
      const building = this.img(p.x, p.y + 2, `poi_${p.id}`, 12).setOrigin(0.5, 1);
      const markerY = p.y - h - 34;
      const marker = this.w(this.add.container(p.x, markerY).setDepth(40));
      const glow = this.add.image(0, 0, 'glow').setScale(S * 2.4).setAlpha(0.6);
      const bub = this.add.image(0, 0, 'bubble').setScale(S * 1.3);
      const icon = this.add.text(0, -3, p.icon, { fontSize: '26px' }).setOrigin(0.5).setResolution(3);
      const label = this.add.text(0, 30, p.name, {
        fontFamily: 'Fredoka, sans-serif', fontSize: '14px', fontStyle: '700', color: '#FFFFFF',
        backgroundColor: p.color, padding: { x: 9, y: 3 },
      }).setOrigin(0.5, 0).setResolution(3);
      marker.add([glow, bub, icon, label]);
      this.tweens.add({ targets: [bub, icon, glow], y: '-=7', duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: glow, alpha: 0.25, duration: 1500, yoyo: true, repeat: -1 });

      return { poi: p, building, marker, label, shown: false };
    });
  }

  buildStars() {
    this.stars = G.STARS.map((s) => {
      const glow = this.img(s.x, s.y, 'glow', 14).setAlpha(0.55).setScale(S * 0.9);
      const spr = this.img(s.x, s.y, 'star', 15);
      const ph = s.x * 0.01;
      this.tweens.add({ targets: [spr, glow], y: s.y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (ph * 400) % 900 });
      this.tweens.add({ targets: spr, scaleX: { from: S, to: S * 0.55 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (ph * 300) % 700 });
      return { ...s, spr, glow, alive: true };
    });
  }

  buildFx() {
    const P = (key, cfg) => this.w(this.add.particles(0, 0, key, { emitting: false, ...cfg }));
    this.fxDust = P('p_puff', {
      speed: { min: 20, max: 90 }, angle: { min: 180, max: 360 }, scale: { start: 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 }, lifespan: { min: 280, max: 480 }, gravityY: -60, tint: [0xFFFFFF, 0xF2E4D0],
    }).setDepth(33);
    this.fxSpark = P('p_star', {
      speed: { min: 90, max: 260 }, scale: { start: 0.9, end: 0 }, rotate: { start: 0, end: 360 },
      lifespan: { min: 380, max: 650 }, gravityY: 300, tint: [0xFFC83D, 0xFFE27A, 0xFFFFFF, 0xFF8A3D],
    }).setDepth(36);
    this.fxConfetti = P('p_dot', {
      speed: { min: 140, max: 380 }, angle: { min: 220, max: 320 }, scale: { start: 0.8, end: 0.2 },
      lifespan: { min: 700, max: 1200 }, gravityY: 700, rotate: { min: 0, max: 360 },
      tint: [0xFF5A5F, 0xFFC83D, 0x3CC7A8, 0x58B8F2, 0xB982FF, 0xCA4B15],
    }).setDepth(36);
    this.fxSplash = P('p_drop', {
      speed: { min: 120, max: 320 }, angle: { min: 240, max: 300 }, scale: { start: 1, end: 0.3 },
      lifespan: 700, gravityY: 900, tint: [0x9BDDFF, 0x58B8F2, 0xFFFFFF],
    }).setDepth(36);
    this.fxSmoke = P('p_puff', {
      speedY: { min: -30, max: -18 }, speedX: { min: 4, max: 14 }, scale: { start: 0.35, end: 1.3 },
      alpha: { start: 0.55, end: 0 }, lifespan: 2600, frequency: 420, emitting: true, tint: 0xEDEFF5,
    }).setDepth(5);
    const home = G.POIS[0];
    this.fxSmoke.setPosition(home.x - 90 + 136, home.y - 150 + 18);
    this.fxFountain = P('p_drop', {
      speedY: { min: -210, max: -160 }, speedX: { min: -40, max: 40 }, gravityY: 500, scale: { start: 0.8, end: 0.4 },
      lifespan: 780, frequency: 45, emitting: true, tint: [0x9BDDFF, 0xFFFFFF, 0x58B8F2],
    }).setDepth(10);
    this.fxFountain.setPosition(this.fountain.x, this.fountain.y - 50);
    this.fxLeaf = P('p_leaf', {
      speedX: { min: -30, max: 10 }, speedY: { min: 20, max: 45 }, rotate: { min: 0, max: 360 },
      lifespan: 4200, alpha: { start: 1, end: 0 }, tint: [0x5CC266, 0x8BE06B, 0xFFC83D],
    }).setDepth(16);
  }

  buildLife() {
    const r = rng(9);
    this.bflies = [];
    const tints = [0xFF8DBA, 0xFFC83D, 0x9C82FF, 0x58B8F2, 0xFF8A3D];
    for (let i = 0; i < 14; i++) {
      const f = this.flowers[Math.floor(r() * this.flowers.length)];
      const b = this.img(f.x, f.y - 30, 'bfly', 17).setTint(tints[i % tints.length]);
      b.home = { x: f.x, y: f.y - 36 }; b.ph = r() * 10; b.sp = 0.6 + r() * 0.6; b.flee = 0;
      this.bflies.push(b);
    }
  }

  // ---------------------------------------------------------------- input + net
  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,SPACE,A,D,W,S,E,ENTER');
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    kb.on('keydown', (e) => {
      if (this.ui.modalOpen) return;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code) && !e.repeat) this.jumpLatch = true;
      if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) this.interact();
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (n >= 0 && !e.repeat) this.sendEmote(n);
    });
    this.ui.onJump = () => { this.jumpLatch = true; };
    this.ui.onInteract = () => this.interact();
    this.ui.onEmote = (n) => this.sendEmote(n);
    this.ui.onCharChange = (c) => {
      this.profile.char = c; this.me.setChar(c); this.net.send({ t: 'char', char: c });
      this.fxConfetti.explode(24, this.body.x + PLAYER_W / 2, this.body.y);
    };
    this.ui.onModalClose = () => { this.frozen = false; this.jumpLatch = false; this.zoomTo(1); };
  }

  readInput() {
    if (this.frozen || this.respawning) return { left: false, right: false, jump: false, down: false };
    const k = this.keys, t = this.ui.touch;
    const held = k.UP.isDown || k.W.isDown || k.SPACE.isDown || t.jump;
    return {
      left: k.LEFT.isDown || k.A.isDown || t.left,
      right: k.RIGHT.isDown || k.D.isDown || t.right,
      down: k.DOWN.isDown || k.S.isDown || t.down,
      jump: held || this.jumpLatch,
    };
  }

  setupNet() {
    const net = this.net;
    net.on('welcome', (m) => {
      for (const r of this.remotes.values()) r.rig.destroy();
      this.remotes.clear();
      this.sendState(true);
    });
    net.on('state', (m) => this.onState(m.p));
    net.on('pos', (m) => { Object.assign(this.body, { x: m.x, y: m.y, vx: 0, vy: 0 }); this.prevPos = { x: m.x, y: m.y }; });
    net.on('emote', (m) => {
      const r = m.id === net.id ? { rig: this.me } : this.remotes.get(m.id);
      if (!r) return;
      r.rig.emote(m.e);
      if (m.id !== net.id) sfx.emote();
    });
    net.on('joined', (m) => { this.ui.toast(`<b>${esc(m.name)}</b> llegó al mundo 👋`); sfx.join(); });
    net.on('left', (m) => this.ui.toast(`<b>${esc(m.name)}</b> se fue. ¡Hasta pronto!`));
  }

  sendEmote(n) {
    const now = this.time.now;
    if (now - (this.lastEmote || 0) < 650) return;
    this.lastEmote = now;
    this.me.emote(n); sfx.emote();
    this.net.send({ t: 'emote', e: n });
    this.ui.bumpProgress('emotes');
  }

  sendState(tp = false) {
    const b = this.body;
    const msg = { t: 's', x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, vx: Math.round(b.vx), vy: Math.round(b.vy), g: b.onGround ? 1 : 0, f: this.me.facing };
    if (tp) msg.tp = 1;
    const key = `${msg.x},${msg.y},${msg.g},${msg.f}`;
    const now = this.time.now;
    if (!tp && key === this.lastSent && now - this.lastSentAt < 1000) return;
    this.lastSent = key; this.lastSentAt = now;
    this.net.send(msg);
  }

  onState(list) {
    const now = performance.now(), seen = new Set();
    this.online = list;
    for (const p of list) {
      if (p.id === this.net.id) continue;
      seen.add(p.id);
      let r = this.remotes.get(p.id);
      if (!r) {
        r = { rig: new Rig(this, this.worldLayer, p.c, p.n, false), buf: [], char: p.c, wasG: true, airVy: 0 };
        this.remotes.set(p.id, r);
        this.spawnFx(p.x + PLAYER_W / 2, p.y + PLAYER_H, true);
      }
      if (p.c !== r.char) { r.char = p.c; r.rig.setChar(p.c); }
      r.buf.push({ t: now, x: p.x, y: p.y, vx: p.vx, vy: p.vy, g: p.g });
      if (r.buf.length > 30) r.buf.shift();
    }
    for (const [id, r] of this.remotes) if (!seen.has(id)) {
      this.fxDust.explode(12, r.rig.root.x, r.rig.root.y - 12);
      r.rig.destroy(); this.remotes.delete(id);
    }
    this.ui.setOnline(list, this.net.id);
  }

  // ---------------------------------------------------------------- per-frame
  update(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const b = this.body;

    // fixed-step physics with render interpolation
    this.acc += dt;
    while (this.acc >= STEP) {
      this.prevPos.x = b.x; this.prevPos.y = b.y;
      const input = this.readInput();
      const ev = G.stepPlayer(b, input, STEP);
      if (input.jump) this.jumpLatch = false;
      this.onPhysicsEvents(ev);
      this.acc -= STEP;
    }
    const a = this.acc / STEP;
    const rx = this.prevPos.x + (b.x - this.prevPos.x) * a + PLAYER_W / 2;
    const ry = this.prevPos.y + (b.y - this.prevPos.y) * a + PLAYER_H;
    this.me.update(dt, rx, ry, b.vx, b.vy, b.onGround);

    // safe spot for respawns: fully on solid ground
    if (b.onGround && b.groundType === G.T_SOLID) {
      const r = Math.floor((b.y + PLAYER_H + 1) / TILE);
      if (tileAt(Math.floor((b.x - 8) / TILE), r) === G.T_SOLID && tileAt(Math.floor((b.x + PLAYER_W + 8) / TILE), r) === G.T_SOLID) {
        this.lastSafe.x = b.x; this.lastSafe.y = b.y;
      }
    }
    if (b.y > WORLD_H - 30 && !this.respawning) this.fallIntoWater();

    // run dust
    this.dustT -= dt;
    if (b.onGround && Math.abs(b.vx) > 160 && this.dustT <= 0) {
      this.dustT = 0.11;
      this.fxDust.emitParticleAt(rx - Math.sign(b.vx) * 8, ry - 2, 1);
    }

    this.updateRemotes(dt);
    this.updateCamera(dt, rx, ry);
    this.updateParallax(time);
    this.updateStars(rx, ry - PLAYER_H / 2);
    this.updatePois(rx, ry);
    this.updateLife(dt, time, rx, ry);

    this.sendT -= dt;
    if (this.sendT <= 0) { this.sendT = 0.05; this.sendState(); }
    this.mapT -= dt;
    if (this.mapT <= 0) {
      this.mapT = 0.1;
      this.ui.updateMap(rx / WORLD_W, [...this.remotes.values()].map((r) => ({ x: r.rig.root.x / WORLD_W, char: r.char })));
    }
  }

  onPhysicsEvents(ev) {
    const b = this.body, x = b.x + PLAYER_W / 2, y = b.y + PLAYER_H;
    if (ev.jump) {
      this.me.kick(0.7, 1.35); sfx.jump();
      this.fxDust.explode(5, x - 6, y); this.fxDust.explode(5, x + 6, y);
    }
    if (ev.land !== undefined && !ev.bounce) {
      const s = Math.min(1, ev.land / 900);
      this.me.kick(1 + 0.45 * s, 1 - 0.38 * s);
      this.fxDust.explode(Math.round(4 + 10 * s), x, y);
      sfx.land(s);
      if (s > 0.92) this.cam.shake(120, 0.004);
    }
    if (ev.bounce) {
      this.me.kick(0.6, 1.5); sfx.bounce();
      this.fxSpark.explode(10, x, y);
      this.cam.shake(140, 0.005);
      const pad = this.pads.get(Math.floor(x / TILE)) || this.pads.get(Math.floor(b.x / TILE)) || this.pads.get(Math.floor((b.x + PLAYER_W) / TILE));
      if (pad) {
        this.tweens.add({ targets: pad, scaleY: S * 0.45, scaleX: S * 1.35, duration: 70, yoyo: true, ease: 'Quad.easeOut',
          onComplete: () => this.tweens.add({ targets: pad, scaleY: S, scaleX: S, duration: 500, ease: 'Elastic.easeOut' }) });
      }
    }
    if (ev.turn) this.fxDust.explode(4, x, y);
    if (ev.bump) { this.me.kick(1.25, 0.8); sfx.land(0.3); }
  }

  fallIntoWater() {
    this.respawning = true;
    const b = this.body;
    this.fxSplash.explode(26, b.x + PLAYER_W / 2, WORLD_H - 40);
    sfx.poof();
    this.cam.shake(160, 0.004);
    this.me.setVisible(false);
    this.time.delayedCall(650, () => {
      Object.assign(b, { x: this.lastSafe.x, y: this.lastSafe.y - 4, vx: 0, vy: 0, onGround: false });
      this.prevPos = { x: b.x, y: b.y };
      this.me.setVisible(true);
      this.me.kick(0.2, 1.8);
      this.spawnFx(b.x + PLAYER_W / 2, b.y + PLAYER_H);
      this.sendState(true);
      this.respawning = false;
    });
  }

  spawnFx(x, y, quiet) {
    this.fxSpark.explode(14, x, y - 14);
    this.fxDust.explode(10, x, y);
    if (!quiet) sfx.appear();
  }

  updateRemotes(dt) {
    const rt = performance.now() - INTERP_DELAY;
    for (const r of this.remotes.values()) {
      const buf = r.buf;
      if (!buf.length) continue;
      while (buf.length >= 3 && buf[1].t <= rt) buf.shift();
      let s;
      if (buf.length >= 2 && buf[0].t <= rt) {
        const [p0, p1] = buf, k = Math.min(1, (rt - p0.t) / Math.max(1, p1.t - p0.t));
        s = { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k, vx: p1.vx, vy: p1.vy, g: p1.g };
      } else s = buf[buf.length - 1];
      if (!s.g) r.airVy = s.vy;
      if (s.g && !r.wasG) {
        const k = Math.min(1, r.airVy / 900);
        r.rig.kick(1 + 0.4 * k, 1 - 0.35 * k);
        this.fxDust.explode(Math.round(3 + 8 * k), s.x + PLAYER_W / 2, s.y + PLAYER_H);
      }
      if (!s.g && r.wasG && s.vy < -400) { r.rig.kick(0.7, 1.35); this.fxDust.explode(6, s.x + PLAYER_W / 2, s.y + PLAYER_H); }
      r.wasG = !!s.g;
      r.rig.update(dt, s.x + PLAYER_W / 2, s.y + PLAYER_H, s.vx, s.vy, !!s.g);
    }
  }

  updateCamera(dt, px, py) {
    const b = this.body;
    // look ahead in the direction of travel
    const lookTarget = Math.abs(b.vx) > 40 ? Math.sign(b.vx) * 90 : this.lookX * 0.98;
    this.lookX += (lookTarget - this.lookX) * damp(2.2, dt);
    // vertical: follow the ground you stand on; only chase jumps that leave the frame band
    if (b.onGround) this.camGroundY = py;
    else if (py < this.camGroundY - 170) this.camGroundY = py + 170;
    else if (py > this.camGroundY + 90) this.camGroundY = py - 90;
    const tx = px + this.lookX, ty = this.camGroundY - 70;
    this.camX += (tx - this.camX) * damp(7, dt);
    this.camY += (ty - this.camY) * damp(b.onGround ? 5 : 3.5, dt);
    this.cam.centerOn(this.camX, this.camY);
  }

  updateParallax(time) {
    const W = this.scale.width, H = this.scale.height, z = this.cam.zoom;
    const v = this.cam.worldView;
    const cx = v.centerX, cy = v.centerY;
    this.sky.setDisplaySize(W, H);
    this.sun.setPosition(W * 0.8, H * 0.2);
    this.sunRays.setPosition(W * 0.8, H * 0.2).setRotation(time * 0.00006);
    // strips of 1024px images wrapped by hand (TileSprite bleeds its edges when it wraps vertically)
    for (const l of this.layers) {
      const dw = l.tw * z;
      const need = Math.ceil(W / dw) + 1;
      while (l.imgs.length < need) l.imgs.push(this.bgLayer.add(this.add.image(0, 0, l.key).setOrigin(0, 0)));
      const shift = cx * l.f * z + (l.drift ? time * 0.001 * l.drift * z : 0);
      const off = -(((shift % dw) + dw) % dw);
      const y = H / 2 + (GROUND_Y + l.dy - cy) * l.f * z - l.anchor * z;
      l.imgs.forEach((im, i) => im.setScale((z / RES) * 1.003).setPosition(Math.floor(off + i * dw), y).setVisible(i < need));
    }
    for (const bd of this.birds) {
      bd.u -= bd.speed * 0.016;
      if (bd.u < -0.1) bd.u = 1.1;
      bd.setPosition(bd.u * W, H * bd.v + Math.sin(time * 0.002 + bd.ph) * 8);
      bd.scaleY = bd.scaleX * (0.4 + Math.abs(Math.sin(time * 0.012 + bd.ph)) * 0.8);
    }
  }

  updateStars(px, py) {
    for (const s of this.stars) {
      if (!s.alive) continue;
      const dx = s.x - px, dy = s.y - py;
      if (dx * dx + dy * dy > 26 * 26) continue;
      s.alive = false;
      const now = this.time.now;
      this.starCombo = now - this.lastStarAt < 1500 ? this.starCombo + 1 : 0;
      this.lastStarAt = now;
      sfx.star(this.starCombo);
      this.fxSpark.explode(12, s.x, s.y);
      const plus = this.w(this.add.text(s.x, s.y - 10, '+1', {
        fontFamily: 'Fredoka, sans-serif', fontSize: '16px', fontStyle: '700', color: '#FFC83D', stroke: '#8A310A', strokeThickness: 4,
      }).setOrigin(0.5).setResolution(3).setDepth(37).setScale(0.4));
      this.tweens.add({ targets: plus, scale: 1 + Math.min(this.starCombo, 5) * 0.12, y: s.y - 44, duration: 420, ease: 'Back.easeOut' });
      this.tweens.add({ targets: plus, alpha: 0, delay: 450, duration: 250, onComplete: () => plus.destroy() });
      this.tweens.add({ targets: [s.spr, s.glow], scale: S * 1.8, alpha: 0, duration: 220, ease: 'Quad.easeOut' });
      const v = this.cam.worldView, z = this.cam.zoom;
      this.ui.collectStar((s.x - v.x) * z, (s.y - v.y) * z);
      this.time.delayedCall(40000, () => {
        s.alive = true;
        s.spr.setAlpha(1).setScale(0); s.glow.setAlpha(0.55).setScale(S * 0.9);
        this.tweens.add({ targets: s.spr, scale: S, duration: 500, ease: 'Back.easeOut' });
      });
    }
  }

  updatePois(px, py) {
    let near = null;
    for (const pv of this.poiViews) {
      const p = pv.poi;
      const inside = Math.abs(px - p.x) < (p.w / 2) * TILE && py > p.y - 90 && py <= p.y + 4;
      if (inside) near = pv;
      if (inside !== pv.shown) {
        pv.shown = inside;
        this.tweens.add({ targets: pv.marker, scale: inside ? 1.18 : 1, duration: 380, ease: 'Back.easeOut' });
        if (inside) {
          sfx.near();
          this.tweens.add({ targets: pv.building, scaleY: S * 1.04, scaleX: S * 0.98, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
          if (this.ui.discover(p)) this.fxConfetti.explode(40, p.x, p.y - BUILDING_H[p.id] - 20);
        }
      }
    }
    this.nearPoi = near?.poi || null;
    this.ui.setNear(this.nearPoi);
  }

  interact() {
    if (!this.nearPoi || this.frozen || this.ui.modalOpen) return;
    this.frozen = true;
    this.me.kick(1.2, 0.85);
    this.ui.openPoi(this.nearPoi, { online: this.online || [], myId: this.net.id });
    this.zoomTo(1.15);
  }

  // gentle camera push-in while a place is open
  zoomTo(v) {
    this.tweens.killTweensOf(this);
    this.tweens.add({
      targets: this, zoomBoost: v, duration: v > 1 ? 600 : 450, ease: v > 1 ? 'Cubic.easeOut' : 'Back.easeOut',
      onUpdate: () => this.cam.setZoom(this.baseZoom * this.zoomBoost),
    });
  }

  updateLife(dt, time, px, py) {
    const v = this.cam.worldView;
    const left = v.x - 60, right = v.right + 60;
    const bodies = [{ x: px, y: py }];
    for (const r of this.remotes.values()) bodies.push({ x: r.rig.root.x, y: r.rig.root.y });
    const t = time * 0.001;
    for (const tf of this.tufts) {
      if (tf.x < left || tf.x > right) continue;
      let target = Math.sin(t * 1.8 + tf.ph) * 5;
      for (const bd of bodies) {
        const dx = tf.x - bd.x, dy = tf.y - bd.y;
        if (Math.abs(dx) < 26 && Math.abs(dy) < 20) target = Math.sign(dx || 1) * 35 * (1 - Math.abs(dx) / 26);
      }
      tf.bend += (target - tf.bend) * damp(12, dt);
      tf.angle = tf.bend;
    }
    for (const f of this.flowers) {
      if (f.x < left || f.x > right) continue;
      let target = Math.sin(t * 1.3 + f.ph) * 6;
      for (const bd of bodies) {
        const dx = f.x - bd.x;
        if (Math.abs(dx) < 20 && Math.abs(f.y - bd.y) < 20) target = Math.sign(dx || 1) * 30;
      }
      f.bend += (target - f.bend) * damp(8, dt);
      f.angle = f.bend;
    }
    for (const bf of this.bflies) {
      const dxp = bf.x - px, dyp = bf.y - py;
      if (dxp * dxp + dyp * dyp < 60 * 60) bf.flee = 1.2;
      bf.flee = Math.max(0, bf.flee - dt);
      const tt = t * bf.sp + bf.ph;
      const tx = bf.home.x + Math.sin(tt) * 40 + Math.sin(tt * 2.3) * 12 + (bf.flee ? Math.sign(dxp || 1) * 50 : 0);
      const ty = bf.home.y + Math.sin(tt * 1.7) * 18 - (bf.flee ? 50 : 0);
      bf.x += (tx - bf.x) * damp(bf.flee ? 4 : 1.6, dt);
      bf.y += (ty - bf.y) * damp(bf.flee ? 4 : 1.6, dt);
      bf.scaleX = S * (0.25 + Math.abs(Math.sin(time * 0.025 + bf.ph)) * 0.75);
    }
    if (Math.random() < dt * 1.5) {
      const vis = this.trees.filter((tr) => tr.x > left && tr.x < right);
      if (vis.length) { const tr = vis[Math.floor(Math.random() * vis.length)]; this.fxLeaf.emitParticleAt(tr.x + (Math.random() - 0.5) * 50, tr.y - 90, 1); }
    }
    if (this.waters) for (const wt of this.waters) wt.tilePositionX = time * 0.03;
  }

  onResize() {
    const W = this.scale.width, H = this.scale.height;
    // phones in landscape get a closer camera so characters stay big enough to read
    let z = Phaser.Math.Clamp(H / (H < 500 ? 400 : 540), 0.8, 2.2);
    z = Math.max(z, H / WORLD_H, W / WORLD_W);
    this.baseZoom = z;
    this.cam.setSize(W, H).setZoom(z * this.zoomBoost);
    this.bgCam.setSize(W, H);
  }
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); }
