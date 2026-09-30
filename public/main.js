import { LEVEL, TILE, PLAYER_W, PLAYER_H, LEVEL_W, LEVEL_H } from '/shared/game.js';

const menu = document.getElementById('menu');
const nameInput = document.getElementById('name');
const gameEl = document.getElementById('game');
const touchEl = document.getElementById('touch');

// Virtual buttons feed the same input state as the keyboard.
const touch = { left: false, right: false, jump: false };
for (const b of touchEl.querySelectorAll('button')) {
  const k = b.dataset.k;
  const set = (v) => (e) => { e.preventDefault(); touch[k] = v; };
  b.addEventListener('pointerdown', set(true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, set(false));
}

class PlatformerScene extends Phaser.Scene {
  constructor() { super('main'); }

  create() {
    this.myId = null;
    this.players = new Map(); // id -> {box, sprite, label, tx, ty}
    this.lastSent = '';

    this.makeTextures();
    this.buildLevel();

    this.keys = this.input.keyboard.addKeys({
      left: 'LEFT', right: 'RIGHT', up: 'UP', space: 'SPACE', a: 'A', d: 'D', w: 'W',
    });
    this.status = this.add.text(8, 6, '', { font: '13px system-ui', color: '#fff' }).setScrollFactor(0).setDepth(100);

    this.connect();
  }

  // Placeholder art generated in code; replace with real spritesheets later via this.load.
  makeTextures() {
    const g = this.add.graphics();
    g.fillStyle(0x7a4b1e).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x3fae49).fillRect(0, 0, TILE, 6);
    g.lineStyle(1, 0x000000, 0.25).strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
    g.generateTexture('tile', TILE, TILE);
    g.clear();
    g.fillStyle(0xffffff).fillRect(0, 0, PLAYER_W, PLAYER_H);
    g.fillStyle(0xffffff).fillRect(14, 6, 6, 6);
    g.fillStyle(0x000000).fillRect(17, 8, 3, 3);
    g.generateTexture('player', PLAYER_W, PLAYER_H);
    g.destroy();
  }

  buildLevel() {
    this.cameras.main.setBackgroundColor('#87ceeb');
    this.cameras.main.setBounds(0, 0, LEVEL_W, LEVEL_H);
    LEVEL.forEach((row, ty) => [...row].forEach((c, tx) => {
      if (c === '#') this.add.image(tx * TILE, ty * TILE, 'tile').setOrigin(0);
    }));
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'join', name: nameInput.value }));
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 'welcome') this.myId = m.id;
      else if (m.t === 'state') this.applyState(m.p);
    };
    this.ws.onclose = () => { this.status.setText('Desconectado. Recarga la página.'); };
  }

  applyState(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let e = this.players.get(p.id);
      if (!e) {
        const sprite = this.add.image(0, 0, 'player').setOrigin(0).setTint(Phaser.Display.Color.HexStringToColor(p.color).color);
        const label = this.add.text(0, 0, p.name, { font: '12px system-ui', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1);
        e = { sprite, label, x: p.x, y: p.y };
        this.players.set(p.id, e);
        if (p.id === this.myId) this.cameras.main.startFollow(sprite, true, 0.1, 0.1);
      }
      e.tx = p.x; e.ty = p.y;
      if (p.f) e.sprite.setFlipX(p.f < 0);
    }
    for (const [id, e] of this.players) {
      if (!seen.has(id)) { e.sprite.destroy(); e.label.destroy(); this.players.delete(id); }
    }
  }

  update() {
    // Input -> server, only on change.
    const k = this.keys;
    const input = {
      left: k.left.isDown || k.a.isDown || touch.left,
      right: k.right.isDown || k.d.isDown || touch.right,
      jump: k.up.isDown || k.w.isDown || k.space.isDown || touch.jump,
    };
    const s = JSON.stringify(input);
    if (s !== this.lastSent && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ t: 'input', ...input }));
      this.lastSent = s;
    }

    // Smooth everyone toward the latest server position.
    for (const e of this.players.values()) {
      e.x += (e.tx - e.x) * 0.35;
      e.y += (e.ty - e.y) * 0.35;
      e.sprite.setPosition(e.x, e.y);
      e.label.setPosition(e.x + PLAYER_W / 2, e.y - 2);
    }
    if (this.ws.readyState === 1) this.status.setText(`Jugadores: ${this.players.size}`);
  }
}

function start() {
  menu.style.display = 'none';
  gameEl.style.display = 'block';
  if (matchMedia('(pointer: coarse)').matches) touchEl.style.display = 'flex';
  nameInput.blur();
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 416,
    pixelArt: true,
    scene: PlatformerScene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
}
document.getElementById('play').onclick = start;
nameInput.onkeydown = (e) => { if (e.key === 'Enter') start(); };
