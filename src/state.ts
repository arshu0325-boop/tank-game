import { TANK_HP } from './config';

export type TileType = 'dirt' | 'stone' | 'obsidian';

export interface Tile {
  type: TileType;
  hp: number;
}

export interface Player {
  id: 0 | 1;
  hp: number;
  tileX: number; // which column the tank stands in
  inventory: Record<TileType, number>; // how many of each block collected
  charge: number; // fills up as you hit blocks, unlocks weapons
}

export const game = {
  grid: [] as (Tile | null)[][], // grid[row][column]; null means empty air
  players: [] as Player[],
  turn: 0 as 0 | 1,
  winner: null as 0 | 1 | null,
};

// Sets everything back to the start of a new match
export function resetGame() {
  game.grid = [];
  game.turn = 0;
  game.winner = null;
  game.players = [0, 1].map((id) => ({
    id: id as 0 | 1,
    hp: TANK_HP,
    tileX: id === 0 ? 2 : 17,
    inventory: { dirt: 0, stone: 0, obsidian: 0 },
    charge: 0,
  }));
}