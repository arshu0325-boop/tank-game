import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../grid";
import { gameState, playerById, resetGameState } from "../state";

const DISPLAY_FONT = "Trebuchet MS, Arial, sans-serif";
const BODY_FONT = "Trebuchet MS, Arial, sans-serif";

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("ResultScene");
  }

  create(): void {
    const music = this.sound.add("menu-result-bgm", { loop: true, volume: 0.45 });
    music.play();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => music.stop());

    const background = gameState.nightMode ? "result-night-bg" : "result-day-bg";
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, background)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(0);
    const winner = gameState.winner;
    const headline = winner === 0 ? "DRAW!" : winner === 1 ? "P1 WINS!" : "P2 WINS!";
    const color = winner === 1 ? "#75d5ff" : winner === 2 ? "#ff8881" : "#ffe37d";

    for (const x of [352, 1248]) {
      const star = this.add.star(x, 151, 5, 12, 26, 0xffe589).setStrokeStyle(3, 0xffffff, 0.9).setDepth(3);
      this.tweens.add({ targets: star, angle: 18, scale: 1.18, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    const title = this.add.text(GAME_WIDTH / 2, 153, headline, {
      fontFamily: DISPLAY_FONT, fontStyle: "bold", fontSize: winner === 0 ? "86px" : "92px", color,
      stroke: "#080e16", strokeThickness: 12,
      shadow: { color: "#000000", blur: 10, offsetX: 4, offsetY: 6, fill: true },
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(3).setAlpha(0).setY(130);
    const subtitle = this.add.text(GAME_WIDTH / 2, 210, "BATTLE COMPLETE", {
      fontFamily: DISPLAY_FONT, fontStyle: "bold", fontSize: "23px", color: "#fff8dc", stroke: "#241b13", strokeThickness: 5,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(3).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, y: 153, duration: 480, ease: "Back.Out" });
    this.tweens.add({ targets: title, scaleX: 1.035, scaleY: 1.035, duration: 1050, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: 520 });
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 330, delay: 260, ease: "Sine.Out" });

    const p1 = playerById(1);
    const p2 = playerById(2);
    this.makePlayerCard(470, "P1: Controller", p1.shotsFired, 0);
    this.makePlayerCard(1130, "P2: Duelist", p2.shotsFired, 140);

    this.makeButton(GAME_WIDTH / 2 - 190, 744, 330, 74, "REMATCH", () => {
      resetGameState();
      this.scene.start("MineScene");
    }, 0x4d942e);
    this.makeButton(GAME_WIDTH / 2 + 190, 744, 330, 74, "MAIN MENU", () => {
      resetGameState();
      this.scene.start("MenuScene");
    }, 0x3c647e);
  }

  private makePlayerCard(x: number, title: string, shots: number, delay: number): void {
    const card = this.add.container(x, 490).setDepth(4).setAlpha(0).setY(535);
    const heading = this.add.text(0, -57, title, {
      fontFamily: DISPLAY_FONT, fontStyle: "bold", fontSize: "32px", color: "#ffffff", stroke: "#111820", strokeThickness: 7,
      shadow: { color: "#000000", blur: 5, offsetX: 2, offsetY: 3, fill: true },
    }).setOrigin(0.5);
    const stats = this.add.text(0, 18, `SHOTS ${shots}`, {
      fontFamily: BODY_FONT, fontStyle: "bold", fontSize: "21px", color: "#ffffff", stroke: "#111820", strokeThickness: 5,
    }).setOrigin(0.5);
    card.add([heading, stats]);
    this.tweens.add({ targets: card, alpha: 1, y: 490, duration: 420, delay: 220 + delay, ease: "Back.Out" });
    this.tweens.add({ targets: card, y: 486, duration: 1250, delay: 720 + delay, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, callback: () => void, color: number): void {
    const button = this.add.container(x, y).setDepth(5).setAlpha(0).setScale(0.9);
    const rect = this.add.graphics();
    rect.fillStyle(0x09111b, 0.7).fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, 28);
    rect.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
    rect.lineStyle(4, 0xe7f0e3, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
    rect.lineStyle(2, 0xffffff, 0.36).strokeRoundedRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 22);
    const hitArea = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, {
      fontFamily: DISPLAY_FONT, fontStyle: "bold", fontSize: "27px", color: "#ffffff", stroke: "#14202a", strokeThickness: 6,
      letterSpacing: 1,
    }).setOrigin(0.5);
    button.add([rect, text, hitArea]);
    this.tweens.add({ targets: button, alpha: 1, scale: 1, duration: 350, delay: 520, ease: "Back.Out" });
    hitArea.on("pointerover", () => this.tweens.add({ targets: button, scale: 1.04, duration: 120, ease: "Back.Out" }));
    hitArea.on("pointerout", () => this.tweens.add({ targets: button, scale: 1, duration: 120, ease: "Sine.Out" }));
    hitArea.on("pointerdown", callback);
  }
}
