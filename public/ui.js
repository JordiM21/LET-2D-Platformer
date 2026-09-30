// DOM layer: HUD, touch controls, toasts, modal. The Phaser scene talks to it through this object.
import { POIS, EMOTES, WORLD_W } from '/shared/game.js';
import { drawCharacter, CHAR_BY_ID } from './characters.js';
import { POI_CONTENT } from './pois.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const PKEY = 'letWorldProgress';

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
  };

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
    b.className = 'emote'; b.innerHTML = `${e}<kbd>${i + 1}</kbd>`;
    b.setAttribute('aria-label', `Emoji ${e}`);
    b.onclick = () => ui.onEmote?.(i);
    $('emotes').appendChild(b);
  });

  // ---- touch controls
  if (isTouch) $('touch').classList.remove('hidden');
  for (const b of $('touch').querySelectorAll('button')) {
    const k = b.dataset.k;
    const on = (e) => {
      e.preventDefault(); b.setPointerCapture?.(e.pointerId);
      ui.touch[k] = true; b.classList.add('on');
      if (k === 'jump') ui.onJump?.();
      try { navigator.vibrate?.(6); } catch { /* unsupported */ }
    };
    const off = (e) => { e.preventDefault(); ui.touch[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

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
    const ctx = {
      ...extra, profile, progress, sfx, isTouch,
      changeChar: (id) => { profile.char = id; drawMe(); ui.onCharChange?.(id); sfx.select(); saveProfile(profile); },
    };
    $('modalBody').innerHTML = c.body(ctx);
    c.bind?.($('modalBody'), ctx);
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
      closing = false; ui.modalOpen = false;
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
