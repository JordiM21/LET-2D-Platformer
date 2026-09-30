// Catapulta (client): renders the server's physics and handles slingshot aiming.
import { CAT, HILL } from '/shared/minigames.js';
import { S, GameHud, gradientTexture, screenBackground, damp, esc } from './common.js';
import { makeGameArt } from './gameart.js';
import { sfx } from '../audio.js';

const TEX = { wood: 'blk_wood', plank: 'blk_wood', stone: 'blk_stone', crown: 'crown' };

export class CatapultScene extends Phaser.Scene {
  constructor() { super('g-catapult'); }

  init(data) {
    this.ready = false;
    this.ui = data.ui; this.net = data.net; this.def = data.def; this.initData = data.init; this.hud = data.hud;
    this.myId = this.net.id;
  }

  create() {
    makeGameArt(this);
    gradientTexture(this, 'bg_cat', [[0, '#6EC3FF'], [0.6, '#BDE6FF'], [1, '#FFF1D6']]);
    this.world = this.add.layer();
    this.bg = screenBackground(this, 'bg_cat', this.world);
    this.cam = this.bg.cam;
    this.ui.showTouch(false);

    this.players = new Map(this.initData.players.map((p) => [p.id, { ...p, score: 0, cd: 0 }]));
    this.me = this.players.get(this.myId);
    this.team = this.me ? this.me.team : 0;

    this.drawScenery();
    this.bodies = new Map();
    for (const b of this.initData.bodies) this.addBody(b);

    this.fx = {
      dust: this.particles('p_puff', { speed: { min: 30, max: 140 }, scale: { start: 0.8, end: 0 }, alpha: { start: 0.9, end: 0 }, lifespan: 500, tint: [0xFFFFFF, 0xE8D7C0] }),
      chips: this.particles('p_leaf', { speed: { min: 80, max: 260 }, scale: { start: 1, end: 0.3 }, rotate: { min: 0, max: 360 }, gravityY: 700, lifespan: 800, tint: [0xD99A5B, 0xB87A45, 0xAEB6C8] }),
      confetti: this.particles('p_dot', { speed: { min: 180, max: 460 }, angle: { min: 220, max: 320 }, scale: { start: 1, end: 0.3 }, gravityY: 700, lifespan: 1300, tint: [0xFF5A5F, 0xFFC83D, 0x3CC7A8, 0x58B8F2, 0xB982FF] }),
      spark: this.particles('p_star', { speed: { min: 100, max: 300 }, scale: { start: 1.2, end: 0 }, lifespan: 700, tint: [0xFFC83D, 0xFFE27A, 0xFFFFFF] }),
    };

    // aiming
    this.aim = this.add.graphics().setDepth(40);
    this.band = this.add.graphics().setDepth(31);
    this.ghost = this.add.image(0, 0, `body_${this.me?.char || 'fox'}`).setScale(S * 0.8).setDepth(32).setVisible(false);
    this.cdRing = this.add.graphics().setDepth(41);
    this.world.add([this.aim, this.band, this.ghost, this.cdRing]);
    this.dragging = null; this.locked = true;
    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('pointerupoutside', (p) => this.onUp(p));

    this.onResize();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    this.hud.timer(this.initData.dur);
    this.crowns = [3, 3];
    this.renderHud();
    const tn = CAT.TEAMS[this.team];
    this.hud.center(`Eres del equipo <b style="color:${tn.color}">${tn.name}</b>`, 2600, 'small');
    this.hud.countdown(this.initData.countdown, () => { this.locked = false; });
    this.hud.bottom('<div class="ghint">👆 Arrastra hacia atrás y suelta para lanzarte</div>');
    this.ready = true;
  }

  particles(key, cfg) {
    const p = this.add.particles(0, 0, key, { emitting: false, ...cfg }).setDepth(35);
    this.world.add(p);
    return p;
  }

  drawScenery() {
    const g = this.add.graphics().setDepth(2);
    // far hills
    g.fillStyle(0x9ED9B0, 1);
    for (let x = -200; x < CAT.W + 200; x += 260) g.fillCircle(x, CAT.GROUND + 60, 200);
    // central hill
    g.fillStyle(0x5CC266, 1);
    g.beginPath(); g.moveTo(HILL[0][0], HILL[0][1]);
    for (const [x, y] of HILL) g.lineTo(x, y);
    g.closePath(); g.fillPath();
    g.fillStyle(0x92E46E, 1);
    g.beginPath(); g.moveTo(HILL[1][0], HILL[1][1]); g.lineTo(HILL[2][0], HILL[2][1]); g.lineTo(HILL[3][0], HILL[3][1]); g.lineTo(HILL[3][0], HILL[3][1] + 8); g.lineTo(HILL[2][0], HILL[2][1] + 8); g.lineTo(HILL[1][0], HILL[1][1] + 8); g.closePath(); g.fillPath();
    // ground
    g.fillStyle(0xC98A55, 1); g.fillRect(-400, CAT.GROUND, CAT.W + 800, 400);
    g.fillStyle(0x62C654, 1); g.fillRect(-400, CAT.GROUND - 2, CAT.W + 800, 14);
    g.fillStyle(0x92E46E, 1); g.fillRect(-400, CAT.GROUND - 2, CAT.W + 800, 4);
    this.world.add(g);
    // clouds
    for (let i = 0; i < 6; i++) {
      const cloud = this.add.graphics().setDepth(1);
      const cx = Math.random() * CAT.W, cy = 80 + Math.random() * 200, s = 0.7 + Math.random() * 0.8;
      cloud.fillStyle(0xFFFFFF, 0.9);
      for (const [dx, dy, r] of [[0, 0, 26], [30, -12, 32], [62, 0, 24], [30, 10, 26]]) cloud.fillCircle(dx * s, dy * s, r * s);
      cloud.setPosition(cx, cy);
      this.world.add(cloud);
      this.tweens.add({ targets: cloud, x: cx + 60, duration: 9000 + Math.random() * 6000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // slingshots + flags
    CAT.SLING.forEach((s, team) => {
      const sl = this.add.image(s.x, CAT.GROUND + 4, 'sling').setOrigin(0.5, 1).setScale(S * 1.2).setDepth(30);
      if (team === 1) sl.setFlipX(true);
      const fl = this.add.image(team === 0 ? 36 : CAT.W - 36, CAT.GROUND - 250, team === 0 ? 'flag_red' : 'flag_blue').setOrigin(0.5, 1).setScale(S * 1.6).setDepth(3);
      if (team === 1) fl.setFlipX(true);
      this.world.add([sl, fl]);
      this.tweens.add({ targets: fl, scaleX: fl.scaleX * 0.9, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const label = this.add.text(s.x, CAT.GROUND + 26, `${team === this.team ? '⭐ ' : ''}${CAT.TEAMS[team].name}`, {
        fontFamily: 'Fredoka, sans-serif', fontSize: '20px', fontStyle: '700', color: '#fff', backgroundColor: CAT.TEAMS[team].color, padding: { x: 10, y: 3 },
      }).setOrigin(0.5, 0).setResolution(2).setDepth(30);
      this.world.add(label);
    });
    this.myPulse = this.add.circle(CAT.SLING[this.team].x, CAT.SLING[this.team].y, CAT.MAX_PULL, 0xFFFFFF, 0.12).setDepth(29);
    this.world.add(this.myPulse);
    this.tweens.add({ targets: this.myPulse, scale: 0.85, alpha: 0.05, duration: 900, yoyo: true, repeat: -1 });
  }

  addBody(b) {
    let img;
    if (b.k === 'ball') {
      img = this.add.container(b.x, b.y);
      const body = this.add.image(0, 3, `body_${b.c || 'fox'}`).setScale(S * 0.85);
      img.add(body);
      img.trail = this.add.particles(0, 0, 'p_puff', { follow: img, scale: { start: 0.5, end: 0 }, alpha: { start: 0.6, end: 0 }, lifespan: 380, frequency: 30, tint: CAT.TEAMS[b.team].color === '#E0364F' ? 0xFFB3BD : 0xB3DAFF });
      img.trail.setDepth(33); this.world.add(img.trail);
      img.setDepth(34);
    } else {
      img = this.add.image(b.x, b.y, TEX[b.k] || 'blk_wood').setDepth(b.k === 'crown' ? 26 : 25);
      img.setDisplaySize(b.k === 'crown' ? b.w * 1.15 : b.w, b.k === 'crown' ? b.h * 1.25 : b.h);
      if (b.k === 'crown') {
        img.setTint(b.team === 0 ? 0xFFE0E4 : 0xE0F0FF);
        img.base = { sx: img.scaleX, sy: img.scaleY };
      }
    }
    img.setRotation(b.a);
    this.world.add(img);
    this.bodies.set(b.id, { img, k: b.k, team: b.team, tx: b.x, ty: b.y, ta: b.a });
  }

  removeBody(id) {
    const b = this.bodies.get(id);
    if (!b) return;
    this.bodies.delete(id);
    if (b.k === 'ball') { this.fx.dust.explode(10, b.img.x, b.img.y); b.img.trail.stop(); this.time.delayedCall(400, () => b.img.trail.destroy()); }
    this.tweens.add({ targets: b.img, alpha: 0, scale: 0, duration: 220, onComplete: () => b.img.destroy() });
  }

  onNet(m) {
    if (m.a !== 'f') return;
    for (const b of m.add) this.addBody(b);
    for (const id of m.rm) this.removeBody(id);
    for (const [id, x, y, a] of m.b) {
      const b = this.bodies.get(id);
      if (b) { b.tx = x; b.ty = y; b.ta = a; }
    }
    for (const ev of m.ev) this.onEvent(ev);
    this.hud.timer(m.tl);
    this.crowns = m.cr;
    for (const [id, score, cd] of m.sc) { const p = this.players.get(id); if (p) { p.score = score; p.cd = cd; } }
    this.renderHud();
  }

  onEvent(ev) {
    if (ev.e === 'fire') {
      if (ev.by === this.myId) { sfx.bounce(); } else sfx.jump();
    } else if (ev.e === 'thud') {
      this.fx.chips.explode(Math.min(10, 2 + Math.round(ev.s)), ev.x, ev.y);
      sfx.land(Math.min(1, ev.s / 10));
      if (ev.s > 8) this.cam.shake(120, 0.003);
    } else if (ev.e === 'hit') {
      const b = this.bodies.get(ev.id);
      if (b) this.tweens.add({ targets: b.img, scaleX: b.img.base.sx * 1.3, scaleY: b.img.base.sy * 0.75, duration: 80, yoyo: true });
    } else if (ev.e === 'crown') {
      this.fx.confetti.explode(50, ev.x, ev.y); this.fx.spark.explode(20, ev.x, ev.y);
      this.cam.shake(300, 0.01); sfx.discover();
      const who = this.players.get(ev.by);
      const lost = ev.team === this.team;
      this.hud.center(`👑 ${lost ? '¡Nos han tirado una corona!' : '¡Corona derribada!'}${who ? `<small>${esc(who.name)}</small>` : ''}`, 1600, lost ? 'small hot' : 'small');
    }
  }

  renderHud() {
    const [a, b] = this.crowns;
    this.hud.score(`<span style="color:${CAT.TEAMS[0].color}">${'👑'.repeat(a) || '—'}</span> <small>vs</small> <span style="color:${CAT.TEAMS[1].color}">${'👑'.repeat(b) || '—'}</span>`);
    const rows = [...this.players.values()].map((p) => ({ id: p.id, name: `${p.team ? '🔵' : '🔴'} ${p.name}`, score: p.score })).sort((x, y) => y.score - x.score);
    this.hud.board(rows, this.myId);
  }

  // --- aiming: drag anywhere, the pull is measured from where the finger went down
  worldPoint(p) { return this.cam.getWorldPoint(p.x, p.y); }
  onDown(p) {
    if (this.locked || !this.me || this.me.cd > 0.05) { if (this.me?.cd > 0.05) this.hud.center('⏳ ¡Espera un poquito!', 700, 'small'); return; }
    this.dragging = { start: this.worldPoint(p), pull: { x: 0, y: 0 } };
    this.ghost.setVisible(true);
    sfx.select();
  }
  onMove(p) {
    if (!this.dragging) return;
    const w = this.worldPoint(p), d = this.dragging;
    let dx = w.x - d.start.x, dy = w.y - d.start.y;
    const len = Math.hypot(dx, dy);
    if (len > CAT.MAX_PULL) { dx *= CAT.MAX_PULL / len; dy *= CAT.MAX_PULL / len; }
    d.pull = { x: dx, y: dy };
  }
  onUp() {
    const d = this.dragging;
    if (!d) return;
    this.dragging = null;
    this.ghost.setVisible(false); this.aim.clear(); this.band.clear();
    const len = Math.hypot(d.pull.x, d.pull.y);
    if (len < 18) return;
    const ang = Math.atan2(-d.pull.y, -d.pull.x);
    this.net.send({ t: 'g', a: 'fire', ang, pow: len / CAT.MAX_PULL });
    this.me.cd = 2.4;
  }

  drawAim() {
    this.aim.clear(); this.band.clear();
    if (!this.dragging) return;
    const s = CAT.SLING[this.team], d = this.dragging;
    const bx = s.x + d.pull.x, by = s.y + d.pull.y;
    this.ghost.setPosition(bx, by).setRotation(Math.atan2(d.pull.y, d.pull.x) * 0.1);
    this.band.lineStyle(7, 0x6E4428, 1);
    this.band.lineBetween(s.x - 16, s.y - 20, bx, by); this.band.lineBetween(s.x + 16, s.y - 20, bx, by);
    const len = Math.hypot(d.pull.x, d.pull.y), pow = len / CAT.MAX_PULL;
    if (len < 18) return;
    const ang = Math.atan2(-d.pull.y, -d.pull.x), v = pow * CAT.MAX_SPEED;
    let x = s.x, y = s.y, vx = Math.cos(ang) * v, vy = Math.sin(ang) * v;
    // show the first part of the arc only — the rest is up to you
    for (let i = 0; i < 26; i++) {
      for (let k = 0; k < 3; k++) { vy += CAT.GRAVITY_STEP; x += vx; y += vy; }
      this.aim.fillStyle(0xFFFFFF, 1 - i / 28);
      this.aim.fillCircle(x, y, 6 - i * 0.15);
    }
  }

  update(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const k = damp(16, dt);
    for (const b of this.bodies.values()) {
      const im = b.img;
      im.x += (b.tx - im.x) * k; im.y += (b.ty - im.y) * k;
      let da = b.ta - im.rotation; da = Math.atan2(Math.sin(da), Math.cos(da));
      im.rotation += da * k;
    }
    this.drawAim();
    // cooldown ring on my slingshot
    this.cdRing.clear();
    if (this.me && this.me.cd > 0) {
      this.me.cd = Math.max(0, this.me.cd - dt);
      const s = CAT.SLING[this.team];
      this.cdRing.lineStyle(8, 0xFFFFFF, 0.9);
      this.cdRing.beginPath(); this.cdRing.arc(s.x, s.y - 40, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.me.cd / 2.4)); this.cdRing.strokePath();
    }
  }

  onResize() {
    this.bg.size();
    const sw = this.scale.width, sh = this.scale.height;
    const z = Math.min(sw / CAT.W, sh / (CAT.H - 40));
    this.cam.setZoom(z).centerOn(CAT.W / 2, CAT.H / 2 - 10);
  }
}
