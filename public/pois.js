// Content for each place's modal. All WIP: real data where we have it, locked cards where we don't yet.
import { CHARACTERS, POIS } from '/shared/game.js';
import { drawCharacter, CHAR_BY_ID } from './characters.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const locked = (icon, title, sub) => `<div class="card locked"><span class="ci">${icon}</span><b>${title}</b><small>${sub}</small></div>`;

export const POI_CONTENT = {
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
      <p class="note">💡 Pulsa <b>1-4</b> (o los botones) para saludar a tus amigos con un emoji.</p>
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
        { icon: '🗺️', title: 'Explorador', sub: 'Descubre los 5 lugares', have: ctx.progress.visited.length, need: POIS.length, xp: 80 },
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
