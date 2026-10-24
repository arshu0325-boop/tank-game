import { GRID, TILES, TileType } from './config';

export interface GridCell {
  type: TileType;
  hp: number;
  maxHp: number;
  owner: 0 | 1 | 2;
}

export interface PlayerState {
  id: 1 | 2;
  name: string;
  hp: number;
  maxHp: number;
  charge: number;
  x: number;
  y: number;
  color: number;
  inventory: { dirt: number; stone: number; obsidian: number };
}

export const gameState = {
  grid: [] as GridCell[][],
  p1: createDefaultPlayer(1),
  p2: createDefaultPlayer(2),
  winner: 0 as 0 | 1 | 2,
};

function createDefaultPlayer(id: 1 | 2): PlayerState {
  const groundRow = 8;
  const col = id === 1 ? 3 : GRID.cols - 4;
  return {
    id,
    name: id === 1 ? 'Player 1' : 'Player 2',
    hp: 20,
    maxHp: 20,
    charge: 0,
    x: col * GRID.tileSize + GRID.tileSize / 2,
    y: groundRow * GRID.tileSize - 20,
    color: id === 1 ? 0x2979ff : 0xff1744,
    inventory: { dirt: 10, stone: 6, obsidian: 2 },
  };
}

export function resetGameState() {
  gameState.p1 = createDefaultPlayer(1);
  gameState.p2 = createDefaultPlayer(2);
  gameState.winner = 0;
  gameState.grid = [];
  for (let y = 0; y < GRID.rows; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < GRID.cols; x++) {
      row.push(y >= 8 
        ? { type: 'dirt', hp: TILES.dirt.hp, maxHp: TILES.dirt.hp, owner: 0 }
        : { type: 'empty', hp: 0, maxHp: 0, owner: 0 });
    }
    gameState.grid.push(row);
  }
}

// Gives you instant fortresses to test your Battle scene!
export function setupMockBattleFortresses() {
  resetGameState();
  const placeTile = (x: number, y: number, type: Exclude<TileType, 'empty'>, owner: 1 | 2) => {
    if (y >= 0 && y < GRID.rows && x >= 0 && x < GRID.cols) {
      gameState.grid[y][x] = { type, hp: TILES[type].hp, maxHp: TILES[type].hp, owner };
    }
  };
  placeTile(5, 7, 'obsidian', 1); placeTile(5, 6, 'stone', 1); placeTile(4, 5, 'stone', 1); placeTile(3, 5, 'dirt', 1);
  placeTile(14, 7, 'obsidian', 2); placeTile(14, 6, 'stone', 2); placeTile(15, 5, 'stone', 2); placeTile(16, 5, 'dirt', 2);
}