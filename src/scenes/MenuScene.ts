import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, drawSky } from "../grid";
import { resetGameState } from "../state";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create(): void {
    drawSky(this, true);
    this.drawMenuGround();

    const glow = this.add.rectangle(GAME_WIDTH / 2, 245, 850, 190, 0x101923, 0.65)
      .setStrokeStyle(3, 0xf6a934, 0.95);
    glow.setDepth(2);
    this.add.text(GAME_WIDTH / 2, 205, "TANKCRAFT", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "82px", color: "#fff4de",
      stroke: "#17202a", strokeThickness: 10, shadow: { color: "#000000", blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(3);
    this.add.text(GAME_WIDTH / 2, 282, "MINE  •  BUILD  •  DUEL", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "27px", color: "#ffcc4b",
      stroke: "#352215", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(3);

    this.makeButton(GAME_WIDTH / 2, 465, 360, 78, "START LOCAL DUEL", () => {
      resetGameState();
      this.scene.start("MineScene");
    }, 0x4d942e);

    this.add.text(GAME_WIDTH / 2, 555,
      "Drive and drill for resources, drag to build a defense, then duel from your tank.", {
        fontFamily: "Arial", fontSize: "22px", color: "#f5f3e9", align: "center",
        stroke: "#24313b", strokeThickness: 4, wordWrap: { width: 900 },
      }).setOrigin(0.5);

    const controls = [
      "MINE: P1 drive A / D and hold F • P2 drive ← / → and hold Enter",
      "BUILD: select a tile (1 / 2 / 3), then drag across your grid",
      "BATTLE: aim with the mouse, click to fire, ↑ / ↓ changes power",
      "WEAPONS: 1 Shell  •  2 Missile  •  3 Boomerang",
    ];
    controls.forEach((line, i) => {
      this.add.text(GAME_WIDTH / 2, 630 + i * 34, line, {
        fontFamily: "Arial", fontSize: "18px", color: "#e2edf2", align: "center",
        stroke: "#18232d", strokeThickness: 3,
      }).setOrigin(0.5);
    });

    this.add.text(GAME_WIDTH / 2, 825, "Two players • One screen • Destructible terrain", {
      fontFamily: "Arial", fontSize: "17px", color: "#c4d2d7",
    }).setOrigin(0.5);
  }

  private drawMenuGround(): void {
    const g = this.add.graphics();
    g.fillStyle(0x5f7c3b, 1);
    g.fillPoints([
      new Phaser.Geom.Point(0, 660), new Phaser.Geom.Point(180, 625),
      new Phaser.Geom.Point(360, 650), new Phaser.Geom.Point(540, 600),
      new Phaser.Geom.Point(760, 665), new Phaser.Geom.Point(980, 635),
      new Phaser.Geom.Point(1180, 660), new Phaser.Geom.Point(1390, 610),
      new Phaser.Geom.Point(1600, 650), new Phaser.Geom.Point(1600, 900),
      new Phaser.Geom.Point(0, 900),
    ], true);
    g.fillStyle(0x67442e, 1);
    g.fillRect(0, 685, GAME_WIDTH, GAME_HEIGHT - 685);
    g.lineStyle(9, 0x82b94c, 1);
    g.beginPath();
    g.moveTo(0, 660); g.lineTo(180, 625); g.lineTo(360, 650); g.lineTo(540, 600);
    g.lineTo(760, 665); g.lineTo(980, 635); g.lineTo(1180, 660); g.lineTo(1390, 610); g.lineTo(1600, 650);
    g.strokePath();
    this.add.image(260, 654, "tank-blue").setOrigin(0.5, 1).setScale(1.3);
    this.add.image(1340, 645, "tank-red").setOrigin(0.5, 1).setScale(1.3);
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, callback: () => void, color: number): void {
    const bg = this.add.rectangle(x, y, w, h, color, 1).setStrokeStyle(5, 0xf7f0d8, 1).setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => bg.setFillStyle(0x6cb644));
    bg.on("pointerout", () => bg.setFillStyle(color));
    bg.on("pointerdown", callback);
    this.add.text(x, y, label, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "28px", color: "#ffffff",
      stroke: "#14200f", strokeThickness: 6,
    }).setOrigin(0.5);
  }
}
