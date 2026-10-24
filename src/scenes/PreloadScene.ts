import Phaser from 'phaser';
import { TILE_SIZE } from '../config';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create() {
    this.makeSquare('dirt', 0x8b5a2b);     // brown
    this.makeSquare('stone', 0x888888);    // gray
    this.makeSquare('obsidian', 0x3b1f5c); // dark purple
    this.makeTank('tank0', 0x44aa44);      // green tank
    this.makeTank('tank1', 0xcc4444);      // red tank

    // Allows opening ?scene=Battle in the address to jump to a scene
    const start = new URLSearchParams(location.search).get('scene') ?? 'Menu';
    this.scene.start(start);
  }

  // Draws a colored square with a dark border and saves it as a texture
  private makeSquare(key: string, color: number) {
    const g = this.add.graphics();
    g.fillStyle(color).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(3, 0x000000, 0.6).strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }

  // Draws a simple tank out of rectangles
  private makeTank(key: string, color: number) {
    const g = this.add.graphics();
    g.fillStyle(color).fillRect(4, 24, 56, 28);     // body
    g.fillStyle(0x222222).fillRect(0, 48, 64, 12);  // tracks
    g.fillStyle(color).fillRect(24, 10, 28, 16);    // turret
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }
}