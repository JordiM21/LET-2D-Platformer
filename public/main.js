// Login screen (name + character) and the transition into the world.
import { CHARACTERS, sanitizeName } from '/shared/game.js';
import { drawCharacter, CHAR_BY_ID } from './characters.js';
import { sfx } from './audio.js';
import { createUI, saveProfile } from './ui.js';
import { Net } from './net.js';
import { WorldScene } from './scene.js';
import { createParty } from './party.js';

const $ = (id) => document.getElementById(id);

let profile = { name: '', char: CHARACTERS[0].id };
try { Object.assign(profile, JSON.parse(localStorage.getItem('letWorldProfile')) || {}); } catch { /* first visit */ }
if (!CHAR_BY_ID[profile.char]) profile.char = CHARACTERS[0].id;

const nameInput = $('name');
const pinInput = $('pin');
try { pinInput.value = localStorage.getItem('letWorldPin') || ''; } catch { /* private mode */ }
if (pinInput.value) { pinInput.classList.remove('hidden'); $('teacherToggle').classList.add('on'); }
$('teacherToggle').onclick = () => {
  const show = pinInput.classList.toggle('hidden') === false;
  $('teacherToggle').classList.toggle('on', show);
  if (show) pinInput.focus(); else pinInput.value = '';
  sfx.select();
};
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('is-touch');
nameInput.value = profile.name || '';

// ---- character picker
const grid = $('chars');
CHARACTERS.forEach((c, i) => {
  const b = document.createElement('button');
  b.className = 'char'; b.type = 'button';
  b.setAttribute('role', 'radio');
  b.dataset.char = c.id;
  b.style.setProperty('--c', c.dark); b.style.setProperty('--cbg', c.belly);
  b.style.animationDelay = `${0.15 + i * 0.06}s`;
  b.innerHTML = `<canvas></canvas><span>${c.name}</span><small>${c.kind}</small>`;
  drawCharacter(b.querySelector('canvas'), c, 2);
  b.onclick = () => pick(c.id, true);
  grid.appendChild(b);
});
grid.addEventListener('keydown', (e) => {
  const i = CHARACTERS.findIndex((c) => c.id === profile.char);
  const d = { ArrowRight: 1, ArrowDown: 3, ArrowLeft: -1, ArrowUp: -3 }[e.key];
  if (!d) return;
  e.preventDefault();
  const n = CHARACTERS[(i + d + CHARACTERS.length) % CHARACTERS.length];
  pick(n.id, true);
  grid.querySelector(`[data-char="${n.id}"]`).focus();
});

function pick(id, withSound) {
  profile.char = id;
  const c = CHAR_BY_ID[id];
  for (const b of grid.children) {
    const on = b.dataset.char === id;
    b.setAttribute('aria-checked', on);
    b.tabIndex = on ? 0 : -1;
  }
  const hero = $('heroChar');
  drawCharacter(hero, c, 3);
  hero.classList.remove('pop'); void hero.offsetWidth; hero.classList.add('pop');
  const bubble = $('heroBubble');
  const who = nameInput.value.trim();
  bubble.textContent = who ? `¡Hola ${sanitizeName(who)}! Soy ${c.name}` : `¡Hola! Soy ${c.name}`;
  bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = '';
  if (withSound) sfx.select();
}
pick(profile.char, false);
let typingT;
nameInput.addEventListener('input', () => {
  clearTimeout(typingT);
  typingT = setTimeout(() => pick(profile.char, false), 350);
});

// ---- start
let started = false;
async function start(ev) {
  if (started) return;
  const raw = nameInput.value.trim();
  if (!raw) {
    nameInput.classList.remove('shake'); void nameInput.offsetWidth; nameInput.classList.add('shake');
    nameInput.focus();
    return;
  }
  started = true;
  profile.name = sanitizeName(raw);
  profile.pin = pinInput.classList.contains('hidden') ? '' : pinInput.value.trim();
  try { localStorage.setItem('letWorldPin', profile.pin); } catch { /* private mode */ }
  saveProfile(profile);
  nameInput.blur();
  sfx.open();

  const wipe = $('wipe');
  const btn = $('play').getBoundingClientRect();
  wipe.style.setProperty('--wx', `${btn.left + btn.width / 2}px`);
  wipe.style.setProperty('--wy', `${btn.top + btn.height / 2}px`);
  wipe.className = 'wipe in';
  await wait(600);
  wipe.className = 'wipe hold';
  $('menu').classList.remove('active');
  $('game').classList.add('active');

  await Promise.race([document.fonts.load('600 16px Fredoka'), wait(1500)]).catch(() => {});

  const ui = createUI(profile);
  const net = new Net();
  net.on('status', (s) => ui.setStatus(s));
  ui.setStatus('connecting');

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#A9DDFF',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 3 },
    fps: { smoothStep: true },
  });
  game.scene.add('world', WorldScene, true, { ui, net, profile, onReady: async () => {
    net.connect(profile);
    await wait(250);
    wipe.className = 'wipe out';
    await wait(650);
    wipe.className = 'wipe';
  } });
  createParty({ ui, net, profile, game });
  window.__game = game; // handy for debugging in the console
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

$('play').onclick = start;
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
