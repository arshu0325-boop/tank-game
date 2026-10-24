 import Phaser from "phaser";
import type { PlayerId, TileType } from "./state";

export const GAME_WIDTH = 1600;
export const BATTLE_WORLD_WIDTH = 2200;
export const GAME_HEIGHT = 900;
export const TILE_SIZE = 40;
export const MINE_COLS = 40;
export const MINE_ROWS = 15;
export const BUILD_COLS = 10;
export const BUILD_ROWS = 6;
export const BUILD_ORIGIN_Y = 350;
export const BUILD_ORIGIN_X: Record<PlayerId, number> = { 1: 80, 2: 1120 };
export const TANK_X: Record<PlayerId, number> = { 1: 280, 2: 1320 };
export const BLOCK_HP: Record<TileType, number> = {
  dirt: 2,
  stone: 4,
  obsidian: 10,
};

export const TILE_TEXTURE: Record<TileType, string> = {
  dirt: "tile-dirt",
  stone: "tile-stone",
  obsidian: "tile-obsidian",
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** Shared pixel-art sky and distant hills. All scenery is drawn in code, so no assets are required. */
export function drawSky(scene: Phaser.Scene, warmer = false, worldWidth = GAME_WIDTH): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(warmer ? 0x6b9fbb : 0x61a9d4, 1);
  g.fillRect(0, 0, worldWidth, GAME_HEIGHT);
  g.fillStyle(0xffffff, 0.94);
  const cloudPattern = [
    [90, 150, 210, 50], [180, 132, 165, 54], [340, 160, 190, 42],
    [720, 130, 190, 42], [820, 155, 240, 56], [1035, 120, 170, 45],
    [1255, 165, 240, 55], [1470, 140, 190, 42],
  ];
  for (let offset = 0; offset < worldWidth; offset += GAME_WIDTH) {
    for (const [baseX, y, w, h] of cloudPattern) {
      const x = baseX + offset;
      if (x - w / 2 > worldWidth) continue;
      g.fillEllipse(x, y, w, h);
      g.fillEllipse(x - w * 0.22, y + 10, w * 0.62, h * 0.7);
      g.fillEllipse(x + w * 0.22, y + 8, w * 0.58, h * 0.75);
    }
  }
  const curvePoints: Phaser.Geom.Point[] = [];
  const segments = [
    [0, 480, 70, 458, 112, 402, 205, 394],
    [205, 394, 300, 382, 354, 451, 478, 438],
    [478, 438, 594, 424, 646, 361, 772, 376],
    [772, 376, 892, 388, 926, 465, 1050, 452],
    [1050, 452, 1164, 440, 1195, 386, 1318, 402],
    [1318, 402, 1438, 418, 1510, 384, 1600, 436],
  ];
  for (let offset = 0; offset < worldWidth; offset += GAME_WIDTH) {
    for (const [baseX0, y0, baseX1, y1, baseX2, y2, baseX3, y3] of segments) {
      const x0 = baseX0 + offset, x1 = baseX1 + offset, x2 = baseX2 + offset, x3 = baseX3 + offset;
      if (x0 > worldWidth) break;
      for (let step = curvePoints.length ? 1 : 0; step <= 16; step++) {
        const t = step / 16;
        const u = 1 - t;
        const x = u ** 3 * x0 + 3 * u ** 2 * t * x1 + 3 * u * t ** 2 * x2 + t ** 3 * x3;
        const y = u ** 3 * y0 + 3 * u ** 2 * t * y1 + 3 * u * t ** 2 * y2 + t ** 3 * y3;
        if (x <= worldWidth) curvePoints.push(new Phaser.Geom.Point(x, y));
      }
    }
  }
  g.fillStyle(0x45835e, 0.58);
  g.fillPoints([...curvePoints, new Phaser.Geom.Point(worldWidth, GAME_HEIGHT), new Phaser.Geom.Point(0, GAME_HEIGHT)], true);
  return g;
}

/** A shallow valley like a tank-duel arena. Positive y points downward. */
export function baseTerrainY(x: number, worldWidth = GAME_WIDTH): number {
  const valley = 118 * Math.exp(-Math.pow((x - worldWidth / 2) / (300 * worldWidth / GAME_WIDTH), 2));
  const rolling = 17 * Math.sin(x / 122) + 9 * Math.sin(x / 39) + 5 * Math.sin(x / 19);
  return clamp(575 + valley + rolling, 535, 725);
}

export function tileKey(type: TileType, isSurface = false, ore?: "iron" | "coal"): string {
  if (ore === "iron") return "ore-iron";
  if (ore === "coal") return "ore-coal";
  if (isSurface && type === "dirt") return "tile-grass";
  return TILE_TEXTURE[type];
}

export function addBlockImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  type: TileType,
  options: { surface?: boolean; ore?: "iron" | "coal"; size?: number; alpha?: number } = {},
): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, tileKey(type, options.surface, options.ore));
  image.setDisplaySize(options.size ?? TILE_SIZE, options.size ?? TILE_SIZE);
  if (options.alpha !== undefined) image.setAlpha(options.alpha);
  return image;
}
