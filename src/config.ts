export type TileType = 'empty' | 'dirt' | 'stone' | 'obsidian';
export type WeaponType = 'shot' | 'boomerang' | 'missile';

export const GRID = {
  cols: 20,      // 20 tiles wide (1280px screen width)
  rows: 11,      // 11 tiles tall (704px screen height)
  tileSize: 64,  // 64x64 pixel blocks
};

export const TILES: Record<Exclude<TileType, 'empty'>, { hp: number; mineTime: number; color: number }> = {
  dirt:     { hp: 2,  mineTime: 0.3, color: 0x8b5a2b },
  stone:    { hp: 4,  mineTime: 0.7, color: 0x808080 },
  obsidian: { hp: 10, mineTime: 1.5, color: 0x3b1e54 },
};

export const WEAPONS: Record<WeaponType, { name: string; dmg: number; chargeCost: number; color: number }> = {
  shot:      { name: 'Tank Shot', dmg: 1,  chargeCost: 0,  color: 0xffdd44 },
  boomerang: { name: 'Boomerang', dmg: 2,  chargeCost: 5,  color: 0x00e5ff },
  missile:   { name: 'Missile',   dmg: 10, chargeCost: 10, color: 0xff3333 },
};

export const PHASE_TIME = { mine: 40, build: 30, battle: 25 };

export const PHYSICS = {
  gravity: 500,
  maxPower: 950,
  maxDragDist: 160,
};