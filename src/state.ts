export type TileType = 'dirt' | 'stone' | 'obsidian';
export interface Tile { type: TileType; hp: number }
export interface Player {
  id: 0 | 1;
  hp: number;
  x: number;               // tank tile column
  inventory: Record<TileType, number>;
  charge: number;          // battle meter
}
export const game = {
  grid: [] as (Tile | null)[][],   // grid[y][x]
  players: [] as Player[],
  turn: 0 as 0 | 1,
};
export function resetGame() { /* A fills in grid, B/C call it on Rematch */ }