// Lluvia de Estrellas (client)
import { PLAYER_W, PLAYER_H } from '/shared/game.js';
import { starPos, starLandTime, STAR_LIFE_LANDED, ARENA_W, ARENA_H } from '/shared/minigames.js';
import { ArenaScene, S, gradientTexture } from './common.js';
import { sfx } from '../audio.js';

export class StarsScene extends ArenaScene {
  constructor() { super('g-stars'); }

  bgKey() {
    gradientTexture(this, 'bg_stars', [[0, '#2B1E6B'], [0.55, '#6B48C9'], [1, '#F2A1D8']]);
    return 'bg_stars';
  }

  setupGame() {
    this.stars = new Map();
    this.scores = new Map([...this.players.keys()].map((id) => [id, 0]));
    this.stompCd = new Map();
    // twinkling sky
    for (let i = 0; i < 40; i++) {
      const s = this.add.image(Math.random() * ARENA_W, Math.random() * ARENA_H * 0.7, 'bgstar').setScale(S * (0.5 + Math.random())).setDepth(1).setAlpha(0.6);
      this.world.add(s);
      this.tweens.add({ targets: s, alpha: 0.15, duration: 700 + Math.random() * 1500, yoyo: true, repeat: -1, delay: Math.random() * 1500 });
    }
    this.hud.timer(this.initData.dur);
    this.renderScores();
  }

  addStar(s) {
    const spr = this.add.image(0, -40, s.big ? 'bigstar' : 'star').setScale(S * (s.big ? 1 : 0.9)).setDepth(25);
    const glow = this.add.image(0, -40, 'glow').setScale(S * (s.big ? 1.4 : 0.8)).setAlpha(0.5).setDepth(24);
    this.world.add([glow, spr]);
    const born = performance.now();
    const st = { s, spr, glow, born, dies: starLandTime(s) + STAR_LIFE_LANDED, picked: false, wasLanded: false };
    this.stars.set(s.id, st);
    if (s.kind === 'drop') { spr.setScale(0); this.tweens.add({ targets: spr, scale: S * 0.9, duration: 250, ease: 'Back.easeOut' }); }
  }

  removeStar(id, burst) {
    const st = this.stars.get(id);
    if (!st) return;
    this.stars.delete(id);
    if (burst) this.fx.spark.explode(st.s.big ? 18 : 9, st.spr.x, st.spr.y);
    this.tweens.add({ targets: [st.spr, st.glow], scale: S * 1.8, alpha: 0, duration: 200, onComplete: () => { st.spr.destroy(); st.glow.destroy(); } });
  }

  onGame(m) {
    if (m.a === 'star') this.addStar(m.s);
    else if (m.a === 'pick') {
      this.scores.set(m.by, m.score);
      const st = this.stars.get(m.s);
      if (st) {
        if (m.by === this.myId) { if (!st.picked) sfx.star(m.big ? 6 : 2); this.floatText(st.spr.x, st.spr.y - 10, m.big ? '+5' : '+1', m.big ? '#FF8DE8' : '#FFC83D'); }
        this.removeStar(m.s, true);
      }
      this.renderScores();
    } else if (m.a === 'stomp') {
      this.scores.set(m.v, m.vScore);
      const v = this.players.get(m.v);
      if (v) {
        v.rig.kick(1.6, 0.45);
        const p = this.posOf(v);
        this.fx.spark.explode(12, p.x + PLAYER_W / 2, p.y);
        if (m.loss) this.floatText(p.x + PLAYER_W / 2, p.y - 20, `-${m.loss}`, '#FF5A5F');
      }
      for (const s of m.stars) this.addStar(s);
      if (m.v === this.myId) {
        this.stunnedUntil = this.time.now + 1300;
        this.cam.shake(200, 0.008); sfx.poof();
        this.hud.center('💫 ¡Te han pisado!', 1100, 'small');
      } else if (m.by === this.myId) sfx.bounce();
      this.renderScores();
    }
  }

  renderScores() {
    const rows = [...this.players.values()].map((p) => ({ id: p.id, name: p.name, score: this.scores.get(p.id) || 0 })).sort((a, b) => b.score - a.score);
    this.hud.board(rows, this.myId);
    this.hud.score(`⭐ <b>${this.scores.get(this.myId) || 0}</b>`);
  }

  // stomp: landing on someone's head while falling
  afterStep(ev, prevVy) {
    if (this.locked || prevVy < 120 || !this.body) return;
    const b = this.body, feet = b.y + PLAYER_H, cx = b.x + PLAYER_W / 2;
    for (const p of this.players.values()) {
      if (p.id === this.myId || p.stun || p.x == null) continue;
      if (Math.abs(cx - (p.x + PLAYER_W / 2)) > 22 || feet < p.y - 4 || feet > p.y + 14) continue;
      if ((this.stompCd.get(p.id) || 0) > this.time.now) continue;
      this.stompCd.set(p.id, this.time.now + 600);
      b.vy = -620; b.jumping = false; b.onGround = false;
      this.me.rig.kick(0.65, 1.45);
      this.fx.dust.explode(8, cx, feet);
      this.net.send({ t: 'g', a: 'stomp', v: p.id });
      break;
    }
  }

  extraUpdate(dt, time) {
    const now = performance.now();
    const cx = (this.myX ?? -999) + PLAYER_W / 2, cy = (this.myY ?? -999) + PLAYER_H / 2;
    for (const st of this.stars.values()) {
      const t = (now - st.born) / 1000;
      const p = starPos(st.s, t);
      st.spr.setPosition(p.x, p.y); st.glow.setPosition(p.x, p.y);
      if (p.landed && !st.wasLanded) { st.wasLanded = true; this.tweens.add({ targets: st.spr, scaleY: S * 0.6, duration: 90, yoyo: true }); }
      if (!p.landed) st.spr.rotation = Math.sin(time * 0.004 + st.s.id) * 0.3;
      if (t > st.dies - 1.5) st.spr.setAlpha(Math.floor(time / 100) % 2 ? 0.3 : 1);
      if (t > st.dies + 0.3) { this.removeStar(st.s.id, false); continue; }
      if (!st.picked && !this.locked && Math.hypot(p.x - cx, p.y - cy) < (st.s.big ? 32 : 26)) {
        st.picked = true;
        st.spr.setAlpha(0.35);
        sfx.star(st.s.big ? 6 : 2);
        this.net.send({ t: 'g', a: 'pick', s: st.s.id });
      }
    }
  }
}
