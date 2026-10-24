import Phaser from 'phaser';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create() {
    this.add.text(20, 20, 'BATTLE SCENE - press SPACE for Result', {
      fontSize: '28px',
      color: '#000000',
    });

    this.input.keyboard!.once('keydown-SPACE', () => {
      this.scene.start('Result');
    });
  }
}