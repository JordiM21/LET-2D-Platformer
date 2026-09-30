// Character art drawn with Canvas2D so the same code feeds the menu previews and the Phaser textures.
// All coordinates are in "units" (1 unit = 1 world px); callers scale the context for resolution.
import { CHARACTERS } from '/shared/game.js';

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

// Body texture box and where its bottom-centre sits.
export const BODY_W = 48, BODY_H = 52, BODY_BASE = 50;

// Eye centres in body-texture units, facing right.
const EYES = {
  fox: [[21, 29], [31, 29]],
  frog: [[18, 20], [31, 20]],
  cat: [[21, 29], [31, 29]],
  bunny: [[21, 29], [31, 29]],
  dino: [[22, 28], [32, 28]],
  robot: [[20, 29], [31, 29]],
};
export function eyesFor(id) { return EYES[id] || EYES.fox; }

const NAVY = '#1F1A3D';

function blob(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r * 0.8);
  ctx.arcTo(x, y + h, x, y, r * 0.8);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}
function tri(ctx, a, b, c) {
  ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.closePath();
}

export function drawBody(ctx, ch) {
  const { id, body, belly, dark, cheek } = ch;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // --- behind the body: tails and back features
  if (id === 'fox') {
    ctx.fillStyle = body; ellipse(ctx, 8, 38, 10, 6, -0.7); ctx.fill();
    ctx.fillStyle = '#FFF7EE'; ellipse(ctx, 2.5, 32.5, 4.2, 3.2, -0.7); ctx.fill();
  }
  if (id === 'cat') {
    ctx.strokeStyle = body; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(12, 44); ctx.quadraticCurveTo(0, 42, 4, 28); ctx.stroke();
  }
  if (id === 'dino') {
    ctx.fillStyle = body; tri(ctx, [12, 36], [0, 44], [14, 47]); ctx.fill();
    ctx.fillStyle = dark;
    for (const [x, y] of [[13, 25], [17, 20], [22, 17]]) { tri(ctx, [x - 4, y + 3], [x - 1, y - 6], [x + 3, y + 1]); ctx.fill(); }
  }
  if (id === 'bunny') {
    for (const [x, rot] of [[18, -0.18], [29, 0.12]]) {
      ctx.fillStyle = body; ellipse(ctx, x, 10, 4.5, 12, rot); ctx.fill();
      ctx.fillStyle = '#FFD0E2'; ellipse(ctx, x, 11, 2.2, 8.5, rot); ctx.fill();
    }
  }
  if (id === 'robot') {
    ctx.strokeStyle = dark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(25, 18); ctx.lineTo(25, 9); ctx.stroke();
    ctx.fillStyle = '#FF5A5F'; ellipse(ctx, 25, 7.5, 3.4, 3.4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ellipse(ctx, 24, 6.5, 1.1, 1.1); ctx.fill();
  }
  if (id === 'fox' || id === 'cat') {
    const inner = id === 'fox' ? NAVY : '#FFC0D6';
    for (const s of [0, 1]) {
      const ear = s ? [[27, 19], [35, 5], [38, 22]] : [[11, 22], [15, 5], [23, 18]];
      ctx.fillStyle = body; tri(ctx, ...ear); ctx.fill();
      const [a, b, c] = ear;
      const mid = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      ctx.fillStyle = inner;
      tri(ctx, mid(a, b, id === 'fox' ? 0.55 : 0.3), b, mid(c, b, id === 'fox' ? 0.55 : 0.3)); ctx.fill();
    }
  }

  // --- body blob with a soft bottom shade
  const r = id === 'robot' ? 8 : 14;
  if (id === 'frog') {
    ctx.fillStyle = body;
    ellipse(ctx, 18, 21, 7.5, 7); ctx.fill();
    ellipse(ctx, 31, 21, 7.5, 7); ctx.fill();
  }
  ctx.fillStyle = body; blob(ctx, 9, 18, 31, 32, r); ctx.fill();
  ctx.save(); blob(ctx, 9, 18, 31, 32, r); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ellipse(ctx, 24, 54, 22, 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ellipse(ctx, 17, 22, 7, 4, -0.4); ctx.fill();
  // belly
  ctx.fillStyle = belly;
  if (id === 'robot') { blob(ctx, 16, 38, 17, 9, 3); ctx.fill(); }
  else { ellipse(ctx, 26, 42, 10, 8); ctx.fill(); }
  ctx.restore();

  // --- face details
  if (id === 'robot') {
    ctx.fillStyle = NAVY; blob(ctx, 14, 22, 24, 14, 5); ctx.fill();
    ctx.fillStyle = '#FFC83D'; ellipse(ctx, 20, 42.5, 1.6, 1.6); ctx.fill();
    ctx.fillStyle = '#FF5A5F'; ellipse(ctx, 25, 42.5, 1.6, 1.6); ctx.fill();
    ctx.fillStyle = '#3CE0A0'; ellipse(ctx, 30, 42.5, 1.6, 1.6); ctx.fill();
  }
  if (id === 'cat') {
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6;
    for (const x of [20, 24, 28]) { ctx.beginPath(); ctx.moveTo(x, 19); ctx.lineTo(x, 23); ctx.stroke(); }
  }
  if (id !== 'robot') {
    ctx.globalAlpha = 0.55; ctx.fillStyle = cheek;
    ellipse(ctx, 17.5, 35, 3, 2); ctx.fill();
    ellipse(ctx, 35.5, 35, 3, 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // nose / mouth
  if (id === 'fox' || id === 'cat' || id === 'bunny') {
    ctx.fillStyle = id === 'fox' ? NAVY : '#FF6F9C';
    ellipse(ctx, 27, 33.3, 1.8, 1.3); ctx.fill();
  }
  ctx.strokeStyle = NAVY; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (id === 'frog') ctx.arc(26, 30, 7, 0.25 * Math.PI, 0.75 * Math.PI);
  else if (id === 'robot') { ctx.strokeStyle = '#3CE0FF'; ctx.moveTo(22, 34); ctx.quadraticCurveTo(26, 36, 30, 34); }
  else ctx.arc(27, 34, 2.8, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  if (id === 'bunny') { ctx.fillStyle = '#fff'; ctx.fillRect(25.6, 36.2, 2.8, 2.4); }
  if (id === 'cat') {
    ctx.strokeStyle = 'rgba(31,26,61,.6)'; ctx.lineWidth = 1;
    for (const dy of [-1.2, 1.2]) { ctx.beginPath(); ctx.moveTo(35, 33 + dy); ctx.lineTo(42, 32 + dy * 2); ctx.stroke(); }
  }
  if (id === 'dino') { ctx.fillStyle = dark; ellipse(ctx, 35, 31, 0.9, 0.9); ctx.fill(); ellipse(ctx, 38, 31, 0.9, 0.9); ctx.fill(); }
  if (id === 'bunny') { ctx.fillStyle = '#fff'; ellipse(ctx, 8.5, 42, 4.5, 4.5); ctx.fill(); }
}

export function drawEyeWhite(ctx, cx, cy) {
  ctx.fillStyle = '#fff'; ellipse(ctx, cx, cy, 3.6, 4.3); ctx.fill();
}
export function drawPupil(ctx, cx, cy) {
  ctx.fillStyle = NAVY; ellipse(ctx, cx, cy, 2.1, 2.7); ctx.fill();
  ctx.fillStyle = '#fff'; ellipse(ctx, cx + 0.8, cy - 1, 0.8, 0.8); ctx.fill();
}
export function drawFoot(ctx, cx, cy, ch) {
  ctx.fillStyle = ch.dark; ellipse(ctx, cx, cy, 5.5, 3.3); ctx.fill();
}

// Full static character for the menu: body + feet + eyes.
export function drawCharacter(canvas, ch, scale = 3) {
  const ctx = canvas.getContext('2d');
  canvas.width = BODY_W * scale; canvas.height = (BODY_H + 2) * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawFoot(ctx, 18, 50, ch); drawFoot(ctx, 31, 50, ch);
  drawBody(ctx, ch);
  for (const [x, y] of eyesFor(ch.id)) { drawEyeWhite(ctx, x, y); drawPupil(ctx, x + 1, y + 0.3); }
}

// Register Phaser textures: body_<id>, foot_<id>, eye, pupil.
export function makeCharTextures(scene, RES) {
  const add = (key, w, h, fn) => {
    if (scene.textures.exists(key)) return;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES);
    const ctx = c.getContext('2d'); ctx.scale(RES, RES); fn(ctx);
    scene.textures.addCanvas(key, c);
  };
  for (const ch of CHARACTERS) {
    add(`body_${ch.id}`, BODY_W, BODY_H, (ctx) => drawBody(ctx, ch));
    add(`foot_${ch.id}`, 12, 8, (ctx) => drawFoot(ctx, 6, 4, ch));
  }
  add('eye', 8, 10, (ctx) => drawEyeWhite(ctx, 4, 5));
  add('pupil', 6, 7, (ctx) => drawPupil(ctx, 3, 3.5));
}
