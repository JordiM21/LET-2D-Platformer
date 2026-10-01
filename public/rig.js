// A character on screen: procedural animation (squash & stretch spring, run cycle, blink, lean).
// Driven by physics state only, so local and remote players animate identically.
import { PHYS, EMOTES, TILE, WORLD_MAP, ROWS } from '/shared/game.js';
import { RES } from './art.js';
import { BODY_W, BODY_BASE, eyesFor } from './characters.js';

const S = 1 / RES;

// full-body emotes, keyed by EMOTES index. Each returns pose offsets for time t (seconds into the act).
const ACTS = {
  4: { dur: 2.6, pose: (t) => { // dance: hop on the beat, sway, kick feet
    const b = Math.sin(t * 10);
    return { bob: -Math.abs(b) * 7, angle: Math.sin(t * 5) * 16, x: Math.sin(t * 5) * 4, sx: 1, sy: 1 + b * 0.08,
      fl: { x: -7, y: -3 - Math.max(0, b) * 7 }, fr: { x: 7, y: -3 - Math.max(0, -b) * 7 } };
  } },
  5: { dur: 3.4, pose: (t, f) => { // play dead: topple face-first (tails stay up), thud, lie still (one foot twitches), get back up
    const fall = Math.min(1, t / 0.3) ** 2, rise = Math.min(1, Math.max(0, (t - 3) / 0.4));
    const k = fall * (1 - rise);
    const thud = t > 0.3 && t < 0.7 ? Math.sin((t - 0.3) * 24) * (0.7 - t) * 12 : 0;
    const twitch = t > 1.6 && t < 2 ? Math.abs(Math.sin(t * 30)) * 4 : 0;
    return { bob: -15 * k, angle: (90 * k - thud) * f, x: 0, sx: 1, sy: 1 - (rise > 0 ? 0 : thud * 0.01), dead: k > 0.5,
      fl: { x: -6, y: -3 }, fr: { x: 6, y: -3 - twitch } };
  } },
};

export class Rig {
  // map: tile map for the ground shadow (the world by default; minigame arenas pass their own)
  constructor(scene, layer, char, name, isMe, map = WORLD_MAP) {
    this.map = map; this.rows = map.rows || ROWS;
    this.scene = scene; this.isMe = isMe;
    this.sx = 1; this.sy = 1; this.vsx = 0; this.vsy = 0; // spring state
    this.facing = 1; this.flip = 1; this.lean = 0;
    this.phase = 0; this.t = Math.random() * 10;
    this.blinkIn = 1 + Math.random() * 3; this.blink = 0;
    this.lastStep = 0;
    this.still = 0; // seconds standing still; long enough and they doze off

    this.shadow = scene.add.image(0, 0, 'shadow').setScale(S).setDepth(19);
    this.root = scene.add.container(0, 0).setDepth(isMe ? 31 : 30);
    this.rig = scene.add.container(0, 0);
    this.footL = scene.add.image(-6, -3, '').setScale(S);
    this.footR = scene.add.image(6, -3, '').setScale(S);
    this.body = scene.add.image(0, -2, '').setOrigin(0.5, BODY_BASE / 52).setScale(S);
    this.eyes = [0, 1].map(() => ({
      white: scene.add.image(0, 0, 'eye').setScale(S),
      pupil: scene.add.image(0, 0, 'pupil').setScale(S),
    }));
    this.rig.add([this.footL, this.footR, this.body, ...this.eyes.flatMap((e) => [e.white, e.pupil])]);
    this.label = scene.add.text(0, -54, name, {
      fontFamily: 'Fredoka, system-ui, sans-serif', fontSize: '13px', fontStyle: '600',
      color: isMe ? '#FFFFFF' : '#1F1A3D', backgroundColor: isMe ? '#CA4B15' : 'rgba(255,255,255,0.85)',
      padding: { x: 7, y: 2 },
    }).setOrigin(0.5, 1).setResolution(3);
    this.root.add([this.rig, this.label]);
    layer.add([this.shadow, this.root]);
    this.setChar(char);

    // spawn pop
    this.sx = 0.2; this.sy = 1.8;
  }

  setChar(char) {
    this.char = char;
    this.body.setTexture(`body_${char}`);
    this.footL.setTexture(`foot_${char}`); this.footR.setTexture(`foot_${char}`);
    this.eyePos = eyesFor(char).map(([x, y]) => [x - BODY_W / 2, y - BODY_BASE - 2]);
    this.kick(0.6, 1.4);
  }

  kick(sx, sy) { this.sx = sx; this.sy = sy; this.vsx = 0; this.vsy = 0; }

  // x = feet centre, y = feet bottom
  update(dt, x, y, vx, vy, onGround) {
    this.t += dt;
    // spring back to 1 with a little wobble
    // fixed substeps keep the spring stable on slow frames (a big dt would make it explode)
    const k = 520, d = 16, n = Math.min(12, Math.ceil(dt / (1 / 240)));
    for (let i = 0, h = dt / n; i < n; i++) {
      this.vsx += ((1 - this.sx) * k - this.vsx * d) * h; this.sx += this.vsx * h;
      this.vsy += ((1 - this.sy) * k - this.vsy * d) * h; this.sy += this.vsy * h;
    }

    if (Math.abs(vx) > 20) {
      const f = Math.sign(vx);
      if (f !== this.facing) { this.facing = f; this.sx *= 0.8; }
    }
    this.flip += (this.facing - this.flip) * Math.min(1, dt * 22);

    const speed = Math.abs(vx) / PHYS.maxRun;
    this.still = onGround && speed < 0.05 ? this.still + dt : 0;
    this.updateSleep();
    let bob = 0, breathe = 1, leanTarget = 0;
    let fl = { x: -6, y: -3 }, fr = { x: 6, y: -3 };
    if (!onGround) {
      const up = vy < 0;
      fl = { x: -7, y: up ? -1 : -5 }; fr = { x: 7, y: up ? -2 : -6 };
      leanTarget = Math.max(-1, Math.min(1, vy / 900)) * 6 * this.facing;
    } else if (speed > 0.08) {
      this.phase += dt * (10 + 8 * speed);
      const s = Math.sin(this.phase), c = Math.cos(this.phase);
      fl = { x: -6 + c * 4 * speed, y: -3 - Math.max(0, s) * 5 * speed };
      fr = { x: 6 - c * 4 * speed, y: -3 - Math.max(0, -s) * 5 * speed };
      bob = -Math.abs(s) * 3 * speed;
      leanTarget = vx / PHYS.maxRun * 8;
      const stepNow = Math.floor(this.phase / Math.PI);
      if (stepNow !== this.lastStep) { this.lastStep = stepNow; this.onStep?.(); }
    } else {
      breathe = 1 + Math.sin(this.t * 3.2) * 0.025;
    }
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 12);

    // stretch with vertical speed while airborne
    const air = onGround ? 0 : Math.min(0.22, Math.abs(vy) / 4200);
    let sy = this.sy * breathe * (1 + air), sx = this.sx / (1 + air * 0.8);

    // full-body emote overrides the idle pose; moving or jumping cancels it
    let ox = 0, angle = this.lean, dead = false;
    if (this.act) {
      this.act.t += dt;
      if (!onGround || speed > 0.08 || this.act.t > ACTS[this.act.e].dur) this.act = null;
      else {
        const p = ACTS[this.act.e].pose(this.act.t, this.facing);
        bob = p.bob; angle += p.angle; ox = p.x; sx *= p.sx; sy *= p.sy; fl = p.fl; fr = p.fr; dead = p.dead;
        this.still = 0;
      }
    }

    this.root.setPosition(x, y);
    this.rig.setPosition(ox, bob).setScale(sx * this.flip, sy).setAngle(angle);
    this.footL.setPosition(fl.x, fl.y); this.footR.setPosition(fr.x, fr.y);

    // eyes: blink + look where we're going
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) { this.blink = 0.14; this.blinkIn = 2 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt);
    const asleep = this.still > 14;
    const lid = asleep || dead ? 0.12 : this.blink > 0 ? 0.15 : 1;
    const lookY = onGround ? 0 : Math.max(-1.2, Math.min(1.4, vy / 500));
    this.eyePos.forEach(([ex, ey], i) => {
      const e = this.eyes[i];
      e.white.setPosition(ex, ey).setScale(S, S * lid);
      // bored after a few seconds: glance around
      const glance = this.still > 5 && !asleep ? Math.sin(this.t * 1.3) * 1.3 : 0;
      e.pupil.setPosition(ex + 1 + speed * 0.6 + glance, ey + 0.3 + lookY).setScale(S, S * lid);
    });

    // label stays upright and doesn't squash
    // (lying down lowers it instead of following the rotation offset)
    this.label.setY(dead ? -40 : -50 + bob - (sy - 1) * 20);

    // shadow on the ground below
    const col = Math.floor(x / TILE);
    let gy = null;
    for (let r = Math.max(0, Math.floor((y - 1) / TILE)); r < this.rows; r++) if (this.map.tileAt(col, r)) { gy = r * TILE; break; }
    if (gy === null) this.shadow.setVisible(false);
    else {
      const h = Math.max(0, gy - y), f = Math.max(0.25, 1 - h / 220);
      this.shadow.setVisible(this.root.visible).setPosition(x, gy + 1).setScale(S * f * (onGround ? sx : 1), S * f).setAlpha(f);
    }
  }

  updateSleep() {
    const sc = this.scene;
    if (this.still > 14 && !this.zzz) {
      this.zzz = sc.add.text(20, -30, '💤', { fontSize: '16px' }).setOrigin(0.5).setResolution(3).setScale(0);
      this.root.add(this.zzz);
      sc.tweens.add({ targets: this.zzz, scale: 1, duration: 400, ease: 'Back.easeOut' });
      sc.tweens.add({ targets: this.zzz, y: -42, x: 26, alpha: 0.4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (this.still === 0 && this.zzz) {
      const z = this.zzz; this.zzz = null;
      sc.tweens.killTweensOf(z);
      sc.tweens.add({ targets: z, scale: 0, duration: 150, onComplete: () => z.destroy() });
      this.kick(0.75, 1.3); // wake-up hop
    }
  }

  emote(e) {
    const sc = this.scene;
    if (this.bubble) this.bubble.destroy();
    const c = sc.add.container(0, -80);
    const bg = sc.add.image(0, 0, 'bubble').setScale(S * 1.1);
    const tx = sc.add.text(0, -2, EMOTES[e] || '👋', { fontSize: '22px' }).setOrigin(0.5).setResolution(3);
    c.add([bg, tx]).setScale(0);
    this.root.add(c);
    this.bubble = c;
    this.kick(1.25, 0.8);
    this.act = ACTS[e] ? { e, t: 0 } : null;
    this.still = 0; this.updateSleep();
    sc.tweens.add({ targets: c, scale: 1, y: -90, duration: 380, ease: 'Back.easeOut' });
    sc.tweens.add({ targets: tx, angle: { from: -12, to: 12 }, duration: 260, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    sc.tweens.add({
      targets: c, alpha: 0, y: -108, scale: 0.6, delay: 1900, duration: 320, ease: 'Quad.easeIn',
      onComplete: () => { c.destroy(); if (this.bubble === c) this.bubble = null; },
    });
  }

  setVisible(v) { this.root.setVisible(v); this.shadow.setVisible(v); }

  destroy() {
    this.scene.tweens.killTweensOf([this.zzz, this.bubble, ...(this.bubble?.list || [])].filter(Boolean));
    this.root.destroy(); this.shadow.destroy();
  }
}
