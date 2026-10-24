import Phaser from 'phaser';
import { gameState, resetGameState } from '../state';

export class ResultScene extends Phaser.Scene {
  constructor() { super('ResultScene'); }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x0f172a).setOrigin(0);

    const winnerName = gameState.winner === 1 ? gameState.p1.name : gameState.p2.name;
    const color = gameState.winner === 1 ? '#60a5fa' : '#f87171';

    this.add.text(width / 2, height * 0.4, `🏆 ${winnerName} WINS!`, {
      fontSize: '52px', fontStyle: 'bold', color: color, stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5);

    const rematchBtn = this.add.rectangle(width / 2, height * 0.6, 320, 60, 0x22c55e)
      .setStrokeStyle(4, 0xffffff).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.6, '🔄 REMATCH', { fontSize: '22px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);

    rematchBtn.on('pointerdown', () => {
      resetGameState();
      this.scene.start('MenuScene');
    });
  }
}