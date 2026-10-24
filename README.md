# TankCraft PvP — TypeScript starter

A local two-player tank game prototype built with Phaser 3 and TypeScript. All tile and tank textures are generated in code, so this version does not require downloaded art assets.

## Included scenes and source files

```text
src/
  scenes/
    BattleScene.ts
    BuildScene.ts
    MenuScene.ts
    MineScene.ts
    PreloadScene.ts
    ResultScene.ts
  config.ts
  grid.ts
  main.ts
  state.ts
```

The project also includes `package.json`, `tsconfig.json`, and `index.html` so it can be run locally.

## Run it

Install Node.js (LTS), open a terminal in this folder, and run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To verify a production bundle:

```bash
npm run build
```

## Current gameplay

1. **Mine phase (23 seconds):** click blocks on the left half to give resources to P1 and on the right half for P2. Blocks have Minecraft-like pixel textures; iron ore adds iron to the player's counter.
2. **Build phase (15 seconds):** select dirt, stone, or obsidian using the buttons or keys `1`, `2`, and `3`, then click squares in the corresponding player's grid. `Z` undoes the most recent placement. The tank opening is kept clear.
3. **Battle phase:** players take turns. Aim with the mouse and click or press `Space` to fire. `Up`/`Down` changes shot power; keys `1`, `2`, and `3` select tank shot, missile, or boomerang. Missile and boomerang charge by damaging or breaking enemy blocks. Explosions damage nearby blocks and deform the ground into craters.

## Prototype rules

- Dirt: 2 HP; stone: 4 HP; obsidian: 10 HP.
- Tank shot: 1 damage; missile: 10 damage; boomerang: 2 damage.
- Missile radius is larger than the standard shell radius and creates a deeper crater.
- The boomerang loops past the enemy and returns toward the rear of the tank if it does not hit a wall first.
- Starter blocks are supplied so players can still build if they do not mine much.

## Notes

This is a playable first-pass prototype, not a final polished release. Timings, terrain, damage tuning, and controls are intentionally kept in a few constants near the tops of the scene files so they can be adjusted easily. Multiplayer is local/shared-screen; online networking and audio are not included.
