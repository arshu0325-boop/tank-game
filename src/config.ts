import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./grid";
import { BattleScene } from "./scenes/BattleScene";
import { BuildScene } from "./scenes/BuildScene";
import { MenuScene } from "./scenes/MenuScene";
import { MineScene } from "./scenes/MineScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { ResultScene } from "./scenes/ResultScene";
import { TankHangarScene } from "./scenes/TankHangarScene";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#263b48",
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    activePointers: 2,
    mouse: { preventDefaultWheel: true },
  },
  scene: [PreloadScene, MenuScene, TankHangarScene, MineScene, BuildScene, BattleScene, ResultScene],
};
