// Content for each place's modal. All WIP: real data where we have it, locked cards where we don't yet.
import { CHARACTERS, POIS } from '/shared/game.js';
import { drawCharacter, CHAR_BY_ID } from './characters.js';
import { GAMES, GAME_IDS, LOBBY_SECS } from '/shared/minigames.js';

let pickedGame = GAME_IDS[0], pickedSecs = 30;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const locked = (icon, title, sub) => `<div class="card locked"><span class="ci">${icon}</span><b>${title}</b><small>${sub}</small></div>`;

export const POI_CONTENT = {
  arcade: {
    sub: 'Minijuegos para jugar todos juntos',
    wip: false,
    body: (ctx) => {
      const party = ctx.party?.state, teacher = ctx.party?.isTeacher;
      const cards = GAME_IDS.map((id) => {
        const g = GAMES[id];
        return `<button class="gcard${teacher && !party && id === pickedGame ? ' on' : ''}" data-g="${id}" style="--gc:${g.color}" ${teacher && !party ? '' : 'tabindex="-1"'}>
          <span class="gc-icon">${g.icon}</span><b>${g.name}</b><span class="gc-mode">${g.mode}</span><small>${g.blurb}</small></button>`;
      }).join('');
      let top;
      if (party) {
        const g = GAMES[party.game];
        const member = party.members.some((m) => m.id === ctx.myId);
        top = `<div class="pstatus" style="--gc:${g.color}"><span class="gc-icon">${g.icon}</span>
          <div><b>${g.name}</b><small>${party.phase === 'lobby' ? `Abierta · empieza en ${party.left}s · ${party.members.length} jugando` : `En curso · ${party.members.length} jugando`}</small></div>
          ${party.phase === 'lobby' && !member ? '<button class="btn btn-primary" data-a="join">¡Unirme!</button>' : ''}
          ${teacher && party.host === ctx.myId ? '<button class="btn" data-a="cancel">Cerrar partida</button>' : ''}</div>`;
      } else if (teacher) {
        top = `<div class="popen">
          <div class="secs"><span>⏱ Tiempo para unirse</span>${LOBBY_SECS.map((s) => `<button class="seg${s === pickedSecs ? ' on' : ''}" data-s="${s}">${s}s</button>`).join('')}</div>
          <button class="btn btn-primary btn-big" data-a="open">🎉 ¡Abrir partida!</button></div>`;
      } else {
        top = '<p class="note">🍎 Cuando el profe abra una partida, te llegará una invitación arriba en la pantalla. ¡Mientras tanto, mira los juegos!</p>';
      }
      return `${top}<div><h3 class="sec-title">🕹️ ${teacher && !party ? 'Elige un juego' : 'Juegos'}</h3><div class="gcards">${cards}</div></div>`;
    },
    bind: (el, ctx) => {
      el.querySelectorAll('.gcard').forEach((b) => {
        b.onclick = () => {
          if (!ctx.party?.isTeacher || ctx.party.state) return;
          pickedGame = b.dataset.g;
          el.querySelectorAll('.gcard').forEach((o) => o.classList.toggle('on', o === b));
          ctx.sfx.select();
        };
      });
      el.querySelectorAll('.seg').forEach((b) => {
        b.onclick = () => { pickedSecs = +b.dataset.s; el.querySelectorAll('.seg').forEach((o) => o.classList.toggle('on', o === b)); ctx.sfx.select(); };
      });
      el.querySelectorAll('[data-a]').forEach((b) => {
        b.onclick = () => {
          const a = b.dataset.a;
          if (a === 'open') ctx.party.open(pickedGame, pickedSecs);
          if (a === 'join') { ctx.party.join(); ctx.close(); }
          if (a === 'cancel') ctx.party.cancel();
        };
      });
    },
  },

  home: {
    sub: 'Tu rincón en el mundo',
    body: (ctx) => `
      <div class="stats">
        <div class="stat"><b>${ctx.progress.stars}</b><small>⭐ estrellas</small></div>
        <div class="stat"><b>${ctx.progress.visited.length}/${POIS.length}</b><small>🗺️ lugares</small></div>
        <div class="stat"><b>${ctx.progress.emotes}</b><small>👋 saludos</small></div>
      </div>
      <div>
        <h3 class="sec-title">🪞 Cambia de personaje</h3>
        <div class="mini-chars chars" role="radiogroup" aria-label="Personajes">
          ${CHARACTERS.map((c) => `<button class="char" role="radio" data-char="${c.id}" aria-checked="${c.id === ctx.profile.char}" style="--c:${c.dark};--cbg:${c.belly}"><canvas></canvas><span>${c.name}</span><small>${c.kind}</small></button>`).join('')}
        </div>
      </div>
      <div class="cards">
        ${locked('🛋️', 'Decora tu cuarto', 'Muebles, pósters y más')}
        ${locked('👕', 'Tu ropa', 'Gorros, gafas y capas')}
      </div>`,
    bind: (el, ctx) => {
      el.querySelectorAll('.char').forEach((b) => {
        drawCharacter(b.querySelector('canvas'), CHAR_BY_ID[b.dataset.char], 2);
        b.onclick = () => {
          el.querySelectorAll('.char').forEach((o) => o.setAttribute('aria-checked', 'false'));
          b.setAttribute('aria-checked', 'true');
          ctx.changeChar(b.dataset.char);
        };
      });
    },
  },

  plaza: {
    sub: 'El punto de encuentro de todos',
    body: (ctx) => `
      <div>
        <h3 class="sec-title">🟢 Conectados ahora (${ctx.online.length})</h3>
        <div class="people">
          ${ctx.online.map((p, i) => `<span class="person${p.id === ctx.myId ? ' me' : ''}" style="animation-delay:${i * 0.05}s" data-char="${esc(p.c)}"><canvas></canvas>${esc(p.n)}${p.id === ctx.myId ? ' (tú)' : ''}</span>`).join('')}
        </div>
      </div>
      <p class="note">💡 ${ctx.isTouch ? 'Toca los botones de emoji' : 'Pulsa <b>1-6</b>'} para saludar a tus amigos.</p>
      <div class="cards">
        ${locked('🎉', 'Fiesta de inglés', 'Eventos con todos los alumnos')}
        ${locked('🧑‍🏫', 'Clase en vivo', 'Aquí te reunirás con tu profe')}
        ${locked('🎵', 'Karaoke', 'Canta en inglés con amigos')}
      </div>`,
    bind: (el) => {
      el.querySelectorAll('.person').forEach((p) => {
        const ch = CHAR_BY_ID[p.dataset.char];
        if (ch) drawCharacter(p.querySelector('canvas'), ch, 1.5);
      });
    },
  },

  quests: {
    sub: 'Completa misiones y gana premios',
    body: (ctx) => {
      const q = [
        { icon: '⭐', title: 'Coleccionista', sub: 'Recoge 25 estrellas', have: ctx.progress.stars, need: 25, xp: 50 },
        { icon: '🗺️', title: 'Explorador', sub: `Descubre los ${POIS.length} lugares`, have: ctx.progress.visited.length, need: POIS.length, xp: 80 },
        { icon: '👋', title: 'Súper amigo', sub: 'Saluda 10 veces', have: ctx.progress.emotes, need: 10, xp: 30 },
        { icon: '🏆', title: 'A la cima', sub: 'Llega a la Torre de Retos', have: ctx.progress.visited.includes('arena') ? 1 : 0, need: 1, xp: 40 },
      ];
      return `
        ${q.map((m) => {
          const done = m.have >= m.need, pct = Math.min(100, (m.have / m.need) * 100);
          return `<div class="quest${done ? ' done' : ''}">
            <span class="qi">${done ? '✅' : m.icon}</span>
            <div><b>${m.title}</b><small>${m.sub} · ${Math.min(m.have, m.need)}/${m.need}</small><div class="bar"><i data-w="${pct}"></i></div></div>
            <span class="reward">${done ? '¡Hecho!' : `+${m.xp} XP`}</span>
          </div>`;
        }).join('')}
        <p class="note">🚧 Muy pronto: misiones de inglés cada semana y premios de verdad.</p>`;
    },
    bind: (el) => requestAnimationFrame(() => el.querySelectorAll('.bar i').forEach((i) => { i.style.width = i.dataset.w + '%'; })),
  },

  library: {
    sub: 'Palabras nuevas cada día',
    body: () => `
      <div>
        <h3 class="sec-title">📖 Palabras del día <small style="font-weight:700;opacity:.6">toca para girar</small></h3>
        <div class="cards">
          ${[['🐶', 'dog', 'perro'], ['🍎', 'apple', 'manzana'], ['☀️', 'sun', 'sol']].map(([i, en, es]) => `
            <button class="word" data-say="${en}"><div class="word-in">
              <div class="word-face"><span class="ci">${i}</span><small>¿Cómo se dice?</small><b>${es}</b></div>
              <div class="word-face word-back"><span class="ci">${i}</span><b>${en}</b><small>🔊 escucha</small></div>
            </div></button>`).join('')}
        </div>
      </div>
      <div class="cards">
        ${locked('📚', 'Cuentos en inglés', 'Lee y escucha historias')}
        ${locked('🔤', 'Mi diccionario', 'Guarda tus palabras')}
      </div>`,
    bind: (el, ctx) => {
      el.querySelectorAll('.word').forEach((w) => {
        w.onclick = () => {
          w.classList.toggle('flip');
          ctx.sfx.select();
          if (w.classList.contains('flip') && 'speechSynthesis' in window) {
            try {
              speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(w.dataset.say); u.lang = 'en-US'; u.rate = 0.85;
              speechSynthesis.speak(u);
            } catch { /* no voices */ }
          }
        };
      });
    },
  },

  arena: {
    sub: '¡Llegaste a la cima! Pon a prueba tu inglés',
    body: () => `
      <div class="cards">
        ${locked('⚡', 'Reto relámpago', '10 preguntas contra el reloj')}
        ${locked('🧠', 'Duelo de palabras', 'Compite con un amigo')}
        ${locked('🏁', 'Carrera', 'Obstáculos + inglés')}
        ${locked('🥇', 'Ranking', 'Los mejores de la semana')}
      </div>
      <p class="note">🚧 Los retos se abren muy pronto. ¡Sigue practicando!</p>`,
  },
};
