export const TILE_SIZE = 64;
export const GRID_W = 20;   // 1280px wide
export const GRID_H = 11;   // 704px tall

// PLACEHOLDERS: replace with the numbers from your team's plan
export const TILES = {
  dirt:     { hp: 1, mineTime: 0.5 },
  stone:    { hp: 3, mineTime: 1.5 },
  obsidian: { hp: 10, mineTime: 3 },
};
export const WEAPONS = {
  shot:      { damage: 1,  chargeCost: 0 },
  boomerang: { damage: 5,  chargeCost: 5 },
  missile:   { damage: 10, chargeCost: 10 },
};
export const PHASE_TIME = { mine: 30, build: 30, aim: 25 };