 import Phaser from 'phaser';
import { GRID_W, GRID_H, TILE_SIZE, TILES } from './config';
import { game, type Tile, type TileType } from './state';

// Layout: smooth hills in the middle, a flat pad under each tank, and a small
// block zone (the part you can drill) right under each pad.
export const PAD_ROW = 6;                          // first block row of the ground
export const TANK_ROW = PAD_ROW - 1;               // row the tanks stand on
export const ZONE_W = 5;
export const ZONE_H = GRID_H - PAD_ROW;
export const ZONE_X = [1, GRID_W - 1 - ZONE_W];    // first column of each zone
export const TANK_COL = ZONE_X.map(x => x + Math.floor(ZONE_W / 2));

const PAD_Y = PAD_ROW * TILE_SIZE;
const HILL_L = 6 * TILE_SIZE;
const HILL_R = (GRID_W - 6) * TILE_SIZE;
let hillAmp = 90;
let hillWob = 30;

let scene: Phaser.Scene;
const sprites: (Phaser.GameObjects.Image | null)[][] = [];
export const tanks: Phaser.GameObjects.Image[] = [];

const makeTile = (type: TileType): Tile => ({ type, hp: TILES[type].hp });

export function inBounds(x: number, y: number) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}

// height of the smooth ground at a pixel x (use this for shell collisions)
export function groundHeight(px: number): number {
  if (px <= HILL_L || px >= HILL_R) return PAD_Y;
  const t = (px - HILL_L) / (HILL_R - HILL_L);
  return PAD_Y + hillAmp * Math.sin(Math.PI * t) + hillWob * Math.sin(3 * Math.PI * t);
}

function generateTerrain() {
  const grid: (Tile | null)[][] = [];
  for (let y = 0; y < GRID_H; y++) grid[y] = new Array(GRID_W).fill(null);

  for (const zx of ZONE_X) {
    for (let r = 0; r < ZONE_H; r++) {
      const d = r / (ZONE_H - 1);                    // 0 at the top, 1 at the bottom
      const pObs = d * 0.5;
      const pStone = 0.25 + d * 0.4;
      for (let c = 0; c < ZONE_W; c++) {
        const roll = Math.random();
        const type: TileType =
          roll < pObs ? 'obsidian' : roll < pObs + pStone ? 'stone' : 'dirt';
        grid[PAD_ROW + r][zx + c] = makeTile(type);
      }
    }
  }
  game.grid = grid;
}

export function setupMatch() {
  hillAmp = 70 + Math.random() * 50;
  hillWob = 15 + Math.random() * 25;
  generateTerrain();
  const blank = () => ({ dirt: 0, stone: 0, obsidian: 0 });
  game.players = [
    { id: 0, hp: 10, x: TANK_COL[0], inventory: blank(), charge: 0 },
    { id: 1, hp: 10, x: TANK_COL[1], inventory: blank(), charge: 0 },
  ];
  game.turn = 0;
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

// ---------- drawing (temporary art until C's assets arrive) ----------

function tileTexture(s: Phaser.Scene, key: string, base: number, speck: number) {
  if (s.textures.exists(key)) return;
  const g = s.add.graphics();
  g.fillStyle(base).fillRect(0, 0, 64, 64);
  g.fillStyle(speck, 0.5);
  for (let i = 0; i < 9; i++) {
    g.fillRect(Math.random() * 56, Math.random() * 56, 4 + Math.random() * 6, 4 + Math.random() * 6);
  }
  g.lineStyle(2, 0x000000, 0.6).strokeRect(1, 1, 62, 62);
  g.generateTexture(key, 64, 64);
  g.destroy();
}

function tankTexture(s: Phaser.Scene, key: string, body: number) {
  if (s.textures.exists(key)) return;
  const g = s.add.graphics();
  g.fillStyle(0x222222).fillRoundedRect(0, 26, 64, 14, 6);    // tracks
  g.fillStyle(0x666666);
  for (const wx of [10, 24, 40, 54]) g.fillCircle(wx, 33, 4); // wheels
  g.fillStyle(body).fillRoundedRect(8, 14, 48, 16, 4);        // hull
  g.fillCircle(28, 14, 11);                                    // turret
  g.fillStyle(0x333333).fillRect(30, 10, 32, 6);              // barrel
  g.generateTexture(key, 64, 40);
  g.destroy();
}

 export function drawWorld(s: Phaser.Scene) {
  scene = s;
  tileTexture(s, 'dirt', 0x8b5a2b, 0x5e3a18);
  tileTexture(s, 'stone', 0x888888, 0x5c5c5c);
  tileTexture(s, 'obsidian', 0x3b1f5c, 0x6a3fa0);
  tankTexture(s, 'tank0', 0x3b82f6);
  tankTexture(s, 'tank1', 0xdc2626);

  const W = GRID_W * TILE_SIZE;
  const H = GRID_H * TILE_SIZE;

  // sky, mountains, clouds
  const sky = s.add.graphics().setDepth(-30);
  sky.fillGradientStyle(0x5aa9e6, 0x5aa9e6, 0xd6efff, 0xd6efff, 1);
  sky.fillRect(0, 0, W, H);

  const mtn = s.add.graphics().setDepth(-25);
  mtn.fillStyle(0x7d9fb5, 0.8);
  const m: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: H }];
  for (let x = 0; x <= W; x += 16) {
    m.push({ x, y: 300 + 50 * Math.sin(x * 0.006) + 30 * Math.sin(x * 0.017 + 1) });
  }
  m.push({ x: W, y: H });
  mtn.fillPoints(m, true);

  const clouds = s.add.graphics().setDepth(-28);
  clouds.fillStyle(0xffffff, 0.8);
  for (const [cx, cy] of [[200, 90], [620, 60], [1000, 120]]) {
    clouds.fillEllipse(cx, cy, 130, 36);
    clouds.fillEllipse(cx + 40, cy - 14, 90, 36);
  }

  // smooth ground
  const top: Phaser.Types.Math.Vector2Like[] = [];
  for (let x = 0; x <= W; x += 8) top.push({ x, y: groundHeight(x) });

  const ground = s.add.graphics().setDepth(-10);
  ground.fillStyle(0x8b5a2b).fillPoints([...top, { x: W, y: H }, { x: 0, y: H }], true);
  const deep = top.map(p => ({ x: p.x, y: (p.y as number) + 70 }));
  ground.fillStyle(0x6b4220).fillPoints([...deep, { x: W, y: H }, { x: 0, y: H }], true);

  // dark "cave" behind each block zone, so mined blocks leave a visible hole
  for (const zx of ZONE_X) {
    s.add.rectangle(zx * TILE_SIZE, PAD_ROW * TILE_SIZE, ZONE_W * TILE_SIZE, ZONE_H * TILE_SIZE, 0x2a1a10)
      .setOrigin(0).setDepth(-6);
  }

  const grass = s.add.graphics().setDepth(-4);
  grass.lineStyle(12, 0x4fae45).strokePoints(top, false);

  // block tiles
  for (let y = 0; y < GRID_H; y++) {
    sprites[y] = [];
    for (let x = 0; x < GRID_W; x++) {
      const t = game.grid[y][x];
      sprites[y][x] = t ? s.add.image(x * TILE_SIZE, y * TILE_SIZE, t.type).setOrigin(0) : null;
    }
  }

  // tanks sit on the flat pads
  tanks.length = 0;
  for (const i of [0, 1]) {
    tanks[i] = s.add.image(TANK_COL[i] * TILE_SIZE + TILE_SIZE / 2, PAD_Y, `tank${i}`)
      .setOrigin(0.5, 1).setDepth(1).setFlipX(i === 1);
  }
}