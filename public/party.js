// Party flow on the client: invite banner, lobby screen, switching into a minigame scene and back,
// and the results podium.
import { GAMES } from '/shared/minigames.js';
import { drawCharacter, CHAR_BY_ID } from './characters.js';
import { sfx } from './audio.js';
import { GameHud, esc } from './games/common.js';
import { StarsScene } from './games/stars.js';
import { PotatoScene } from './games/potato.js';
import { CatapultScene } from './games/catapult.js';
import { DefenseScene } from './games/defense.js';

const SCENES = { stars: ['g-stars', StarsScene], potato: ['g-potato', PotatoScene], catapult: ['g-catapult', CatapultScene], defense: ['g-defense', DefenseScene] };
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createParty({ ui, net, profile, game }) {
  for (const [key, cls] of Object.values(SCENES)) game.scene.add(key, cls, false);

  const st = { party: null, sceneKey: null, hud: null, busy: false, lastInviteId: null, queue: [] };
  const isMember = (p) => !!p?.members.some((m) => m.id === net.id);

  const api = {
    get state() { return st.party; },
    get isTeacher() { return net.role === 'teacher'; },
    open: (g, secs) => net.send({ t: 'party-open', game: g, secs }),
    join: () => { net.send({ t: 'party-join' }); sfx.open(); },
    leave: () => { net.send({ t: 'party-leave' }); sfx.close(); },
    start: () => net.send({ t: 'party-start' }),
    cancel: () => net.send({ t: 'party-cancel' }),
  };
  ui.party = api;
  window.__party = api; // debugging handle, like window.__game

  // ---------------------------------------------------------------- invite banner (in the world)
  const invite = document.createElement('div');
  invite.className = 'invite hidden';
  $('hud').appendChild(invite);
  function renderInvite(p) {
    const show = p && !isMember(p) && !st.sceneKey;
    invite.classList.toggle('hidden', !show);
    if (!show) return;
    const g = GAMES[p.game];
    invite.style.setProperty('--gc', g.color);
    // rebuild only when the party or phase changes; otherwise just tick the seconds
    const key = `${p.id}:${p.phase}`;
    if (invite.dataset.key !== key) {
      invite.dataset.key = key;
      if (p.phase === 'lobby') {
        invite.innerHTML = `<span class="inv-icon">${g.icon}</span>
          <span class="inv-text"><small>${esc(p.hostName)} abrió una partida</small><b>${esc(g.name)}</b></span>
          <span class="inv-time"></span>
          <button class="btn btn-primary inv-join">¡Unirme!</button>`;
        invite.querySelector('.inv-join').onclick = api.join;
        invite.classList.remove('playing');
        if (st.lastInviteId !== p.id) { st.lastInviteId = p.id; sfx.discover(); invite.classList.remove('pop'); void invite.offsetWidth; invite.classList.add('pop'); }
      } else {
        invite.innerHTML = `<span class="inv-icon">${g.icon}</span><span class="inv-text"><small>Partida en curso</small><b>${esc(g.name)} · <span class="inv-n"></span> 🎮</b></span>`;
        invite.classList.add('playing');
      }
    }
    const tEl = invite.querySelector('.inv-time'); if (tEl) tEl.textContent = `${p.left}s`;
    const nEl = invite.querySelector('.inv-n'); if (nEl) nEl.textContent = p.members.length;
  }

  // ---------------------------------------------------------------- lobby
  const lobby = document.createElement('div');
  lobby.className = 'lobby hidden';
  lobby.innerHTML = `<div class="lobby-card">
      <div class="lobby-head"><div class="lobby-icon"></div><div><span class="lobby-mode"></span><h2></h2><p></p></div></div>
      <div class="lobby-how"></div>
      <div class="lobby-mid">
        <div class="lobby-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="ring-bg"/><circle cx="50" cy="50" r="44" class="ring-fg"/></svg><b class="lobby-left">30</b><small>para empezar</small></div>
        <div class="lobby-people"></div>
      </div>
      <div class="lobby-foot"></div>
    </div>`;
  document.body.appendChild(lobby);
  let lobbyTotal = 30;
  const shownPeople = new Set();
  function renderLobby(p) {
    const show = p && p.phase === 'lobby' && isMember(p);
    ui.inLobby = !!show; // the world stops listening to controls while the lobby is up
    if (!show) {
      if (!lobby.classList.contains('hidden')) {
        lobby.classList.add('closing'); setTimeout(() => lobby.classList.add('hidden'), 250);
        if (!st.sceneKey && !(p && p.phase === 'playing' && isMember(p))) ui.showTouch(true); // left or cancelled: back to the world
      }
      shownPeople.clear();
      return;
    }
    const g = GAMES[p.game];
    if (lobby.classList.contains('hidden')) {
      lobby.classList.remove('hidden', 'closing');
      lobbyTotal = Math.max(p.left, 1);
      lobby.querySelector('.lobby-people').innerHTML = '';
      ui.closeModal?.();
      ui.showTouch(false);
    }
    if (lobby.dataset.pid !== String(p.id)) {
      lobby.dataset.pid = p.id;
      lobby.style.setProperty('--gc', g.color);
      lobby.querySelector('.lobby-icon').textContent = g.icon;
      lobby.querySelector('.lobby-mode').textContent = g.mode;
      lobby.querySelector('h2').textContent = g.name;
      lobby.querySelector('.lobby-head p').textContent = g.blurb;
      lobby.querySelector('.lobby-how').innerHTML = g.how.map((h, i) => `<span style="animation-delay:${0.2 + i * 0.08}s">${h}</span>`).join('');
    }
    lobby.querySelector('.lobby-left').textContent = p.left;
    lobby.querySelector('.ring-fg').style.strokeDashoffset = String(276.5 * (1 - p.left / lobbyTotal));
    lobby.classList.toggle('hurry', p.left <= 5);
    if (p.left <= 5 && p.left > 0 && p.left !== st.lastLeft) sfx.near();
    st.lastLeft = p.left;
    // people: add new ones with a pop, drop the ones who left
    const box = lobby.querySelector('.lobby-people');
    const ids = new Set(p.members.map((m) => m.id));
    for (const el of [...box.children]) if (!ids.has(+el.dataset.id)) { el.remove(); shownPeople.delete(+el.dataset.id); }
    p.members.forEach((m) => {
      if (shownPeople.has(m.id)) return;
      shownPeople.add(m.id);
      const el = document.createElement('div');
      el.className = 'lp' + (m.id === net.id ? ' me' : '');
      el.dataset.id = m.id;
      el.innerHTML = `<canvas></canvas><span>${m.r ? '🍎 ' : ''}${esc(m.n)}</span>`;
      drawCharacter(el.querySelector('canvas'), CHAR_BY_ID[m.c] || CHAR_BY_ID.fox, 2);
      box.appendChild(el);
      if (m.id !== net.id) sfx.join();
    });
    const foot = lobby.querySelector('.lobby-foot');
    const teacher = p.host === net.id;
    const key = `${teacher}`;
    if (foot.dataset.key !== key) {
      foot.dataset.key = key;
      foot.innerHTML = teacher
        ? '<button class="btn" data-a="cancel">Cancelar</button><button class="btn btn-primary btn-big" data-a="start">🚀 ¡Empezar ya!</button>'
        : '<button class="btn" data-a="leave">Salir</button><span class="lobby-wait">Esperando a más jugadores…</span>';
      foot.querySelectorAll('button').forEach((b) => { b.onclick = () => api[b.dataset.a](); });
    }
  }

  function onParty(p) {
    const prev = st.party;
    st.party = p;
    renderInvite(p);
    renderLobby(p);
    if (!p && prev && prev.phase === 'lobby' && isMember(prev) && !st.sceneKey) ui.toast('La partida se canceló');
    ui.onPartyChange?.(p);
  }

  // ---------------------------------------------------------------- into the game and back
  async function wipe(inOut) {
    const w = $('wipe');
    if (inOut === 'in') { w.style.setProperty('--wx', '50%'); w.style.setProperty('--wy', '50%'); w.className = 'wipe in'; await wait(560); w.className = 'wipe hold'; }
    else { w.className = 'wipe out'; await wait(620); w.className = 'wipe'; }
  }

  async function enterGame(m) {
    const entry = SCENES[m.game];
    if (!entry || st.busy) return;
    st.busy = true;
    const def = GAMES[m.game];
    $('wipe').querySelector('.wipe-logo').innerHTML = `${def.icon} ${esc(def.name)}`;
    await wait(250);
    await wipe('in');
    lobby.classList.add('hidden');
    ui.closeModal?.();
    $('hud').classList.add('hidden');
    game.scene.sleep('world');
    st.hud = new GameHud(def);
    st.sceneKey = entry[0];
    st.queue = [];
    game.scene.start(entry[0], { ui, net, profile, def, init: m.init, hud: st.hud });
    await wait(200);
    await wipe('out');
    st.busy = false;
  }

  async function exitGame() {
    if (!st.sceneKey) return;
    while (st.busy) await wait(50);
    st.busy = true;
    $('wipe').querySelector('.wipe-logo').innerHTML = 'Mundo <span>LET</span>';
    await wipe('in');
    game.scene.stop(st.sceneKey);
    st.sceneKey = null;
    st.hud?.destroy(); st.hud = null;
    results.classList.add('hidden');
    $('hud').classList.remove('hidden');
    game.scene.wake('world');
    ui.showTouch(true);
    renderInvite(st.party);
    await wait(150);
    await wipe('out');
    st.busy = false;
  }

  // ---------------------------------------------------------------- results
  const results = document.createElement('div');
  results.className = 'results hidden';
  document.body.appendChild(results);
  function showResults(m) {
    const def = GAMES[m.game];
    const list = m.results || [];
    const me = list.find((r) => r.id === net.id);
    let title;
    if (m.game === 'catapult') title = m.winner === null ? '🤝 ¡Empate!' : `🏆 ¡Gana el equipo ${m.winner === 0 ? 'Rojo' : 'Azul'}!`;
    else if (m.game === 'defense') title = m.win ? '🎉 ¡Castillo salvado!' : `😵 Los slimes entraron en la oleada ${m.wave}`;
    else title = list[0] ? `🏆 ¡${esc(list[0].name)} gana!` : '¡Fin!';
    const unit = m.unit === 'pts' ? '' : ` ${m.unit}`;
    const podium = [list[1], list[0], list[2]].map((r, i) => r ? `
      <div class="pod p${[2, 1, 3][i]}${r.id === net.id ? ' me' : ''}" style="animation-delay:${[0.5, 0.8, 0.3][i]}s">
        <canvas data-c="${esc(r.char)}"></canvas><span class="pn">${esc(r.name)}</span><span class="ps">${r.score}${unit}</span>
        <div class="pb"><b>${r.rank}</b></div>
      </div>` : '<div class="pod empty"></div>').join('');
    const rest = list.slice(3).map((r) => `<div class="rrow${r.id === net.id ? ' me' : ''}"><b>#${r.rank}</b><span>${esc(r.name)}</span><span>${r.score}${unit}</span></div>`).join('');
    results.style.setProperty('--gc', def.color);
    results.innerHTML = `<div class="res-card">
        <div class="res-confetti">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${Math.random() * 100}%;--d:${Math.random() * 1.2}s;--c:${['#FF5A5F', '#FFC83D', '#3CC7A8', '#58B8F2', '#B982FF', '#CA4B15'][i % 6]}"></i>`).join('')}</div>
        <span class="res-kicker">${def.icon} ${esc(def.name)}</span>
        <h2>${title}</h2>
        ${me ? `<p class="res-me">Quedaste <b>#${me.rank}</b>${m.game === 'catapult' ? ` · equipo ${me.team ? 'Azul' : 'Rojo'}` : ''}</p>` : ''}
        <div class="podium">${podium}</div>
        ${rest ? `<div class="res-rest">${rest}</div>` : ''}
        <div class="res-back"><span>Volviendo al mundo…</span><div class="res-bar"><i></i></div></div>
      </div>`;
    results.querySelectorAll('canvas[data-c]').forEach((c) => drawCharacter(c, CHAR_BY_ID[c.dataset.c] || CHAR_BY_ID.fox, 2));
    results.classList.remove('hidden');
    sfx.discover();
    setTimeout(() => sfx.appear(), 900);
    ui.showTouch(false);
  }

  // ---------------------------------------------------------------- wiring
  net.on('welcome', (m) => {
    if (st.sceneKey) exitGame(); // reconnected mid-game: the server already dropped us
    onParty(m.party);
    if (!m.again && m.role === 'teacher') ui.toast('🍎 Modo profe activado: abre partidas en la <b>Sala de Juegos</b> 🎮', { ms: 4200 });
    else if (!m.again && profile.pin && m.role !== 'teacher') ui.toast('PIN incorrecto: entras como alumno', { ms: 3000 });
  });
  net.on('party', (m) => onParty(m.p));
  net.on('g-start', (m) => enterGame(m));
  // game messages can arrive before the scene has finished building: queue until it's ready
  net.on('g', (m) => {
    if (!st.sceneKey) return;
    const sc = game.scene.getScene(st.sceneKey);
    st.queue.push(m);
    if (!sc?.ready) return;
    for (const q of st.queue.splice(0)) sc.onNet(q);
  });
  net.on('g-end', (m) => showResults(m));
  net.on('g-close', () => exitGame());

  return api;
}
