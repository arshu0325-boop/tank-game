import Phaser from 'phaser';
import { GRID } from './config';
import { MenuScene } from './scenes/MenuScene';
import { MineScene } from './scenes/MineScene';
import { BuildScene } from './scenes/BuildScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GRID.cols * GRID.tileSize,
  height: GRID.rows * GRID.tileSize,
  backgroundColor: '#0f172a',
  parent: 'app',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MenuScene, MineScene, BuildScene, BattleScene, ResultScene],
};

new Phaser.Game(config);