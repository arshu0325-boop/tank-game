// All the game's numbers live here, so we can tune them in one place.

export const TILE_SIZE = 64; // each block is 64 x 64 pixels
export const GRID_W = 20;    // the world is 20 blocks wide
export const GRID_H = 11;    // and 11 blocks tall

// How tough each block type is
export const TILES = {
  dirt:     { hp: 2,  mineTime: 0.3 },   // hp = hit points (health)
  stone:    { hp: 4,  mineTime: 0.7 },   // mineTime = seconds to dig
  obsidian: { hp: 10, mineTime: 1.5 },
};

// How strong each weapon is
export const WEAPONS = {
  shot:      { dmg: 1,  chargeCost: 0 },
  boomerang: { dmg: 2,  chargeCost: 5 },
  missile:   { dmg: 10, chargeCost: 10 },
};

export const PHASE_TIME = { mine: 40, build: 30, battle: 25 }; // seconds per phase
export const TANK_HP = 10;
export const GRAVITY = 600; // how fast shots fall