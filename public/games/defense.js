// Defensa del Castillo (client)
import { DEF, pathPoint } from '/shared/minigames.js';
import { S, gradientTexture, screenBackground, esc } from './common.js';
import { makeGameArt } from './gameart.js';
import { sfx } from '../audio.js';

export class DefenseScene extends Phaser.Scene {
  constructor() { super('g-defense'); }

  init(data) {
    this.ready = false;
    this.ui = data.ui; this.net = data.net; this.def = data.def; this.initData = data.init; this.hud = data.hud;
    this.myId = this.net.id;
  }

  create() {
    makeGameArt(this);
    gradientTexture(this, 'bg_def', [[0, '#8FD39A'], [1, '#62B56E']]);
    this.world = this.add.layer();
    this.bg = screenBackground(this, 'bg_def', this.world);
    this.cam = this.bg.cam;
    this.ui.showTouch(false);

    this.players = new Map(this.initData.players.map((p) => [p.id, { ...p, coins: 4, dmg: 0 }]));
    this.me = this.players.get(this.myId);
    this.lives = this.initData.lives; this.wave = 0; this.locked = true;

    this.drawMap();
    this.towers = DEF.SLOTS.map(([x, y], i) => this.makeTower(i, x, y));
    this.initData.towers.forEach(([lvl], i) => this.setTowerLevel(i, lvl, false));
    this.enemies = new Map();

    const P = (key, cfg, depth = 40) => { const p = this.add.particles(0, 0, key, { emitting: false, ...cfg }).setDepth(depth); this.world.add(p); return p; };
    this.fx = {
      pop: P('p_puff', { speed: { min: 60, max: 200 }, scale: { start: 0.9, end: 0 }, lifespan: 450 }),
      spark: P('p_star', { speed: { min: 80, max: 240 }, scale: { start: 1, end: 0 }, lifespan: 500, tint: [0xFFC83D, 0xFFFFFF] }),
      confetti: P('p_dot', { speed: { min: 160, max: 420 }, angle: { min: 220, max: 320 }, scale: { start: 1, end: 0.3 }, gravityY: 700, lifespan: 1200, tint: [0xFF5A5F, 0xFFC83D, 0x3CC7A8, 0x58B8F2, 0xB982FF] }),
    };

    this.input.on('pointerdown', (p) => this.onTap(p));
    this.onResize();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    this.hud.timer(null);
    this.renderHud();
    this.hud.countdown(this.initData.countdown, () => { this.locked = false; });
    if (this.me) this.hud.center('🗼 ¡Esa torre con tu personaje es la tuya!', 2600, 'small');
    this.ready = true;
  }

  drawMap() {
    const g = this.add.graphics().setDepth(2);
    const pts = DEF.PATH;
    const stroke = (w, col) => {
      g.lineStyle(w, col, 1);
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
      g.strokePath();
      for (const [x, y] of pts) g.fillStyle(col, 1).fillCircle(x, y, w / 2);
    };
    stroke(70, 0xB8864F); stroke(58, 0xE9C28A); stroke(8, 0xF3D6A8);
    this.world.add(g);
    // scenery from the world's art
    const deco = [['tree_round', 90, 690], ['tree_pine', 1230, 280], ['tree_fruit', 470, 110], ['bush', 700, 700], ['bush', 1210, 700], ['rock', 780, 520], ['tree_round', 1240, 150], ['bush', 60, 560], ['tree_pine', 40, 300]];
    for (const [k, x, y] of deco) this.world.add(this.add.image(x, y, k).setOrigin(0.5, 1).setScale(S * 0.8).setDepth(3 + y / 1000));
    for (let i = 0; i < 40; i++) {
      const f = this.add.image(Math.random() * DEF.W, Math.random() * DEF.H, `flower${i % 5}`).setScale(S * 0.8).setDepth(3).setAlpha(0.9);
      this.world.add(f);
    }
    // castle at the end + lives
    this.castle = this.add.image(DEF.CASTLE.x, DEF.CASTLE.y + 80, 'poi_arena').setOrigin(0.5, 1).setScale(S * 0.62).setDepth(4);
    this.world.add(this.castle);
    this.spawnPortal = this.add.circle(-10, DEF.PATH[0][1], 42, 0x3A3370, 0.6).setDepth(3);
    this.world.add(this.spawnPortal);
    this.tweens.add({ targets: this.spawnPortal, scale: 1.15, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
  }

  makeTower(i, x, y) {
    const slot = this.add.image(x, y, 'slot').setScale(S).setDepth(5 + y / 1000);
    const img = this.add.image(x, y + 6, 'tower1').setOrigin(0.5, 1).setScale(S).setDepth(10 + y / 1000).setVisible(false);
    const owner = this.initData.players.find((p) => p.slot === i && this.initData.towers[i][1] === p.id);
    const range = this.add.circle(x, y - 20, DEF.TOWER.range[0], 0xFFFFFF, 0.08).setStrokeStyle(2, 0xFFFFFF, 0.35).setDepth(4).setVisible(false);
    let face = null, label = null;
    if (owner) {
      face = this.add.image(x, y - 58, `body_${owner.char}`).setScale(S * 0.62).setDepth(11 + y / 1000);
      const mine = owner.id === this.myId;
      label = this.add.text(x, y + 10, owner.name, {
        fontFamily: 'Fredoka, sans-serif', fontSize: '13px', fontStyle: '600', color: mine ? '#fff' : '#1F1A3D',
        backgroundColor: mine ? '#CA4B15' : 'rgba(255,255,255,.85)', padding: { x: 6, y: 1 },
      }).setOrigin(0.5, 0).setResolution(3).setDepth(12);
      this.world.add([face, label]);
      if (mine) range.setVisible(true);
    }
    this.world.add([slot, range, img]);
    return { i, x, y, img, face, label, range, level: 0, owner: owner?.id ?? null, mine: owner?.id === this.myId };
  }

  setTowerLevel(i, lvl, animate = true) {
    const t = this.towers[i];
    if (!t || t.level === lvl) return;
    t.level = lvl;
    t.img.setVisible(lvl > 0);
    if (!lvl) return;
    t.img.setTexture(`tower${Math.min(5, lvl)}`);
    t.range.setRadius(DEF.TOWER.range[lvl - 1]);
    if (t.face) t.face.y = t.y - 58 - (lvl - 1);
    if (animate) {
      t.img.setScale(S * 0.6, S * 1.5);
      this.tweens.add({ targets: t.img, scaleX: S, scaleY: S, duration: 600, ease: 'Elastic.easeOut' });
      this.fx.spark.explode(16, t.x, t.y - 40);
      this.fx.confetti.explode(14, t.x, t.y - 40);
    }
  }

  onTap(p) {
    if (this.locked) return;
    const w = this.cam.getWorldPoint(p.x, p.y);
    // my tower? upgrade
    const mine = this.towers.find((t) => t.mine);
    if (mine && Math.hypot(w.x - mine.x, w.y - (mine.y - 30)) < 40) { this.upgrade(); return; }
    // nearest slime under the finger
    let best = null, bd = 1e9;
    for (const e of this.enemies.values()) {
      const d = Math.hypot(e.spr.x - w.x, e.spr.y - 16 - w.y);
      if (d < DEF.ENEMY[e.type].r + 26 && d < bd) { best = e; bd = d; }
    }
    if (!best) return;
    this.net.send({ t: 'g', a: 'tap', e: best.id });
    best.spr.setTintFill(0xFFFFFF);
    this.time.delayedCall(70, () => { if (best.spr.active) best.spr.clearTint(); });
    this.tweens.add({ targets: best.spr, scaleX: best.base * 1.3, scaleY: best.base * 0.7, duration: 70, yoyo: true });
    this.fx.spark.explode(4, w.x, w.y);
    sfx.tap();
  }

  upgrade() {
    const t = this.towers.find((tw) => tw.mine);
    if (!t || !this.me) return;
    if (t.level >= DEF.TOWER.cost.length) { this.hud.center('🌟 ¡Tu torre ya está al máximo!', 900, 'small'); return; }
    const cost = DEF.TOWER.cost[t.level];
    if (this.me.coins < cost) { this.hud.center(`🪙 Necesitas ${cost} monedas`, 900, 'small'); sfx.land(0.3); return; }
    this.net.send({ t: 'g', a: 'up' });
  }

  onNet(m) {
    if (m.a !== 's') return;
    const now = performance.now();
    const seen = new Set();
    for (const [id, type, d, hp, max] of m.e) {
      seen.add(id);
      let e = this.enemies.get(id);
      if (!e) {
        const base = S * DEF.ENEMY[type].r / 20;
        const spr = this.add.image(-40, 0, `en_${type}`).setOrigin(0.5, 0.95).setScale(0).setDepth(20);
        const bar = this.add.graphics().setDepth(21);
        this.world.add([spr, bar]);
        this.tweens.add({ targets: spr, scale: base, duration: 300, ease: 'Back.easeOut' });
        e = { id, type, spr, bar, base, d, at: now, hp, max, shown: d };
        this.enemies.set(id, e);
      }
      e.d = d; e.at = now; e.hp = hp; e.max = max;
    }
    for (const [id, e] of this.enemies) if (!seen.has(id)) this.killSprite(e, false);
    m.tw.forEach((lvl, i) => this.setTowerLevel(i, lvl));
    for (const [id, coins, dmg] of m.pl) { const p = this.players.get(id); if (p) { p.coins = coins; p.dmg = dmg; } }
    if (m.lives < this.lives) this.onLeak(this.lives - m.lives);
    this.lives = m.lives;
    if (m.wave !== this.wave) this.wave = m.wave;
    if (m.brk && m.brk !== this.brk) this.hud.center(`Siguiente oleada en ${m.brk}…`, 900, 'small');
    this.brk = m.brk;
    for (const ev of m.ev) this.onEvent(ev);
    this.renderHud();
  }

  onEvent(ev) {
    if (ev.e === 'shot') {
      const t = this.towers[ev.slot], e = this.enemies.get(ev.id);
      if (!t || !e) return;
      const b = this.add.image(t.x, t.y - 64, 'p_dot').setScale(S * 1.6).setTint(t.mine ? 0xFF7A3D : 0xFFE27A).setDepth(30);
      this.world.add(b);
      this.tweens.add({ targets: b, x: e.spr.x, y: e.spr.y - 14, duration: 140, onComplete: () => { b.destroy(); this.fx.spark.explode(2, e.spr.x, e.spr.y - 14); } });
      if (t.face) this.tweens.add({ targets: t.face, scaleY: S * 0.5, scaleX: S * 0.75, duration: 60, yoyo: true });
    } else if (ev.e === 'kill') {
      if (ev.by === this.myId) { this.coinPop(ev.x, ev.y - 20, ev.coin); sfx.star(3); }
    } else if (ev.e === 'wave') {
      this.hud.center(`🌊 ¡Oleada ${ev.w} de ${this.initData.waves}!${ev.bonus ? `<small>+${ev.bonus} 🪙 para todos</small>` : ''}`, 1800, ev.w === this.initData.waves ? 'hot' : '');
      if (ev.w === this.initData.waves) this.time.delayedCall(1900, () => this.hud.center('👑 ¡Cuidado con el Rey Slime!', 1800, 'small hot'));
      sfx.discover();
    } else if (ev.e === 'up') {
      if (ev.by === this.myId) { sfx.open(); this.hud.center(`🗼 ¡Torre nivel ${ev.level}!`, 900, 'small'); }
    }
  }

  coinPop(x, y, n) {
    const t = this.add.text(x, y, `+${n}🪙`, { fontFamily: 'Fredoka, sans-serif', fontSize: '18px', fontStyle: '700', color: '#FFC83D', stroke: '#1F1A3D', strokeThickness: 4 }).setOrigin(0.5).setResolution(3).setDepth(60);
    this.world.add(t);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  onLeak(n) {
    this.cam.shake(250, 0.01);
    this.tweens.add({ targets: this.castle, scaleX: this.castle.scaleX * 1.08, scaleY: this.castle.scaleY * 0.92, duration: 90, yoyo: true });
    this.fx.pop.explode(14, DEF.CASTLE.x, DEF.CASTLE.y);
    this.cam.flash(180, 255, 90, 95);
    sfx.poof();
  }

  killSprite(e, silent) {
    this.enemies.delete(e.id);
    if (!silent) { this.fx.pop.explode(10, e.spr.x, e.spr.y - 10); this.fx.spark.explode(5, e.spr.x, e.spr.y - 10); }
    e.bar.destroy();
    this.tweens.add({ targets: e.spr, scaleX: e.base * 1.6, scaleY: 0, alpha: 0, duration: 180, onComplete: () => e.spr.destroy() });
  }

  renderHud() {
    const hearts = `❤️ <b>${this.lives}</b>`;
    this.hud.score(`${hearts} <small>·</small> 🌊 <b>${this.wave}/${this.initData.waves}</b>`);
    const rows = [...this.players.values()].map((p) => ({ id: p.id, name: p.name, score: p.dmg })).sort((a, b) => b.score - a.score);
    this.hud.board(rows, this.myId);
    if (!this.me) return;
    const t = this.towers.find((tw) => tw.mine);
    const lvl = t ? t.level : 0, max = lvl >= DEF.TOWER.cost.length;
    const cost = max ? 0 : DEF.TOWER.cost[lvl], can = !max && this.me.coins >= cost;
    const html = `<div class="dbar"><span class="dcoins">🪙 <b>${this.me.coins}</b></span>
      <button class="btn ${can ? 'btn-primary' : ''} dup" id="dUp" ${max ? 'disabled' : ''}>${max ? '🌟 Nivel máximo' : `🗼 Mejorar torre · ${cost} 🪙`}</button>
      <span class="dlvl">Nivel <b>${lvl}</b></span></div>`;
    if (html !== this.lastBar) {
      this.lastBar = html;
      this.hud.bottom(html);
      const b = document.getElementById('dUp');
      if (b) b.onclick = (e) => { e.stopPropagation(); this.upgrade(); };
    }
  }

  update(time, deltaMs) {
    const now = performance.now();
    for (const e of this.enemies.values()) {
      const def = DEF.ENEMY[e.type];
      const d = e.d + (this.locked ? 0 : def.speed * Math.min(0.25, (now - e.at) / 1000));
      e.shown += (d - e.shown) * 0.3;
      const p = pathPoint(e.shown);
      const hop = Math.abs(Math.sin(time * 0.012 + e.id)) * 6;
      e.spr.setPosition(p.x, p.y - hop).setFlipX(p.dx < 0);
      e.spr.scaleY = e.base * (1 + Math.sin(time * 0.024 + e.id) * 0.08);
      e.bar.clear();
      if (e.hp < e.max) {
        const w = def.r * 1.8;
        e.bar.fillStyle(0x1F1A3D, 0.6).fillRoundedRect(p.x - w / 2 - 1, p.y - def.r * 2.1 - 1, w + 2, 7, 3);
        e.bar.fillStyle(0x5CC75A, 1).fillRoundedRect(p.x - w / 2, p.y - def.r * 2.1, w * Math.max(0, e.hp / e.max), 5, 2);
      }
      e.spr.setDepth(20 + p.y / 1000);
    }
    for (const t of this.towers) if (t.face) t.face.y = t.y - 58 - (t.level - 1) + Math.sin(time * 0.004 + t.i) * 2;
  }

  onResize() {
    this.bg.size();
    const sw = this.scale.width, sh = this.scale.height;
    const z = Math.min(sw / DEF.W, sh / (DEF.H + 110));
    this.cam.setZoom(z).centerOn(DEF.W / 2, DEF.H / 2 + 10);
  }
}
