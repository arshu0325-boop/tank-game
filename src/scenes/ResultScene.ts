import Phaser from "phaser";
import { GAME_WIDTH, drawSky } from "../grid";
import { gameState, MAX_HP, playerById, resetGameState } from "../state";

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("ResultScene");
  }

  create(): void {
    drawSky(this, true);
    this.drawGround();
    const winner = gameState.winner;
    const headline = winner === 0 ? "DRAW!" : winner === 1 ? "P1 WINS!" : "P2 WINS!";
    const color = winner === 1 ? "#75d5ff" : winner === 2 ? "#ff8881" : "#ffe37d";

    this.add.rectangle(GAME_WIDTH / 2, 240, 800, 150, 0x101922, 0.86).setStrokeStyle(4, 0xffbd43, 1);
    this.add.text(GAME_WIDTH / 2, 215, headline, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "76px", color,
      stroke: "#121a20", strokeThickness: 10, shadow: { color: "#000000", blur: 10, fill: true },
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 290, "BATTLE COMPLETE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "26px", color: "#f6eede",
      stroke: "#121a20", strokeThickness: 5,
    }).setOrigin(0.5);

    const p1 = playerById(1);
    const p2 = playerById(2);
    this.makePlayerCard(470, "P1: Controller", p1.hp, p1.shotsFired, p1.hits, 0x248de2);
    this.makePlayerCard(1130, "P2: Duelist", p2.hp, p2.shotsFired, p2.hits, 0xe34141);

    this.makeButton(GAME_WIDTH / 2 - 190, 665, 330, 74, "REMATCH", () => {
      resetGameState();
      this.scene.start("MineScene");
    }, 0x4d942e);
    this.makeButton(GAME_WIDTH / 2 + 190, 665, 330, 74, "MAIN MENU", () => {
      resetGameState();
      this.scene.start("MenuScene");
    }, 0x3c647e);
  }

  private makePlayerCard(x: number, title: string, hp: number, shots: number, hits: number, color: number): void {
    this.add.rectangle(x, 485, 390, 175, 0x17222a, 0.9).setStrokeStyle(4, color, 1);
    this.add.text(x, 430, title, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "28px", color: "#ffffff",
      stroke: "#111820", strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(x, 495, `Remaining HP: ${hp}`, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "23px", color: "#e9f4ec", stroke: "#111820", strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(x, 545, `Shots fired: ${shots}     Hits: ${hits}`, {
      fontFamily: "Arial", fontSize: "19px", color: "#d9e2e5", stroke: "#111820", strokeThickness: 3,
    }).setOrigin(0.5);
    this.add.rectangle(x, 590, 280, 14, 0x101418, 1).setStrokeStyle(2, 0x080b0d, 1);
    this.add.rectangle(x - 140 + 1 + Math.max(0, 278 * hp / MAX_HP) / 2, 590, Math.max(0, 278 * hp / MAX_HP), 10, 0x51d35d, 1);
  }

  private drawGround(): void {
    const g = this.add.graphics();
    g.fillStyle(0x6a482f, 1);
    g.fillPoints([
      new Phaser.Geom.Point(0, 650), new Phaser.Geom.Point(170, 625), new Phaser.Geom.Point(350, 662),
      new Phaser.Geom.Point(550, 625), new Phaser.Geom.Point(780, 685), new Phaser.Geom.Point(1000, 640),
      new Phaser.Geom.Point(1210, 665), new Phaser.Geom.Point(1410, 620), new Phaser.Geom.Point(1600, 653),
      new Phaser.Geom.Point(1600, 900), new Phaser.Geom.Point(0, 900),
    ], true);
    g.lineStyle(8, 0x79a844, 1);
    g.beginPath();
    g.moveTo(0, 650); g.lineTo(170, 625); g.lineTo(350, 662); g.lineTo(550, 625);
    g.lineTo(780, 685); g.lineTo(1000, 640); g.lineTo(1210, 665); g.lineTo(1410, 620); g.lineTo(1600, 653);
    g.strokePath();
    this.add.image(245, 650, playerById(1).tankTexture).setOrigin(0.5, 1).setScale(1.2);
    this.add.image(1355, 645, playerById(2).tankTexture).setOrigin(0.5, 1).setFlipX(true).setScale(1.2);
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, callback: () => void, color: number): void {
    const rect = this.add.rectangle(x, y, w, h, color, 1).setStrokeStyle(4, 0xe7f0e3, 1).setInteractive({ useHandCursor: true });
    rect.on("pointerover", () => rect.setAlpha(0.82));
    rect.on("pointerout", () => rect.setAlpha(1));
    rect.on("pointerdown", callback);
    this.add.text(x, y, label, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "27px", color: "#ffffff", stroke: "#14202a", strokeThickness: 6,
    }).setOrigin(0.5);
  }
}
