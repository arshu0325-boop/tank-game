export type PlayerId = 1 | 2;
export type TileType = "dirt" | "stone" | "obsidian";
export type WeaponType = "shell" | "missile" | "boomerang";

export interface PlacedBlock {
  col: number;
  row: number;
  type: TileType;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  color: number;
  hp: number;
  fuel: number;
  iron: number;
  inventory: Record<TileType, number>;
  charge: { missile: number; boomerang: number };
  structure: PlacedBlock[];
  shotsFired: number;
  hits: number;
}

export interface GameState {
  players: [PlayerState, PlayerState];
  currentPlayer: PlayerId;
  selectedWeapon: WeaponType;
  selectedTile: TileType;
  round: number;
  winner: PlayerId | 0 | null;
}

function createPlayer(id: PlayerId): PlayerState {
  return {
    id,
    name: id === 1 ? "Controller" : "Duelist",
    color: id === 1 ? 0x2496ff : 0xf04444,
    hp: 100,
    fuel: 100,
    iron: 0,
    // Small starter supplies keep the first match playable; mining adds to these.
    inventory: { dirt: 6, stone: 4, obsidian: 2 },
    charge: { missile: 0, boomerang: 0 },
    structure: [],
    shotsFired: 0,
    hits: 0,
  };
}

export const gameState: GameState = {
  players: [createPlayer(1), createPlayer(2)],
  currentPlayer: 1,
  selectedWeapon: "shell",
  selectedTile: "dirt",
  round: 1,
  winner: null,
};

export function playerById(id: PlayerId): PlayerState {
  return gameState.players[id - 1];
}

export function otherPlayerId(id: PlayerId): PlayerId {
  return id === 1 ? 2 : 1;
}

export function resetGameState(): void {
  gameState.players = [createPlayer(1), createPlayer(2)];
  gameState.currentPlayer = 1;
  gameState.selectedWeapon = "shell";
  gameState.selectedTile = "dirt";
  gameState.round = 1;
  gameState.winner = null;
}
