# LET 2D Platformer

Minimal browser multiplayer platformer. Node + `ws` server (authoritative), Phaser 3 client (served from node_modules, no build step).

    npm install
    npm start        # http://localhost:3000
    npm test         # smoke test, needs the server running

Controls: Arrows / A D to move, Space / W / Up to jump.

- `shared/game.js`: level, physics, collisions (imported by both server and client)
- `server/index.js`: 60 Hz simulation, 30 Hz snapshots
- `public/`: name menu (HTML) and Phaser scene: input (keyboard + touch buttons), rendering, camera
- Art is generated in code (`makeTextures` in `public/main.js`); swap for real sprites with `this.load`

## Deploy on Render (free)

1. Push this repo to GitHub.
2. In Render: New > Blueprint, pick the repo. It reads `render.yaml`.
3. Deploy. The URL is `https://let-2d-platformer.onrender.com` (or similar).

The free plan sleeps after ~15 min idle; the first visit then takes 30-60 s to wake it. Open the URL before class.
The client uses `wss://` automatically on HTTPS.
