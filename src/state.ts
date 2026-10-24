export type PlayerId = 1 | 2;
export type TileType = "dirt" | "stone" | "obsidian";
export type WeaponType = "shell" | "missile" | "boomerang";
export const MAX_HP = 10;

export const TANK_CATALOG = [
  { texture: "tank-blue", name: "Vanguard", role: "Balanced", color: 0x168ceb },
  { texture: "tank-red", name: "Ripper", role: "Heavy hitter", color: 0xe44343 },
  { texture: "tank-gold", name: "Bulldozer", role: "Armored", color: 0xf2a51f },
  { texture: "tank-cyan", name: "Frostbite", role: "Rapid fire", color: 0x22c6d8 },
  { texture: "tank-lime", name: "Wrecker", role: "Siege tank", color: 0x8fc925 },
  { texture: "tank-violet", name: "Phantom", role: "Scout", color: 0x9c65e8 },
] as const;

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
  ammo: { missile: number; boomerang: number };
  structure: PlacedBlock[];
  shotsFired: number;
  hits: number;
  tankTexture: string;
}

export interface GameState {
  players: [PlayerState, PlayerState];
  currentPlayer: PlayerId;
  selectedWeapon: WeaponType;
  selectedTile: TileType;
  round: number;
  winner: PlayerId | 0 | null;
  nightMode: boolean;
}

function createPlayer(id: PlayerId, tankTexture = id === 1 ? "tank-blue" : "tank-red"): PlayerState {
  return {
    id,
    name: id === 1 ? "Controller" : "Duelist",
    color: id === 1 ? 0x2496ff : 0xf04444,
    hp: MAX_HP,
    fuel: 100,
    iron: 0,
    // Small starter supplies keep the first match playable; mining adds to these.
    inventory: { dirt: 6, stone: 4, obsidian: 2 },
    ammo: { missile: 2, boomerang: 3 },
    structure: [],
    shotsFired: 0,
    hits: 0,
    tankTexture,
  };
}

export const gameState: GameState = {
  players: [createPlayer(1), createPlayer(2)],
  currentPlayer: 1,
  selectedWeapon: "shell",
  selectedTile: "dirt",
  round: 1,
  winner: null,
  nightMode: true,
};

export function playerById(id: PlayerId): PlayerState {
  return gameState.players[id - 1];
}

export function otherPlayerId(id: PlayerId): PlayerId {
  return id === 1 ? 2 : 1;
}

export function resetGameState(): void {
  const [p1Tank, p2Tank] = gameState.players.map((player) => player.tankTexture);
  gameState.players = [createPlayer(1, p1Tank), createPlayer(2, p2Tank)];
  gameState.currentPlayer = 1;
  gameState.selectedWeapon = "shell";
  gameState.selectedTile = "dirt";
  gameState.round = 1;
  gameState.winner = null;
}
