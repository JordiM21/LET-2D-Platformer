// World art generated with Canvas2D at RES x resolution. Display with setScale(1 / RES).
// Swap any key for a real image later with this.load.image(key, url) under the same name.
import { TILE } from '/shared/game.js';

export const RES = 2;

function mk(scene, key, w, h, fn) {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES);
  const ctx = c.getContext('2d');
  ctx.scale(RES, RES); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  fn(ctx, w, h);
  scene.textures.addCanvas(key, c);
}
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
const circ = (ctx, x, y, r) => ell(ctx, x, y, r, r);
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const C = {
  grass: '#62C654', grassHi: '#92E46E', grassLo: '#3E9E43',
  dirt: '#C98A55', dirtHi: '#DDA06A', dirtLo: '#A96A3A', deep: '#A7683C', deepLo: '#8A5230',
  wood: '#D99A5B', woodLo: '#9E6431', woodHi: '#F0B878',
  navy: '#1F1A3D', orange: '#CA4B15', cream: '#FFF5E6', gold: '#FFC83D',
};

// ------------------------------------------------------------ tiles
function drawTile(ctx, top, left, right, deep, seed) {
  const r = rng(seed);
  ctx.fillStyle = deep ? C.deep : C.dirt; ctx.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = deep ? C.deepLo : (r() < 0.5 ? C.dirtLo : C.dirtHi);
    ell(ctx, 3 + r() * 26, (top ? 12 : 3) + r() * (top ? 16 : 26), 1.5 + r() * 2.2, 1.2 + r() * 1.5); ctx.fill();
  }
  if (!deep && r() < 0.25) { ctx.fillStyle = '#E8D7C0'; ell(ctx, 8 + r() * 16, 20 + r() * 6, 3, 2); ctx.fill(); }
  if (left) { ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(0, 0, 3, TILE); }
  if (right) { ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(TILE - 3, 0, 3, TILE); }
  if (top) {
    ctx.fillStyle = C.grassLo;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(TILE, 0); ctx.lineTo(TILE, 11);
    for (let x = TILE; x >= 0; x -= 4) ctx.lineTo(x, 11 + ((x / 4) % 2 ? 3 : 0));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.grass; ctx.fillRect(0, 0, TILE, 9);
    ctx.fillStyle = C.grassHi; ctx.fillRect(0, 0, TILE, 3);
    if (left) { ctx.fillStyle = C.grass; ell(ctx, 1.5, 6, 3, 6); ctx.fill(); }
    if (right) { ctx.fillStyle = C.grassLo; ell(ctx, TILE - 1.5, 6, 3, 6); ctx.fill(); }
  }
}

function drawPlank(ctx, w, lEnd, rEnd) {
  ctx.fillStyle = C.woodLo; rrect(ctx, lEnd ? 1 : 0, 2, w - (lEnd ? 1 : 0) - (rEnd ? 1 : 0), 12, lEnd || rEnd ? 4 : 0); ctx.fill();
  ctx.fillStyle = C.wood; rrect(ctx, lEnd ? 1 : 0, 0, w - (lEnd ? 1 : 0) - (rEnd ? 1 : 0), 10, lEnd || rEnd ? 4 : 0); ctx.fill();
  ctx.fillStyle = C.woodHi; ctx.fillRect(lEnd ? 4 : 0, 1, w - (lEnd ? 4 : 0) - (rEnd ? 4 : 0), 2);
  ctx.fillStyle = C.woodLo; circ(ctx, 6, 6, 1.2); ctx.fill(); circ(ctx, w - 6, 6, 1.2); ctx.fill();
}

// ------------------------------------------------------------ decor
function tree(ctx, w, h, kind, seed) {
  const r = rng(seed);
  ctx.fillStyle = '#8A5A35'; rrect(ctx, w / 2 - 5, h - 44, 10, 44, 3); ctx.fill();
  ctx.fillStyle = '#6E4428'; ctx.fillRect(w / 2 + 1, h - 44, 4, 44);
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const y = h - 34 - i * 24, hw = 30 - i * 7;
      ctx.fillStyle = i % 2 ? '#2E9C5A' : '#27884E';
      ctx.beginPath(); ctx.moveTo(w / 2 - hw, y); ctx.quadraticCurveTo(w / 2, y + 6, w / 2 + hw, y); ctx.lineTo(w / 2, y - 38); ctx.closePath(); ctx.fill();
    }
    return;
  }
  const blobs = [[0, -62, 28], [-18, -50, 20], [18, -50, 21], [-8, -80, 20], [12, -76, 19]];
  ctx.fillStyle = '#3FA356';
  for (const [x, y, rr] of blobs) { circ(ctx, w / 2 + x, h + y, rr); ctx.fill(); }
  ctx.fillStyle = '#5CC266';
  for (const [x, y, rr] of blobs) { circ(ctx, w / 2 + x - 4, h + y - 5, rr * 0.72); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.22)'; circ(ctx, w / 2 - 14, h - 88, 8); ctx.fill();
  if (kind === 'fruit') {
    for (let i = 0; i < 7; i++) { ctx.fillStyle = r() < 0.5 ? '#FF5A5F' : '#FF8A3D'; circ(ctx, w / 2 - 28 + r() * 56, h - 96 + r() * 50, 3.2); ctx.fill(); }
  }
}

function flower(ctx, color) {
  ctx.strokeStyle = '#3E9E43'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(8, 22); ctx.quadraticCurveTo(6, 15, 8, 9); ctx.stroke();
  ctx.fillStyle = '#5CC266'; ell(ctx, 5, 16, 3, 1.6, -0.6); ctx.fill();
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; circ(ctx, 8 + Math.cos(a) * 3.6, 7 + Math.sin(a) * 3.6, 2.9); ctx.fill(); }
  ctx.fillStyle = C.gold; circ(ctx, 8, 7, 2.2); ctx.fill();
}

function house(ctx, w, h) {
  // chimney
  ctx.fillStyle = '#A8483A'; ctx.fillRect(128, 22, 16, 40);
  ctx.fillStyle = '#8C3A2F'; ctx.fillRect(125, 18, 22, 8);
  // walls
  ctx.fillStyle = C.cream; rrect(ctx, 26, 64, 128, 86, 6); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(26, 138, 128, 12);
  // roof
  ctx.fillStyle = '#A63A0B';
  ctx.beginPath(); ctx.moveTo(10, 72); ctx.lineTo(90, 10); ctx.lineTo(170, 72); ctx.quadraticCurveTo(90, 66, 10, 72); ctx.fill();
  ctx.fillStyle = C.orange;
  ctx.beginPath(); ctx.moveTo(14, 66); ctx.lineTo(90, 8); ctx.lineTo(166, 66); ctx.quadraticCurveTo(90, 60, 14, 66); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(90 - i * 19, 8 + i * 14.5); ctx.lineTo(90 + i * 19, 8 + i * 14.5); ctx.stroke(); }
  // round window in the roof
  ctx.fillStyle = C.navy; circ(ctx, 90, 42, 10); ctx.fill();
  ctx.fillStyle = '#FFD66B'; circ(ctx, 90, 42, 7); ctx.fill();
  // door
  ctx.fillStyle = C.navy; rrect(ctx, 76, 94, 30, 56, 14); ctx.fill();
  ctx.fillStyle = '#3A3370'; rrect(ctx, 80, 98, 22, 52, 11); ctx.fill();
  ctx.fillStyle = C.gold; circ(ctx, 98, 124, 2.4); ctx.fill();
  // windows
  for (const x of [38, 118]) {
    ctx.fillStyle = C.navy; rrect(ctx, x - 2, 86, 30, 30, 6); ctx.fill();
    ctx.fillStyle = '#FFD66B'; rrect(ctx, x + 1, 89, 24, 24, 4); ctx.fill();
    ctx.fillStyle = C.navy; ctx.fillRect(x + 12, 89, 2.4, 24); ctx.fillRect(x + 1, 100, 24, 2.4);
    ctx.fillStyle = '#8A5A35'; rrect(ctx, x - 4, 116, 34, 7, 2); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#FF5A8A', '#FFC83D', '#FF8A3D', '#B982FF'][i]; circ(ctx, x + 2 + i * 8, 114, 3.4); ctx.fill(); }
  }
}

function gazebo(ctx, w, h) {
  // base
  ctx.fillStyle = '#E8DCCB'; rrect(ctx, 14, 146, 212, 24, 6); ctx.fill();
  ctx.fillStyle = '#D2C3AE'; ctx.fillRect(14, 160, 212, 10);
  // columns
  for (const x of [32, 84, 148, 200]) {
    ctx.fillStyle = '#FFFFFF'; rrect(ctx, x, 70, 10, 78, 3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x + 6, 70, 4, 78);
  }
  // bunting
  ctx.strokeStyle = C.navy; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(37, 80); ctx.quadraticCurveTo(120, 104, 205, 80); ctx.stroke();
  const cols = ['#FF5A5F', C.gold, '#3CC7A8', '#58B8F2', '#B982FF', '#FF8A3D'];
  for (let i = 0; i < 11; i++) {
    const t = (i + 0.5) / 11, x = 37 + t * 168, y = 80 + Math.sin(t * Math.PI) * 12;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 12); ctx.closePath(); ctx.fill();
  }
  // dome roof
  ctx.fillStyle = '#5B3FD9';
  ctx.beginPath(); ctx.moveTo(8, 76); ctx.quadraticCurveTo(120, -30, 232, 76); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#7B5CFF' : '#9C82FF'; ctx.beginPath(); ctx.moveTo(120, 0); ctx.lineTo(8 + i * 28, 80); ctx.lineTo(8 + (i + 1) * 28, 80); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = C.gold; rrect(ctx, 4, 70, 232, 10, 5); ctx.fill();
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#FFFFFF' : C.gold; ell(ctx, 14 + i * 19, 82, 9, 6); ctx.fill(); }
  // flag
  ctx.strokeStyle = C.navy; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(120, 24); ctx.lineTo(120, 2); ctx.stroke();
  ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(121, 2); ctx.lineTo(138, 7); ctx.lineTo(121, 12); ctx.fill();
}

function board(ctx, w, h) {
  ctx.fillStyle = '#8A5A35'; ctx.fillRect(18, 40, 9, 90); ctx.fillRect(w - 27, 40, 9, 90);
  ctx.fillStyle = '#B87A45'; rrect(ctx, 8, 38, w - 16, 70, 6); ctx.fill();
  ctx.fillStyle = '#D99A5B'; rrect(ctx, 13, 43, w - 26, 60, 4); ctx.fill();
  // roof
  ctx.fillStyle = C.navy; ctx.beginPath(); ctx.moveTo(2, 40); ctx.lineTo(w / 2, 16); ctx.lineTo(w - 2, 40); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#F2A516'; ctx.fillRect(2, 36, w - 4, 6);
  // papers
  const papers = [[22, 50, -0.08, '#FFFFFF'], [52, 48, 0.06, '#FFF2B3'], [82, 52, -0.04, '#FFFFFF'], [36, 76, 0.07, '#D9F2FF'], [70, 76, -0.06, '#FFE0EC']];
  for (const [x, y, rot, col] of papers) {
    ctx.save(); ctx.translate(x + 12, y + 11); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-11, -9, 24, 22);
    ctx.fillStyle = col; ctx.fillRect(-12, -11, 24, 22);
    ctx.fillStyle = 'rgba(31,26,61,.35)'; for (let i = 0; i < 3; i++) ctx.fillRect(-8, -4 + i * 5, 16 - i * 4, 1.6);
    ctx.fillStyle = '#FF5A5F'; circ(ctx, 0, -10, 2); ctx.fill();
    ctx.restore();
  }
}

function library(ctx, w, h) {
  ctx.fillStyle = '#E8DCCB'; ctx.fillRect(10, 150, w - 20, 10); ctx.fillRect(18, 142, w - 36, 10);
  ctx.fillStyle = '#F4EEE4'; ctx.fillRect(24, 66, w - 48, 78);
  for (let i = 0; i < 5; i++) {
    const x = 32 + i * ((w - 76) / 4);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, 70, 12, 72);
    ctx.fillStyle = 'rgba(0,0,0,.07)'; ctx.fillRect(x + 8, 70, 4, 72);
  }
  ctx.fillStyle = '#2A8BD8'; ctx.beginPath(); ctx.moveTo(8, 68); ctx.lineTo(w / 2, 14); ctx.lineTo(w - 8, 68); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#58B8F2'; ctx.beginPath(); ctx.moveTo(28, 60); ctx.lineTo(w / 2, 24); ctx.lineTo(w - 28, 60); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1D6FB0'; ctx.fillRect(8, 62, w - 16, 8);
  // book emblem
  ctx.fillStyle = '#FFFFFF'; circ(ctx, w / 2, 45, 12); ctx.fill();
  ctx.fillStyle = C.orange; ctx.fillRect(w / 2 - 8, 39, 7.5, 12); ctx.fillStyle = C.gold; ctx.fillRect(w / 2 + 0.5, 39, 7.5, 12);
  // door
  ctx.fillStyle = C.navy; rrect(ctx, w / 2 - 17, 92, 34, 52, 16); ctx.fill();
  ctx.fillStyle = '#FFD66B'; rrect(ctx, w / 2 - 12, 97, 24, 22, 11); ctx.fill();
  ctx.fillStyle = C.navy; ctx.fillRect(w / 2 - 1, 97, 2, 22);
}

function arena(ctx, w, h) {
  // walls with crenellations
  ctx.fillStyle = '#C22B42'; ctx.fillRect(14, 56, w - 28, 94);
  ctx.fillStyle = '#E0364F'; ctx.fillRect(18, 60, w - 36, 90);
  for (let x = 14; x < w - 20; x += 24) { ctx.fillStyle = '#C22B42'; ctx.fillRect(x, 42, 16, 18); ctx.fillStyle = '#E0364F'; ctx.fillRect(x + 2, 44, 12, 16); }
  // side towers
  for (const x of [0, w - 38]) {
    ctx.fillStyle = '#B0263B'; ctx.fillRect(x, 32, 38, 118);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(x - 4, 34); ctx.lineTo(x + 19, 2); ctx.lineTo(x + 42, 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.navy; rrect(ctx, x + 12, 60, 14, 22, 7); ctx.fill();
  }
  // gate
  ctx.fillStyle = C.navy; rrect(ctx, w / 2 - 24, 90, 48, 60, 22); ctx.fill();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 9, 96); ctx.lineTo(w / 2 + i * 9, 150); ctx.stroke(); }
  // trophy
  ctx.fillStyle = C.gold;
  ctx.beginPath(); ctx.moveTo(w / 2 - 16, 50); ctx.lineTo(w / 2 + 16, 50); ctx.quadraticCurveTo(w / 2 + 14, 76, w / 2, 78); ctx.quadraticCurveTo(w / 2 - 14, 76, w / 2 - 16, 50); ctx.fill();
  ctx.fillRect(w / 2 - 3, 76, 6, 8); rrect(ctx, w / 2 - 11, 83, 22, 6, 2); ctx.fill();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ell(ctx, w / 2 - 17, 60, 6, 7); ctx.stroke(); ell(ctx, w / 2 + 17, 60, 6, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ell(ctx, w / 2 - 7, 58, 3, 7); ctx.fill();
}

// ------------------------------------------------------------ parallax strips (seamless at 1024 wide)
function ridge(ctx, w, h, base, amp, waves, color, seed) {
  const r = rng(seed); const ph = waves.map(() => r() * Math.PI * 2);
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    let y = base;
    waves.forEach((k, i) => { y -= Math.sin((x / w) * Math.PI * 2 * k + ph[i]) * amp[i]; });
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  return (x) => { let y = base; waves.forEach((k, i) => { y -= Math.sin((x / w) * Math.PI * 2 * k + ph[i]) * amp[i]; }); return y; };
}

function mountains(ctx, w, fullH) {
  const h = 340;
  ctx.fillStyle = '#A7B8F0'; ctx.fillRect(0, h - 2, w, fullH - h + 2);
  const peaks = [[80, 90], [230, 50], [380, 110], [520, 70], [690, 40], [850, 95], [980, 75]];
  const draw = (px, top, col, snow) => {
    for (const off of [-w, 0, w]) {
      const x = px + off, bw = 150 + (top % 30);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x - bw, h); ctx.lineTo(x - 12, top + 4); ctx.quadraticCurveTo(x, top - 4, x + 12, top + 4); ctx.lineTo(x + bw, h); ctx.fill();
      if (snow) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.moveTo(x - 30, top + 34); ctx.lineTo(x - 12, top + 4); ctx.quadraticCurveTo(x, top - 4, x + 12, top + 4); ctx.lineTo(x + 30, top + 34);
        ctx.lineTo(x + 16, top + 28); ctx.lineTo(x + 4, top + 38); ctx.lineTo(x - 8, top + 27); ctx.lineTo(x - 18, top + 36); ctx.closePath(); ctx.fill();
      }
    }
  };
  peaks.forEach(([x, t], i) => draw(x, t + 40, i % 2 ? '#A7B8F0' : '#9AAEEA', true));
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(214,240,255,.35)'; ctx.fillRect(0, 0, w, fullH);
  ctx.globalCompositeOperation = 'source-over';
}

export function makeArt(scene) {
  // tiles: every edge combination, two dirt variants
  for (let top = 0; top < 2; top++) for (let l = 0; l < 2; l++) for (let r = 0; r < 2; r++)
    mk(scene, `t_${top}${l}${r}`, TILE, TILE, (ctx) => drawTile(ctx, top, l, r, false, 7 + top * 4 + l * 2 + r));
  mk(scene, 't_dirt2', TILE, TILE, (ctx) => drawTile(ctx, 0, 0, 0, false, 99));
  mk(scene, 't_deep', TILE, TILE, (ctx) => drawTile(ctx, 0, 0, 0, true, 3));
  mk(scene, 't_deep2', TILE, TILE, (ctx) => drawTile(ctx, 0, 0, 0, true, 51));
  mk(scene, 'plank_m', TILE, 16, (ctx) => drawPlank(ctx, TILE, false, false));
  mk(scene, 'plank_l', TILE, 16, (ctx) => drawPlank(ctx, TILE, true, false));
  mk(scene, 'plank_r', TILE, 16, (ctx) => drawPlank(ctx, TILE, false, true));
  mk(scene, 'plank_s', TILE, 16, (ctx) => drawPlank(ctx, TILE, true, true));
  mk(scene, 'rope', 4, 32, (ctx) => { ctx.strokeStyle = '#9E6431'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2, 32); ctx.stroke(); });

  // bounce mushroom
  mk(scene, 'pad', 40, 26, (ctx) => {
    ctx.fillStyle = '#FFF1DC'; rrect(ctx, 14, 12, 12, 14, 4); ctx.fill();
    ctx.fillStyle = '#E0364F'; ctx.beginPath(); ctx.moveTo(2, 16); ctx.quadraticCurveTo(20, -8, 38, 16); ctx.quadraticCurveTo(20, 20, 2, 16); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; circ(ctx, 12, 9, 3); ctx.fill(); circ(ctx, 24, 6, 3.5); ctx.fill(); circ(ctx, 31, 12, 2.2); ctx.fill();
  });

  // decor
  mk(scene, 'tree_round', 100, 130, (ctx, w, h) => tree(ctx, w, h, 'round', 1));
  mk(scene, 'tree_fruit', 100, 130, (ctx, w, h) => tree(ctx, w, h, 'fruit', 2));
  mk(scene, 'tree_pine', 80, 130, (ctx, w, h) => tree(ctx, w, h, 'pine', 3));
  mk(scene, 'bush', 56, 30, (ctx) => {
    ctx.fillStyle = '#3FA356'; for (const [x, y, r] of [[14, 20, 12], [28, 14, 14], [42, 20, 12]]) { circ(ctx, x, y, r); ctx.fill(); }
    ctx.fillStyle = '#5CC266'; for (const [x, y, r] of [[12, 18, 8], [26, 11, 10], [40, 18, 8]]) { circ(ctx, x, y, r); ctx.fill(); }
    ctx.fillRect(4, 24, 48, 6);
  });
  ['#FF5A8A', '#FFC83D', '#B982FF', '#FFFFFF', '#FF8A3D'].forEach((col, i) => mk(scene, `flower${i}`, 16, 24, (ctx) => flower(ctx, col)));
  mk(scene, 'tuft', 18, 14, (ctx) => {
    ctx.fillStyle = '#4FB24D';
    for (const [x, h, lean] of [[4, 10, -3], [8, 14, 0], [12, 11, 3], [15, 8, 4]]) {
      ctx.beginPath(); ctx.moveTo(x - 2.4, 14); ctx.quadraticCurveTo(x, 14 - h * 0.6, x + lean, 14 - h); ctx.quadraticCurveTo(x + 0.5, 14 - h * 0.5, x + 2.4, 14); ctx.fill();
    }
  });
  mk(scene, 'rock', 28, 16, (ctx) => {
    ctx.fillStyle = '#9AA3B5'; ell(ctx, 14, 10, 13, 7); ctx.fill();
    ctx.fillStyle = '#B9C1D0'; ell(ctx, 11, 8, 8, 4); ctx.fill();
  });
  mk(scene, 'fence', 32, 24, (ctx) => {
    ctx.fillStyle = '#F4E3C8';
    for (const x of [4, 20]) { rrect(ctx, x, 2, 7, 22, 3); ctx.fill(); }
    ctx.fillRect(0, 8, 32, 4); ctx.fillRect(0, 16, 32, 4);
  });
  mk(scene, 'lamp', 16, 64, (ctx) => {
    ctx.fillStyle = C.navy; ctx.fillRect(6.5, 12, 3, 52); rrect(ctx, 3, 58, 10, 6, 2); ctx.fill();
    ctx.fillStyle = '#FFE38A'; circ(ctx, 8, 9, 6); ctx.fill();
    ctx.fillStyle = C.navy; ctx.fillRect(3, 1, 10, 3);
  });
  mk(scene, 'sign', 56, 50, (ctx) => {
    ctx.fillStyle = '#8A5A35'; ctx.fillRect(25, 18, 6, 32);
    ctx.fillStyle = '#B87A45'; rrect(ctx, 2, 4, 52, 22, 5); ctx.fill();
    ctx.fillStyle = '#D99A5B'; rrect(ctx, 5, 7, 46, 16, 3); ctx.fill();
  });
  mk(scene, 'fountain', 90, 60, (ctx) => {
    ctx.fillStyle = '#C9D2E3'; rrect(ctx, 4, 34, 82, 26, 8); ctx.fill();
    ctx.fillStyle = '#58B8F2'; rrect(ctx, 9, 36, 72, 10, 5); ctx.fill();
    ctx.fillStyle = '#DDE4F0'; rrect(ctx, 38, 14, 14, 24, 4); ctx.fill();
    ctx.fillStyle = '#C9D2E3'; rrect(ctx, 30, 10, 30, 7, 3); ctx.fill();
  });

  // POI buildings
  mk(scene, 'poi_home', 180, 150, house);
  mk(scene, 'poi_plaza', 240, 170, gazebo);
  mk(scene, 'poi_quests', 124, 130, board);
  mk(scene, 'poi_library', 210, 160, library);
  mk(scene, 'poi_arena', 210, 150, arena);

  // collectibles + particles
  mk(scene, 'star', 30, 30, (ctx) => {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 6.5 : 13.5; pts.push([15 + Math.cos(a) * rr, 16 + Math.sin(a) * rr]); }
    ctx.fillStyle = '#F29A16'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 1.2) : ctx.moveTo(x, y + 1.2))); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.gold; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.navy; circ(ctx, 12.3, 15.5, 1.4); ctx.fill(); circ(ctx, 17.7, 15.5, 1.4); ctx.fill();
    ctx.strokeStyle = C.navy; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(15, 17.2, 2, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ell(ctx, 11, 10, 2, 1.2, -0.6); ctx.fill();
  });
  mk(scene, 'glow', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
  mk(scene, 'p_dot', 10, 10, (ctx) => { ctx.fillStyle = '#fff'; circ(ctx, 5, 5, 4.5); ctx.fill(); });
  mk(scene, 'p_puff', 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 24, 24);
  });
  mk(scene, 'p_star', 14, 14, (ctx) => {
    ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 2 : 7; ctx.lineTo(7 + Math.cos(a) * rr, 7 + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  });
  mk(scene, 'p_leaf', 10, 6, (ctx) => { ctx.fillStyle = '#fff'; ell(ctx, 5, 3, 4.5, 2.4); ctx.fill(); });
  mk(scene, 'p_drop', 6, 8, (ctx) => { ctx.fillStyle = '#fff'; ell(ctx, 3, 4.5, 2.6, 3.4); ctx.fill(); });
  mk(scene, 'shadow', 32, 10, (ctx) => { ctx.fillStyle = 'rgba(31,26,61,.28)'; ell(ctx, 16, 5, 15, 4.5); ctx.fill(); });
  mk(scene, 'bubble', 44, 44, (ctx) => {
    ctx.fillStyle = 'rgba(31,26,61,.18)'; circ(ctx, 22, 22, 19); ctx.fill();
    ctx.fillStyle = '#fff'; circ(ctx, 22, 20, 18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, 34); ctx.lineTo(22, 43); ctx.lineTo(27, 34); ctx.fill();
  });

  // critters
  mk(scene, 'bfly', 16, 12, (ctx) => {
    ctx.fillStyle = '#fff'; ell(ctx, 4.5, 4, 4, 3.6); ctx.fill(); ell(ctx, 11.5, 4, 4, 3.6); ctx.fill();
    ell(ctx, 5, 9, 3, 2.4); ctx.fill(); ell(ctx, 11, 9, 3, 2.4); ctx.fill();
    ctx.fillStyle = C.navy; ell(ctx, 8, 6.5, 1.1, 4.5); ctx.fill();
  });
  mk(scene, 'bird', 24, 12, (ctx) => {
    ctx.strokeStyle = '#3A3370'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(1, 3); ctx.quadraticCurveTo(7, 1, 12, 8); ctx.quadraticCurveTo(17, 1, 23, 3); ctx.stroke();
  });

  // parallax
  mk(scene, 'sky', 4, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#6EC3FF'); g.addColorStop(0.55, '#A9DDFF'); g.addColorStop(1, '#E3F5FF');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
  });
  mk(scene, 'sun', 140, 140, (ctx) => {
    const g = ctx.createRadialGradient(70, 70, 20, 70, 70, 70);
    g.addColorStop(0, 'rgba(255,236,150,.8)'); g.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 140, 140);
    ctx.fillStyle = '#FFE27A'; circ(ctx, 70, 70, 30); ctx.fill();
    ctx.fillStyle = '#FFF1B0'; circ(ctx, 64, 64, 20); ctx.fill();
  });
  mk(scene, 'rays', 220, 220, (ctx) => {
    ctx.fillStyle = 'rgba(255,245,200,.22)';
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(110, 110);
      ctx.lineTo(110 + Math.cos(a - 0.1) * 110, 110 + Math.sin(a - 0.1) * 110);
      ctx.lineTo(110 + Math.cos(a + 0.1) * 110, 110 + Math.sin(a + 0.1) * 110); ctx.fill();
    }
  });
  mk(scene, 'clouds', 1024, 200, (ctx) => {
    const r = rng(11);
    for (let i = 0; i < 6; i++) {
      const cx = i * 170 + r() * 80, cy = 40 + r() * 110, s = 0.6 + r() * 0.7;
      for (const off of [-1024, 0, 1024]) {
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        for (const [dx, dy, rr] of [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 8, 22]]) { circ(ctx, cx + off + dx * s, cy + dy * s, rr * s); ctx.fill(); }
        ctx.fillStyle = 'rgba(200,228,255,.6)'; ctx.fillRect(cx + off - 18 * s, cy + 8 * s, 86 * s, 12 * s);
      }
    }
  });
  mk(scene, 'mountains', 1024, 620, (ctx, w, h) => mountains(ctx, w, h));
  mk(scene, 'hills_far', 1024, 560, (ctx, w, h) => {
    const y = ridge(ctx, w, h, 120, [26, 14], [2, 5], '#8FD3A8', 5);
    const r = rng(8);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, top = y(x);
      for (const off of [-w, 0, w]) { ctx.fillStyle = r() < 0.5 ? '#72BF8E' : '#7CC897'; circ(ctx, x + off, top + 4, 8 + r() * 6); ctx.fill(); }
    }
  });
  mk(scene, 'hills_near', 1024, 560, (ctx, w, h) => {
    const y = ridge(ctx, w, h, 110, [30, 12], [3, 7], '#6CC07A', 9);
    const r = rng(4);
    for (let i = 0; i < 16; i++) {
      const x = r() * w, top = y(x), s = 0.8 + r() * 0.6;
      for (const off of [-w, 0, w]) {
        ctx.fillStyle = '#7A5335'; ctx.fillRect(x + off - 2 * s, top - 14 * s, 4 * s, 18 * s);
        ctx.fillStyle = '#4FAF63'; circ(ctx, x + off, top - 22 * s, 14 * s); ctx.fill();
        ctx.fillStyle = '#62C06F'; circ(ctx, x + off - 3 * s, top - 25 * s, 9 * s); ctx.fill();
      }
    }
  });
}

export function makeWater(scene) {
  mk(scene, 'water', 32, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#58B8F2'); g.addColorStop(1, '#2A76B5');
    ctx.fillStyle = g; ctx.fillRect(0, 6, 32, 58);
    ctx.fillStyle = '#9BDDFF';
    ctx.beginPath(); ctx.moveTo(0, 8);
    for (let x = 0; x <= 32; x += 2) ctx.lineTo(x, 6 + Math.sin((x / 32) * Math.PI * 2) * 2.5);
    ctx.lineTo(32, 11); ctx.lineTo(0, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(4, 20, 8, 2); ctx.fillRect(20, 34, 6, 2);
  });
}
