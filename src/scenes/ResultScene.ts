import Phaser from "phaser";
import { GAME_WIDTH, drawSky } from "../grid";
import { gameState, MAX_HP, playerById, resetGameState } from "../state";

const DISPLAY_FONT = "Arial Black, Arial, sans-serif";
const BODY_FONT = "Arial, sans-serif";

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

    const titlePanel = this.add.graphics().setDepth(2);
    titlePanel.fillStyle(0x101c2a, 0.96).fillRoundedRect(350, 78, 900, 165, 18);
    titlePanel.lineStyle(6, 0xf8bd4b, 1).strokeRoundedRect(350, 78, 900, 165, 18);
    titlePanel.lineStyle(2, 0x28c5ff, 1).strokeRoundedRect(358, 86, 884, 149, 12);

    const title = this.add.text(GAME_WIDTH / 2, 153, headline, {
      fontFamily: "MinecraftLogo, Arial Black, Arial, sans-serif", fontSize: "66px", color,
      stroke: "#080e16", strokeThickness: 8,
      shadow: { color: "#000000", blur: 7, offsetX: 4, offsetY: 5, fill: true },
    }).setOrigin(0.5).setDepth(3).setAlpha(0).setY(130);
    const subtitle = this.add.text(GAME_WIDTH / 2, 210, "BATTLE COMPLETE", {
      fontFamily: DISPLAY_FONT, fontSize: "18px", color: "#ffbf43", stroke: "#241b13", strokeThickness: 3,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(3).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, y: 153, duration: 480, ease: "Back.Out" });
    this.tweens.add({ targets: title, scaleX: 1.035, scaleY: 1.035, duration: 1050, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: 520 });
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 330, delay: 260, ease: "Sine.Out" });

    const p1 = playerById(1);
    const p2 = playerById(2);
    this.makePlayerCard(470, "P1: Controller", p1.hp, p1.shotsFired, p1.hits, 0x248de2, 0);
    this.makePlayerCard(1130, "P2: Duelist", p2.hp, p2.shotsFired, p2.hits, 0xe34141, 140);

    this.makeButton(GAME_WIDTH / 2 - 190, 744, 330, 74, "REMATCH", () => {
      resetGameState();
      this.scene.start("MineScene");
    }, 0x4d942e);
    this.makeButton(GAME_WIDTH / 2 + 190, 744, 330, 74, "MAIN MENU", () => {
      resetGameState();
      this.scene.start("MenuScene");
    }, 0x3c647e);
  }

  private makePlayerCard(x: number, title: string, hp: number, shots: number, hits: number, color: number, delay: number): void {
    const card = this.add.container(x, 490).setDepth(4).setAlpha(0).setY(535);
    const panel = this.add.graphics();
    panel.fillStyle(0x101c2a, 0.94).fillRoundedRect(-205, -94, 410, 188, 14);
    panel.lineStyle(5, color, 1).strokeRoundedRect(-205, -94, 410, 188, 14);
    panel.lineStyle(2, 0xffffff, 0.3).strokeRoundedRect(-197, -86, 394, 172, 10);
    const heading = this.add.text(0, -57, title, {
      fontFamily: DISPLAY_FONT, fontSize: "27px", color: "#ffffff", stroke: "#111820", strokeThickness: 5,
    }).setOrigin(0.5);
    const health = this.add.text(0, 2, `REMAINING HP: ${hp}`, {
      fontFamily: DISPLAY_FONT, fontSize: "20px", color: "#e9f4ec", stroke: "#111820", strokeThickness: 4,
    }).setOrigin(0.5);
    const stats = this.add.text(0, 42, `SHOTS ${shots}     HITS ${hits}`, {
      fontFamily: BODY_FONT, fontSize: "18px", color: "#d9e2e5", stroke: "#111820", strokeThickness: 3,
    }).setOrigin(0.5);
    const barBack = this.add.graphics().fillStyle(0x101418, 1).fillRoundedRect(-145, 68, 290, 16, 7);
    barBack.lineStyle(2, 0x080b0d, 1).strokeRoundedRect(-145, 68, 290, 16, 7);
    const bar = this.add.graphics().fillStyle(0x51d35d, 1)
      .fillRoundedRect(-141, 72, Math.max(0, 282 * hp / MAX_HP), 8, 4);
    card.add([panel, heading, health, stats, barBack, bar]);
    this.tweens.add({ targets: card, alpha: 1, y: 490, duration: 420, delay: 220 + delay, ease: "Back.Out" });
    this.tweens.add({ targets: card, y: 486, duration: 1250, delay: 720 + delay, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  private drawGround(): void {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x5f7c3b, 1);
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
    const p1 = this.add.image(245, 650, playerById(1).tankTexture).setOrigin(0.5, 1).setScale(1.2).setDepth(2);
    const p2 = this.add.image(1355, 645, playerById(2).tankTexture).setOrigin(0.5, 1).setFlipX(true).setScale(1.2).setDepth(2);
    this.tweens.add({ targets: p1, y: 645, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({ targets: p2, y: 640, duration: 900, delay: 230, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, callback: () => void, color: number): void {
    const button = this.add.container(x, y).setDepth(5).setAlpha(0).setScale(0.9);
    const rect = this.add.rectangle(0, 0, w, h, color, 1).setStrokeStyle(4, 0xe7f0e3, 1).setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, {
      fontFamily: DISPLAY_FONT, fontSize: "25px", color: "#ffffff", stroke: "#14202a", strokeThickness: 6,
    }).setOrigin(0.5);
    button.add([rect, text]);
    this.tweens.add({ targets: button, alpha: 1, scale: 1, duration: 350, delay: 520, ease: "Back.Out" });
    rect.on("pointerover", () => this.tweens.add({ targets: button, scale: 1.04, duration: 120, ease: "Back.Out" }));
    rect.on("pointerout", () => this.tweens.add({ targets: button, scale: 1, duration: 120, ease: "Sine.Out" }));
    rect.on("pointerdown", callback);
  }
}
