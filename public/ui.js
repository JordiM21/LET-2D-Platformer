// DOM layer: HUD, touch controls, toasts, modal. The Phaser scene talks to it through this object.
import { POIS, EMOTES, WORLD_W } from '/shared/game.js';
import { drawCharacter, CHAR_BY_ID } from './characters.js';
import { POI_CONTENT } from './pois.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const PKEY = 'letWorldProgress';

// touch screens held upright get a full-screen "rotate me" wall and no input until turned sideways
const portrait = matchMedia('(orientation: portrait)');
const touchDevice = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
export let rotateBlocked = false;
let onRotateBlock = null;
function syncOrientation() {
  const was = rotateBlocked;
  rotateBlocked = touchDevice && portrait.matches;
  document.body.classList.toggle('rotate-block', rotateBlocked);
  if (rotateBlocked) { document.activeElement?.blur?.(); onRotateBlock?.(); }
  // mobile browsers report the new size late after turning: re-measure once it settles
  if (was && !rotateBlocked) for (const ms of [100, 400]) setTimeout(() => window.__game?.scale.refresh(), ms);
}
portrait.addEventListener('change', syncOrientation);
syncOrientation();

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PKEY)) || {};
    return { stars: p.stars | 0, visited: Array.isArray(p.visited) ? p.visited : [], emotes: p.emotes | 0 };
  } catch { return { stars: 0, visited: [], emotes: 0 }; }
}

export function createUI(profile) {
  const progress = loadProgress();
  const save = () => { try { localStorage.setItem(PKEY, JSON.stringify(progress)); } catch { /* private mode */ } };
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  document.body.classList.toggle('is-touch', isTouch);

  const ui = {
    isTouch, progress, modalOpen: false,
    touch: { left: false, right: false, jump: false, down: false },
    onJump: null, onInteract: null, onEmote: null, onCharChange: null, onModalClose: null,
    get blocked() { return rotateBlocked; },
  };
  onRotateBlock = () => { Object.keys(ui.touch).forEach((k) => { ui.touch[k] = false; }); };

  // ---- top bar
  $('meName').textContent = profile.name;
  const drawMe = () => drawCharacter($('meAvatar'), CHAR_BY_ID[profile.char], 1);
  drawMe();
  $('starCount').textContent = progress.stars;
  const setMuteIcon = () => { $('muteBtn').textContent = sfx.muted ? '🔇' : '🔊'; };
  setMuteIcon();
  $('muteBtn').onclick = () => { sfx.setMuted(!sfx.muted); setMuteIcon(); sfx.tap(); };
  $('fsBtn').onclick = () => {
    sfx.tap();
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  if (!document.documentElement.requestFullscreen) $('fsBtn').classList.add('hidden');

  // ---- mini map
  const map = $('map');
  const poiEls = POIS.map((p) => {
    const e = document.createElement('span');
    e.className = 'map-poi' + (progress.visited.includes(p.id) ? ' found' : '');
    e.textContent = p.icon; e.style.left = `${(p.x / WORLD_W) * 100}%`;
    map.appendChild(e); return e;
  });
  const meDot = document.createElement('span'); meDot.className = 'map-dot me'; map.appendChild(meDot);
  const otherDots = [];
  ui.updateMap = (myX, others) => {
    meDot.style.left = `${myX * 100}%`;
    while (otherDots.length < others.length) { const d = document.createElement('span'); d.className = 'map-dot'; map.insertBefore(d, meDot); otherDots.push(d); }
    otherDots.forEach((d, i) => {
      const o = others[i];
      d.style.display = o ? '' : 'none';
      if (o) { d.style.left = `${o.x * 100}%`; d.style.background = CHAR_BY_ID[o.char]?.body || '#3A3370'; }
    });
  };

  // ---- edge arrows for off-screen players: stacked per side so they never overlap
  const offBox = $('offscreen'), offEls = new Map(), GAP = 44;
  const more = { l: mk('off l more'), r: mk('off r more') };
  function mk(cls) { const e = document.createElement('div'); e.className = cls; offBox.appendChild(e); return e; }
  ui.updateOffscreen = (list) => {
    const top = 70, bottom = innerHeight - 140, fit = Math.max(1, Math.floor((bottom - top) / GAP) + 1);
    const live = new Set();
    for (const side of ['l', 'r']) {
      // nearest first; whoever doesn't fit collapses into a "+N" chip
      const all = list.filter((o) => o.side === side).sort((a, b) => a.dist - b.dist);
      const shown = all.length > fit ? all.slice(0, fit - 1) : all;
      const extra = all.length - shown.length;
      const items = shown.map((o) => ({ o, y: Math.max(top, Math.min(bottom, o.y)) }));
      if (extra) items.push({ o: null, y: bottom });
      items.sort((a, b) => a.y - b.y);
      for (let i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + GAP);
      for (let i = items.length - 1; i >= 0; i--) items[i].y = Math.min(items[i].y, i === items.length - 1 ? bottom : items[i + 1].y - GAP);
      more[side].style.display = extra ? '' : 'none';
      for (const { o, y } of items) {
        let el = more[side];
        if (o) {
          live.add(o.id);
          el = offEls.get(o.id);
          if (!el) { el = mk('off'); el.innerHTML = '<canvas></canvas><span></span><b></b>'; offEls.set(o.id, el); }
          if (el.dataset.k !== o.char + o.name + side) {
            el.dataset.k = o.char + o.name + side;
            el.className = `off ${side}`;
            el.querySelector('span').textContent = o.name;
            el.querySelector('b').textContent = side === 'l' ? '◀' : '▶';
            drawCharacter(el.querySelector('canvas'), CHAR_BY_ID[o.char], 0.6);
          }
        } else el.innerHTML = `<b>${side === 'l' ? '◀' : '▶'}</b><span>+${extra}</span>`;
        el.style.transform = `translateY(${y - 18}px)`;
      }
    }
    for (const [id, el] of offEls) if (!live.has(id)) { el.remove(); offEls.delete(id); }
  };

  // ---- online + status
  ui.setOnline = (list) => { $('onlineCount').textContent = list.length; };
  ui.setStatus = (s) => {
    const el = $('status');
    const txt = { offline: '🔌 Reconectando…', full: '😅 El mundo está lleno, reintentando…', connecting: '⏳ Conectando…' }[s];
    el.classList.toggle('hidden', !txt);
    if (txt) el.textContent = txt;
  };

  // ---- toasts
  ui.toast = (html, opts = {}) => {
    const t = document.createElement('div');
    t.className = 'toast' + (opts.big ? ' big' : '');
    if (opts.color) t.style.setProperty('--c', opts.color);
    t.innerHTML = html;
    const box = $('toasts');
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.classList.add('bye'); setTimeout(() => t.remove(), 320); }, opts.ms || 2600);
  };

  // ---- places
  ui.discover = (poi) => {
    if (progress.visited.includes(poi.id)) return false;
    progress.visited.push(poi.id); save();
    poiEls[POIS.indexOf(poi)].classList.add('found');
    sfx.discover();
    ui.toast(`<span class="ti">${poi.icon}</span><span><small>¡Nuevo lugar!</small>${poi.name}</span>`, { big: true, color: poi.color, ms: 3200 });
    return true;
  };
  let nearId = null;
  const ib = $('interactBtn');
  ui.setNear = (poi) => {
    const id = poi?.id || null;
    if (id === nearId) return;
    nearId = id;
    poiEls.forEach((e, i) => e.classList.toggle('near', POIS[i].id === id));
    ib.classList.toggle('show', !!poi && !ui.modalOpen);
    ib.setAttribute('aria-hidden', poi ? 'false' : 'true');
    if (poi) {
      ib.querySelector('.ib-icon').textContent = poi.icon;
      ib.querySelector('.ib-text').innerHTML = `Entrar${isTouch ? '' : ' <kbd>E</kbd>'}`;
    }
  };
  ib.onclick = () => ui.onInteract?.();

  // live-refresh the Sala de Juegos window when the party changes
  ui.onPartyChange = () => { if (ui.modalOpen && ui.currentPoi?.poi.id === 'arcade') ui.rerenderPoi(); };

  // ---- stars
  let starPop;
  ui.collectStar = (sx, sy) => {
    progress.stars++; save();
    const target = $('starChip').getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'fly-star'; s.textContent = '⭐';
    document.body.appendChild(s);
    const tx = target.left + 14, ty = target.top + 6;
    const midX = sx + (tx - sx) * 0.3, midY = Math.min(sy, ty) - 60;
    s.animate([
      { transform: `translate(${sx - 13}px, ${sy - 13}px) scale(1.2)` },
      { transform: `translate(${midX}px, ${midY}px) scale(1.5) rotate(90deg)`, offset: 0.35 },
      { transform: `translate(${tx - 13}px, ${ty - 8}px) scale(.7) rotate(360deg)` },
    ], { duration: 650, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => {
      s.remove();
      $('starCount').textContent = progress.stars;
      const chip = $('starChip');
      chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop');
      clearTimeout(starPop); starPop = setTimeout(() => chip.classList.remove('pop'), 500);
    };
  };
  ui.bumpProgress = (k) => { progress[k]++; save(); };

  // ---- emotes
  EMOTES.forEach((e, i) => {
    const b = document.createElement('button');
    b.className = i >= 4 ? 'emote act' : 'emote'; b.innerHTML = `${e}<kbd>${i + 1}</kbd>`;
    b.setAttribute('aria-label', `Emoji ${e}`);
    b.onclick = () => ui.onEmote?.(i);
    $('emotes').appendChild(b);
  });

  // ---- touch controls: slide pad on the left, jump on the right
  const pad = $('pad'), knob = $('padKnob'), jumpBtn = $('jumpBtn');
  ui.showTouch = (v) => $('touch').classList.toggle('hidden', !(v && isTouch));
  ui.showTouch(true);
  let padId = null;
  const padMove = (e) => {
    const r = pad.getBoundingClientRect();
    const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2 - 20)));
    const dy = e.clientY - (r.top + r.height / 2);
    ui.touch.left = dx < -0.18; ui.touch.right = dx > 0.18; ui.touch.down = dy > r.height * 0.42;
    knob.style.transform = `translate(${dx * (r.width / 2 - 34)}px, ${Math.max(-8, Math.min(18, dy * 0.4))}px)`;
    pad.classList.toggle('left', ui.touch.left); pad.classList.toggle('right', ui.touch.right);
  };
  const padEnd = (e) => {
    if (e.pointerId !== padId) return;
    padId = null; ui.touch.left = ui.touch.right = ui.touch.down = false;
    knob.style.transform = ''; pad.classList.remove('active', 'left', 'right');
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault(); padId = e.pointerId; pad.setPointerCapture?.(e.pointerId);
    pad.classList.add('active'); padMove(e);
    try { navigator.vibrate?.(5); } catch { /* unsupported */ }
  });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) { e.preventDefault(); padMove(e); } });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, padEnd);
  jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); jumpBtn.setPointerCapture?.(e.pointerId);
    ui.touch.jump = true; jumpBtn.classList.add('on'); ui.onJump?.();
    try { navigator.vibrate?.(6); } catch { /* unsupported */ }
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) jumpBtn.addEventListener(ev, () => { ui.touch.jump = false; jumpBtn.classList.remove('on'); });
  for (const el of [pad, jumpBtn]) el.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- modal
  const modal = $('modal');
  let closing = false;
  ui.openPoi = (poi, extra) => {
    const c = POI_CONTENT[poi.id];
    ui.modalOpen = true;
    Object.keys(ui.touch).forEach((k) => { ui.touch[k] = false; });
    ib.classList.remove('show');
    modal.style.setProperty('--pc', poi.color);
    modal.style.setProperty('--pc-d', shade(poi.color, -0.3));
    $('modalIcon').textContent = poi.icon;
    $('modalTitle').textContent = poi.name;
    $('modalSub').textContent = c.sub;
    modal.querySelector('.wip').classList.toggle('hidden', c.wip === false);
    const ctx = {
      ...extra, profile, progress, sfx, isTouch, party: ui.party, close: () => ui.closeModal(),
      changeChar: (id) => { profile.char = id; drawMe(); ui.onCharChange?.(id); sfx.select(); saveProfile(profile); },
    };
    ui.currentPoi = { poi, ctx };
    const render = () => { $('modalBody').innerHTML = c.body(ctx); c.bind?.($('modalBody'), ctx); };
    ui.rerenderPoi = render;
    render();
    modal.classList.remove('hidden', 'closing');
    sfx.open();
    setTimeout(() => modal.querySelector('.modal-close').focus({ preventScroll: true }), 60);
  };
  ui.closeModal = () => {
    if (!ui.modalOpen || closing) return;
    closing = true;
    modal.classList.add('closing');
    sfx.close();
    setTimeout(() => {
      modal.classList.add('hidden'); modal.classList.remove('closing');
      closing = false; ui.modalOpen = false; ui.currentPoi = null;
      if (nearId) ib.classList.add('show');
      document.activeElement?.blur?.();
      ui.onModalClose?.();
    }, 240);
  };
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) ui.closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ui.closeModal(); });

  // every HUD/modal button gets a tap sound (game pieces with their own sound are skipped)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.closest('#touch') || b.classList.contains('emote') || b.classList.contains('char') || b.classList.contains('word') || b.id === 'muteBtn' || b.id === 'fsBtn') return;
    sfx.tap();
  }, true);

  $('hud').classList.remove('hidden');
  document.body.classList.add('in-game');
  return ui;
}

export function saveProfile(p) {
  try { localStorage.setItem('letWorldProfile', JSON.stringify({ name: p.name, char: p.char })); } catch { /* private mode */ }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
