import Phaser from 'phaser';
import { GRID_W, GRID_H, TILE_SIZE, TILES } from './config';
import { game, type Tile, type TileType } from './state';

let scene: Phaser.Scene;
const sprites: (Phaser.GameObjects.Image | null)[][] = [];
export const surface: number[] = [];   // top tile row for each column

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const makeTile = (type: TileType): Tile => ({ type, hp: TILES[type].hp });

export function inBounds(x: number, y: number) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}

export function generateTerrain() {
  // surface height per column
  for (let x = 0; x < GRID_W; x++) {
    let h = Math.round(5 + 1.5 * Math.sin(x * 0.5) + rand(-1, 1));
    h = Math.max(3, Math.min(GRID_H - 4, h));
    surface[x] = h;
  }
  // flat spots for the two tanks
  for (const x of [0, 1, 2, GRID_W - 3, GRID_W - 2, GRID_W - 1]) surface[x] = 5;

  const grid: (Tile | null)[][] = [];
  for (let y = 0; y < GRID_H; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_W; x++) {
      if (y < surface[x]) { grid[y][x] = null; continue; }
      let type: TileType = y - surface[x] < 2 ? 'dirt' : 'stone';
      if (y >= GRID_H - 2) type = 'obsidian';
      else if (type === 'stone' && Math.random() < 0.05) type = 'obsidian';
      grid[y][x] = makeTile(type);
    }
  }
  game.grid = grid;
}

export function drawGrid(s: Phaser.Scene) {
  scene = s;
  for (let y = 0; y < GRID_H; y++) {
    sprites[y] = [];
    for (let x = 0; x < GRID_W; x++) {
      const t = game.grid[y][x];
      sprites[y][x] = t
        ? scene.add.image(x * TILE_SIZE, y * TILE_SIZE, t.type).setOrigin(0)
        : null;
    }
  }
}

export function getTile(x: number, y: number): Tile | null {
  return inBounds(x, y) ? game.grid[y][x] : null;
}

export function setTile(x: number, y: number, type: TileType | null) {
  if (!inBounds(x, y)) return;
  sprites[y][x]?.destroy();
  sprites[y][x] = null;
  if (type === null) { game.grid[y][x] = null; return; }
  game.grid[y][x] = makeTile(type);
  sprites[y][x] = scene.add.image(x * TILE_SIZE, y * TILE_SIZE, type).setOrigin(0);
}

// returns true if the tile broke
export function damageTile(x: number, y: number, dmg: number): boolean {
  const t = getTile(x, y);
  if (!t) return false;
  t.hp -= dmg;
  if (t.hp <= 0) { setTile(x, y, null); return true; }
  return false;
}

// both tanks start on the flat spots at the far left and right
export function setupMatch() {
  generateTerrain();
  const blank = () => ({ dirt: 0, stone: 0, obsidian: 0 });
  game.players = [
    { id: 0, hp: 10, x: 1,          inventory: blank(), charge: 0 },
    { id: 1, hp: 10, x: GRID_W - 2, inventory: blank(), charge: 0 },
  ];
  game.turn = 0;
}