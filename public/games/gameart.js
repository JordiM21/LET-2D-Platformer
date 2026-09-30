// Extra generated art for the minigames (same flat, rounded LET style as the world).
import { RES } from '../art.js';

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
function eyes(ctx, x, y, gap, r) {
  for (const dx of [-gap / 2, gap / 2]) {
    ctx.fillStyle = '#fff'; ell(ctx, x + dx, y, r, r * 1.15); ctx.fill();
    ctx.fillStyle = '#1F1A3D'; ell(ctx, x + dx + r * 0.2, y + r * 0.15, r * 0.55, r * 0.65); ctx.fill();
    ctx.fillStyle = '#fff'; circ(ctx, x + dx + r * 0.45, y - r * 0.2, r * 0.22); ctx.fill();
  }
}

export function makeGameArt(scene) {
  // --- catapult blocks (drawn at a base size and stretched to each block)
  mk(scene, 'blk_wood', 32, 32, (ctx) => {
    ctx.fillStyle = '#B87A45'; rrect(ctx, 0, 0, 32, 32, 4); ctx.fill();
    ctx.fillStyle = '#D99A5B'; rrect(ctx, 2, 2, 28, 28, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(138,90,53,.55)'; ctx.lineWidth = 1.4;
    for (const y of [9, 17, 25]) { ctx.beginPath(); ctx.moveTo(5, y); ctx.quadraticCurveTo(16, y + 2, 27, y); ctx.stroke(); }
  });
  mk(scene, 'blk_stone', 32, 32, (ctx) => {
    ctx.fillStyle = '#8B94A8'; rrect(ctx, 0, 0, 32, 32, 6); ctx.fill();
    ctx.fillStyle = '#AEB6C8'; rrect(ctx, 2, 2, 28, 26, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ell(ctx, 10, 8, 5, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(31,26,61,.2)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(18, 6); ctx.lineTo(22, 16); ctx.lineTo(17, 24); ctx.stroke();
  });
  mk(scene, 'crown', 40, 34, (ctx) => {
    ctx.fillStyle = '#E09B12';
    ctx.beginPath(); ctx.moveTo(3, 30); ctx.lineTo(1, 8); ctx.lineTo(11, 17); ctx.lineTo(20, 3); ctx.lineTo(29, 17); ctx.lineTo(39, 8); ctx.lineTo(37, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFC83D';
    ctx.beginPath(); ctx.moveTo(5, 28); ctx.lineTo(4, 12); ctx.lineTo(12, 19); ctx.lineTo(20, 7); ctx.lineTo(28, 19); ctx.lineTo(36, 12); ctx.lineTo(35, 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E09B12'; rrect(ctx, 3, 26, 34, 7, 3); ctx.fill();
    for (const [x, c] of [[12, '#E0364F'], [20, '#2A8BD8'], [28, '#3CC7A8']]) { ctx.fillStyle = c; circ(ctx, x, 29.5, 2.4); ctx.fill(); }
    eyes(ctx, 20, 20, 8, 2.6);
  });
  mk(scene, 'sling', 60, 110, (ctx) => {
    ctx.strokeStyle = '#6E4428'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(30, 108); ctx.lineTo(30, 58); ctx.lineTo(12, 12); ctx.moveTo(30, 58); ctx.lineTo(48, 12); ctx.stroke();
    ctx.strokeStyle = '#8A5A35'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(30, 106); ctx.lineTo(30, 58); ctx.lineTo(13, 14); ctx.moveTo(30, 58); ctx.lineTo(47, 14); ctx.stroke();
  });
  mk(scene, 'flag_red', 34, 60, (ctx) => flag(ctx, '#E0364F'));
  mk(scene, 'flag_blue', 34, 60, (ctx) => flag(ctx, '#2A8BD8'));
  function flag(ctx, col) {
    ctx.fillStyle = '#6E4428'; ctx.fillRect(3, 4, 4, 56);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(7, 5); ctx.quadraticCurveTo(20, 1, 33, 8); ctx.quadraticCurveTo(20, 14, 7, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFC83D'; circ(ctx, 5, 4, 3.4); ctx.fill();
  }

  // --- slimes for defense (one texture per type colour)
  for (const [key, col, dark] of [['slime', '#5CC75A', '#2F8A3A'], ['fast', '#FFC83D', '#C88A10'], ['big', '#9C82FF', '#6049C9'], ['boss', '#E0364F', '#9A1C30']]) {
    mk(scene, `en_${key}`, 48, 42, (ctx) => {
      ctx.fillStyle = 'rgba(31,26,61,.18)'; ell(ctx, 24, 39, 18, 3.5); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.moveTo(4, 38); ctx.quadraticCurveTo(2, 6, 24, 4); ctx.quadraticCurveTo(46, 6, 44, 38); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(6, 36); ctx.quadraticCurveTo(5, 8, 24, 6); ctx.quadraticCurveTo(43, 8, 42, 36); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ell(ctx, 15, 14, 5, 3, -0.5); ctx.fill();
      eyes(ctx, 24, 20, 12, 4);
      ctx.strokeStyle = '#1F1A3D'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(24, 27, 3.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      if (key === 'boss') {
        ctx.fillStyle = '#FFC83D';
        ctx.beginPath(); ctx.moveTo(13, 9); ctx.lineTo(15, -1 + 1); ctx.lineTo(20, 6); ctx.lineTo(24, 0); ctx.lineTo(28, 6); ctx.lineTo(33, 1); ctx.lineTo(35, 9); ctx.closePath(); ctx.fill();
      }
    });
  }
  // towers: stone base, roof colour by level
  const roofs = ['#8B94A8', '#3CC7A8', '#2A8BD8', '#9C82FF', '#FFC83D'];
  roofs.forEach((roof, i) => mk(scene, `tower${i + 1}`, 60, 84, (ctx) => {
    ctx.fillStyle = 'rgba(31,26,61,.2)'; ell(ctx, 30, 80, 24, 4); ctx.fill();
    ctx.fillStyle = '#9AA3B5'; rrect(ctx, 10, 34, 40, 46, 6); ctx.fill();
    ctx.fillStyle = '#B9C1D0'; rrect(ctx, 13, 36, 34, 40, 5); ctx.fill();
    ctx.fillStyle = 'rgba(31,26,61,.14)';
    for (const [x, y] of [[16, 46], [30, 54], [20, 64], [34, 68]]) { rrect(ctx, x, y, 10, 5, 2); ctx.fill(); }
    ctx.fillStyle = '#1F1A3D'; rrect(ctx, 25, 60, 10, 18, 5); ctx.fill();
    ctx.fillStyle = roof;
    ctx.beginPath(); ctx.moveTo(4, 38); ctx.lineTo(30, 6 - i); ctx.lineTo(56, 38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(12, 34); ctx.lineTo(30, 12 - i); ctx.lineTo(24, 34); ctx.closePath(); ctx.fill();
    for (let s = 0; s < i; s++) { ctx.fillStyle = '#FFC83D'; circ(ctx, 18 + s * 8, 42, 2.6); ctx.fill(); }
  }));
  mk(scene, 'slot', 50, 20, (ctx) => {
    ctx.fillStyle = 'rgba(31,26,61,.12)'; ell(ctx, 25, 10, 23, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ell(ctx, 25, 10, 21, 7); ctx.stroke();
  });
  mk(scene, 'heart', 20, 18, (ctx) => {
    ctx.fillStyle = '#FF5A5F';
    ctx.beginPath(); ctx.moveTo(10, 17); ctx.bezierCurveTo(-4, 8, 2, -3, 10, 4); ctx.bezierCurveTo(18, -3, 24, 8, 10, 17); ctx.fill();
  });
  mk(scene, 'coin', 18, 18, (ctx) => {
    ctx.fillStyle = '#E09B12'; circ(ctx, 9, 9, 8.5); ctx.fill();
    ctx.fillStyle = '#FFC83D'; circ(ctx, 9, 8.4, 7); ctx.fill();
    ctx.fillStyle = '#E09B12'; ctx.fillRect(7.8, 4.5, 2.4, 8);
  });

  // --- potato
  mk(scene, 'bomb', 34, 38, (ctx) => {
    ctx.strokeStyle = '#8A5A35'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(22, 10); ctx.quadraticCurveTo(26, 2, 32, 4); ctx.stroke();
    ctx.fillStyle = '#3A3370'; rrect(ctx, 16, 8, 10, 7, 2); ctx.fill();
    ctx.fillStyle = '#1F1A3D'; circ(ctx, 17, 24, 13); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ell(ctx, 12, 19, 4, 3, -0.6); ctx.fill();
    eyes(ctx, 17, 25, 9, 3);
  });
  mk(scene, 'ghost', 36, 40, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.moveTo(4, 38); ctx.lineTo(4, 16); ctx.quadraticCurveTo(4, 2, 18, 2); ctx.quadraticCurveTo(32, 2, 32, 16); ctx.lineTo(32, 38);
    for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(28 - i * 7, 33, 25 - i * 7, 38);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1F1A3D'; ell(ctx, 13, 17, 2.6, 3.4); ctx.fill(); ell(ctx, 23, 17, 2.6, 3.4); ctx.fill();
    ell(ctx, 18, 25, 3, 2.4); ctx.fill();
  });

  // --- big soft star for backgrounds
  mk(scene, 'bgstar', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16);
  });
  mk(scene, 'bigstar', 44, 44, (ctx) => {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 9.5 : 20; pts.push([22 + Math.cos(a) * rr, 23 + Math.sin(a) * rr]); }
    ctx.fillStyle = '#C94FE0'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 1.6) : ctx.moveTo(x, y + 1.6))); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FF8DE8'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
    eyes(ctx, 22, 23, 8, 2.4);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ell(ctx, 16, 14, 3, 1.8, -0.6); ctx.fill();
  });
}
