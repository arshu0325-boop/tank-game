import Phaser from 'phaser';

export class MineScene extends Phaser.Scene {
  constructor() { super('MineScene'); }
  create() {
    this.add.text(640, 300, 'MINE PHASE (Teammate 1 works here)', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
    this.add.text(640, 400, '👉 Click to skip to BuildScene', { fontSize: '24px', backgroundColor: '#2563eb', padding: { x: 16, y: 10 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('BuildScene'));
  }
}