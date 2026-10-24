import Phaser from 'phaser';
import { resetGameState, setupMockBattleFortresses } from '../state';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x1a2639).setOrigin(0);

    this.add.text(width / 2, height * 0.3, 'MINECRAFT x TANK STARS', {
      fontSize: '48px', fontStyle: 'bold', color: '#ffca28', stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5);

    // Main Start Button
    const startBtn = this.add.rectangle(width / 2, height * 0.55, 320, 64, 0x22c55e)
      .setStrokeStyle(4, 0xffffff).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.55, 'START FULL MATCH', { fontSize: '24px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);

    startBtn.on('pointerdown', () => {
      resetGameState();
      this.scene.start('MineScene');
    });

    // Developer Test Button (Jumps straight to your Battle Scene)
    const testBtn = this.add.rectangle(width / 2, height * 0.7, 360, 52, 0x3b82f6)
      .setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.7, '⚡ TEST BATTLE SCENE', { fontSize: '18px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);

    testBtn.on('pointerdown', () => {
      setupMockBattleFortresses();
      this.scene.start('BattleScene');
    });
  }
}