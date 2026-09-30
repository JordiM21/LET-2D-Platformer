# LET 2D Platformer

Minimal browser multiplayer platformer. Node + `ws` server (authoritative), plain canvas client.

    npm install
    npm start        # http://localhost:3000
    npm test         # smoke test, needs the server running

Controls: Arrows / A D to move, Space / W / Up to jump.

- `shared/game.js`: level, physics, collisions (imported by both server and client)
- `server/index.js`: 60 Hz simulation, 30 Hz snapshots
- `public/`: menu (name entry), input, rendering
