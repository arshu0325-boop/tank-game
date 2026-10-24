import Phaser from "phaser";
import { gameConfig } from "./config";

// Phaser owns the canvas and switches between the scenes listed in config.ts.
new Phaser.Game(gameConfig);
