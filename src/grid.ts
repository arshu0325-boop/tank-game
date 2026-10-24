 import Phaser from "phaser";
import type { PlayerId, TileType } from "./state";

export const GAME_WIDTH = 1600;
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
export function drawSky(scene: Phaser.Scene, warmer = false): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(warmer ? 0x7f9bab : 0x7193a6, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  g.fillStyle(0xb6cbd1, 0.52);
  const clouds = [
    [90, 150, 210, 50], [180, 132, 165, 54], [340, 160, 190, 42],
    [720, 130, 190, 42], [820, 155, 240, 56], [1035, 120, 170, 45],
    [1255, 165, 240, 55], [1470, 140, 190, 42],
  ];
  for (const [x, y, w, h] of clouds) {
    g.fillEllipse(x, y, w, h);
    g.fillEllipse(x - w * 0.22, y + 10, w * 0.62, h * 0.7);
    g.fillEllipse(x + w * 0.22, y + 8, w * 0.58, h * 0.75);
  }
  g.fillStyle(0x587d75, 0.52);
  g.fillPoints([
    new Phaser.Geom.Point(0, 460), new Phaser.Geom.Point(135, 390),
    new Phaser.Geom.Point(260, 438), new Phaser.Geom.Point(420, 365),
    new Phaser.Geom.Point(600, 440), new Phaser.Geom.Point(780, 388),
    new Phaser.Geom.Point(960, 452), new Phaser.Geom.Point(1120, 390),
    new Phaser.Geom.Point(1320, 425), new Phaser.Geom.Point(1500, 368),
    new Phaser.Geom.Point(1600, 420), new Phaser.Geom.Point(1600, 900),
    new Phaser.Geom.Point(0, 900),
  ], true);
  return g;
}

/** A shallow valley like a tank-duel arena. Positive y points downward. */
export function baseTerrainY(x: number): number {
  const valley = 118 * Math.exp(-Math.pow((x - GAME_WIDTH / 2) / 300, 2));
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
