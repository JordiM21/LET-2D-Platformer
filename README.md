# Mundo LET

Browser multiplayer platformer for LET Junior students. Node + `ws` server, Phaser 3 client (served from node_modules, no build step). All art and sound are generated in code.

    npm install
    npm start        # http://localhost:3000
    npm test         # smoke test, needs the server running

Controls: Arrows / A D to move, Space / W / Up to jump (hold for higher), S / Down to drop through wooden planks, E / Enter to enter a place, 1-4 for emotes. On touch devices: slide your left thumb on the pad to move (drag down to drop through planks), tap the big round button on the right to jump.

## Minigame parties

The teacher logs in with the PIN (link "🍎 Soy profe" under the play button). The PIN comes from the `TEACHER_PIN` env var and defaults to `1234` for local testing, so set a real one on Render.

1. The teacher walks to the **Sala de Juegos** 🎮 (next to the Plaza), picks a game and a join time (20/30/60 s) and opens the party.
2. Everyone in the world gets an invite banner with a countdown and a "¡Unirme!" button, wherever they are.
3. Players who join wait in a shared lobby; the teacher can start early or cancel.
4. Everyone plays the same game, then sees a podium and returns to the world.

| Game | Mode | How it works |
|---|---|---|
| 🌟 Lluvia de Estrellas | Free-for-all, 75 s | Stars fall on a platform arena. Land on someone's head to knock 3 stars out of them. |
| 💣 Papa Caliente | Last one standing | Touch someone to pass the bomb before the fuse runs out. Losers become ghosts. |
| 🏰 Catapulta | Two teams, 150 s | Drag back and release to fling yourself at the other team's castle. Knock down their 3 crowns. Physics runs on the server (matter-js). |
| 🛡️ Defensa del Castillo | Co-op, 5 waves | Each player owns a tower that shoots on its own. Tap slimes, earn coins, upgrade your tower. |

Server code: `server/party.js` (lobby lifecycle) and `server/games/*.js` (one class per game, server-authoritative). Client: `public/party.js` (invite, lobby, results) and `public/games/*.js` (one Phaser scene per game). Shared layouts and tuning: `shared/minigames.js`.

## How it fits together

- `shared/game.js`: world layout, tile collisions, movement physics, places (POIS), stars, characters. Imported by server and client.
- `server/index.js`: relays player state at 20 Hz. Each client simulates its own movement (instant response, no input lag); the server rejects impossible moves and snaps the cheater back.
- `public/main.js`: login screen (name + character) and the wipe transition into the game.
- `public/scene.js`: the Phaser scene. Fixed 120 Hz physics with render interpolation, camera with look-ahead, parallax, particles, stars, places, ambient life.
- `public/rig.js`: procedural character animation (squash and stretch spring, run cycle, blinking, emotes). Same code for local and remote players.
- `public/ui.js` + `public/pois.js`: HUD, touch controls, toasts, and the modal for each place.
- `public/art.js`, `public/characters.js`, `public/audio.js`: generated art and synth sounds. Replace any texture with a real image by loading it under the same key.

## Tuning the feel

Everything about movement is in `PHYS` in `shared/game.js`: acceleration, coyote time, jump buffering, variable jump height, apex hang, fall speed, bounce pads. The world is built with small helpers (`ground`, `plank`, `block`, `bounce`) in the same file; a full jump clears about 3.5 tiles up and 5 tiles across.

## Places (WIP)

Mi Casa (change character, stats), Plaza Central (who is online), Tablón de Misiones (quests with real progress: stars, places, greetings), Biblioteca (word flip cards with voice), Torre de Retos (challenges, locked). Progress is saved in the browser for now.

## Deploy on Render (free)

1. Push this repo to GitHub.
2. In Render: New > Blueprint, pick the repo. It reads `render.yaml`.
3. Deploy. The URL is `https://let-2d-platformer.onrender.com` (or similar).

The free plan sleeps after ~15 min idle; the first visit then takes 30-60 s to wake it. The client keeps retrying the connection and shows "Reconectando…" meanwhile.
