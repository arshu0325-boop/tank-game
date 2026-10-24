import Phaser from 'phaser';
import { setupMockBattleFortresses } from '../state';

export class BuildScene extends Phaser.Scene {
  constructor() { super('BuildScene'); }
  create() {
    this.add.text(640, 300, 'BUILD PHASE (Teammate 1 works here)', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
    this.add.text(640, 400, '👉 Click to skip to BattleScene', { fontSize: '24px', backgroundColor: '#16a34a', padding: { x: 16, y: 10 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        setupMockBattleFortresses();
        this.scene.start('BattleScene');
      });
  }
}