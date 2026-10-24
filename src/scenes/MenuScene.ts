import Phaser from 'phaser';
import { resetGame } from '../state';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.add.text(20, 20, 'TANK GAME - press SPACE to start', {
      fontSize: '28px',
      color: '#000000',
    });

    // Temporary test: shows each texture so we know they loaded.
    // Delete these 5 lines later.
    this.add.image(100, 150, 'dirt');
    this.add.image(180, 150, 'stone');
    this.add.image(260, 150, 'obsidian');
    this.add.image(360, 150, 'tank0');
    this.add.image(440, 150, 'tank1');

    this.input.keyboard!.once('keydown-SPACE', () => {
      resetGame();            // start a fresh match
      this.scene.start('Mine');
    });
  }
}