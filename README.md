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
