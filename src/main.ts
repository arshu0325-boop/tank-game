 import Phaser from 'phaser';
import { MineScene } from './MineScene';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 704,
  parent: 'app',
  scene: [MineScene],
});