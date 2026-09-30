// Papa Caliente (client)
import { PLAYER_W, PLAYER_H } from '/shared/game.js';
import { ArenaScene, S, gradientTexture } from './common.js';
import { sfx } from '../audio.js';

export class PotatoScene extends ArenaScene {
  constructor() { super('g-potato'); }

  bgKey() {
    gradientTexture(this, 'bg_potato', [[0, '#FF9A3D'], [0.5, '#FFC86B'], [1, '#FFF1C9']]);
    return 'bg_potato';
  }

  setupGame() {
    this.holder = null; this.fuse = 0; this.fuseMax = 1; this.tagCd = 0;
    this.bomb = this.add.image(0, -100, 'bomb').setScale(S * 1.1).setDepth(50).setVisible(false);
    this.spark = this.add.particles(0, 0, 'p_star', {
      speed: { min: 30, max: 90 }, scale: { start: 0.6, end: 0 }, lifespan: 300, frequency: 45, tint: [0xFFC83D, 0xFF5A5F, 0xFFFFFF],
    }).setDepth(51);
    this.spark.stop();
    this.boomFx = this.add.particles(0, 0, 'p_puff', {
      speed: { min: 120, max: 420 }, scale: { start: 1.4, end: 0 }, lifespan: 700, tint: [0xFF5A5F, 0xFFC83D, 0x3A3370, 0xFF8A3D], emitting: false,
    }).setDepth(52);
    this.world.add([this.bomb, this.spark, this.boomFx]);
    this.hud.timer(null);
    this.hud.score('💣 Ronda <b>1</b>');
    this.renderAlive();
  }

  renderAlive() {
    const rows = [...this.players.values()].map((p) => ({ id: p.id, name: (p.gone ? '👻 ' : '') + p.name, score: p.gone ? '—' : '✓' }))
      .sort((a, b) => (a.score === '✓' ? -1 : 1) - (b.score === '✓' ? -1 : 1));
    this.hud.board(rows, this.myId);
  }

  onGame(m) {
    if (m.a === 'bomb') {
      const prev = this.holder;
      this.holder = m.holder; this.fuse = m.fuse; this.fuseMax = m.fuseMax;
      this.hud.score(`💣 Ronda <b>${m.round}</b>`);
      this.bomb.setVisible(true);
      this.tweens.add({ targets: this.bomb, scale: { from: S * 1.8, to: S * 1.1 }, duration: 300, ease: 'Back.easeOut' });
      const h = this.players.get(m.holder);
      if (h) h.rig.kick(1.4, 0.7);
      sfx.emote();
      if (m.holder === this.myId) this.hud.center('💣 ¡Tienes la bomba! ¡Pásala!', 1300, 'small hot');
      else if (m.from === this.myId) this.hud.center('😅 ¡Pasada!', 800, 'small');
      else if (prev === null) this.hud.center(`💣 ${h ? h.name : ''} tiene la bomba`, 1300, 'small');
    } else if (m.a === 'boom') {
      const v = this.players.get(m.v);
      this.holder = null;
      this.bomb.setVisible(false); this.spark.stop();
      if (v) {
        const p = this.posOf(v);
        this.boomFx.explode(40, p.x + PLAYER_W / 2, p.y + PLAYER_H / 2);
        this.fx.confetti.explode(20, p.x + PLAYER_W / 2, p.y);
        v.gone = 1;
      }
      this.cam.shake(350, 0.018); sfx.poof(); sfx.land(1);
      this.hud.center(m.v === this.myId ? '💥 ¡BOOM! Ahora eres un fantasma 👻' : `💥 ¡BOOM! ${v ? v.name : ''} explotó`, 1800, 'small');
      this.renderAlive();
    }
  }

  onPositionsExtra(m) {
    if (m.h !== undefined) this.holder = m.h;
    if (m.fu !== undefined) this.fuse = m.fu;
    this.renderAliveT = (this.renderAliveT || 0) + 1;
    if (this.renderAliveT % 20 === 0) this.renderAlive();
  }

  extraUpdate(dt, time) {
    this.fuse = Math.max(0, this.fuse - dt);
    const h = this.holder != null ? this.players.get(this.holder) : null;
    if (!h) { this.bomb.setVisible(false); this.spark.stop(); return; }
    const p = this.posOf(h);
    const hurry = this.fuse < 3;
    const bx = p.x + PLAYER_W / 2, by = p.y - 30 + Math.sin(time * (hurry ? 0.04 : 0.012)) * 3;
    this.bomb.setVisible(true).setPosition(bx, by);
    this.bomb.setTint(hurry && Math.floor(time / 120) % 2 ? 0xFF8888 : 0xFFFFFF);
    this.bomb.scaleX = this.bomb.scaleY = S * (1.1 + (hurry ? Math.abs(Math.sin(time * 0.02)) * 0.2 : 0));
    this.spark.setPosition(bx + 12, by - 16);
    if (!this.spark.emitting) this.spark.start();

    // hand it over: touch someone while you hold it
    if (this.holder === this.myId && !this.locked && time > this.tagCd) {
      const mx = this.myX + PLAYER_W / 2, my = this.myY + PLAYER_H / 2;
      for (const o of this.players.values()) {
        if (o.id === this.myId || o.gone || o.x == null) continue;
        if (Math.hypot(mx - (o.x + PLAYER_W / 2), my - (o.y + PLAYER_H / 2)) < 34) {
          this.tagCd = time + 250;
          this.net.send({ t: 'g', a: 'tag', v: o.id });
          break;
        }
      }
    }
  }
}
