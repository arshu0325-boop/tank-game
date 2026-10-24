import Phaser from 'phaser';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create() {
    this.add.text(20, 20, 'RESULT SCENE - press SPACE for Menu', {
      fontSize: '28px',
      color: '#000000',
    });

    this.input.keyboard!.once('keydown-SPACE', () => {
      this.scene.start('Menu');
    });
  }
}