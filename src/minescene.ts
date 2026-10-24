import Phaser from 'phaser';
import { TILE_SIZE } from './config';
import { game } from './state';
import { setupMatch, drawGrid, surface } from './Grid';

export class MineScene extends Phaser.Scene {
  constructor() { super('Mine'); }

  create() {
    // temporary colored squares until C's Preload scene exists
    const colors: Record<string, number> = {
      dirt: 0x8b5a2b, stone: 0x888888, obsidian: 0x3b1f5c, tank: 0x44aa44,
    };
    for (const key in colors) {
      if (this.textures.exists(key)) continue;
      const g = this.add.graphics();
      g.fillStyle(colors[key]).fillRect(0, 0, 64, 64)
       .lineStyle(2, 0x000000).strokeRect(0, 0, 64, 64);
      g.generateTexture(key, 64, 64);
      g.destroy();
    }

    setupMatch();
    drawGrid(this);
    for (const p of game.players) {
      this.add.image(p.x * TILE_SIZE, (surface[p.x] - 1) * TILE_SIZE, 'tank').setOrigin(0);
    }
  }
}