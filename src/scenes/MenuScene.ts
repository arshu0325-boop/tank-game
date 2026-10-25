import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../grid";
import { gameState } from "../state";
import { startMenuMusic } from "../menuMusic";

export class MenuScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private modeIcon!: Phaser.GameObjects.Graphics;
  private modeLabel!: Phaser.GameObjects.Text;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    startMenuMusic(this);

    this.background = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.backgroundKey())
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-10);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x07142b, 0.08)
      .setDepth(1);
    this.nightOverlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x08184f, 0.25,
    ).setDepth(2);

    // Larger logo, centered vertically in the open sky area.
    const title = this.add.image(GAME_WIDTH / 2, 300, "tankcraft-logo")
      .setDisplaySize(1040, 347)
      .setDepth(3);
    this.tweens.add({
      targets: title, scaleX: title.scaleX * 1.035, scaleY: title.scaleY * 1.035,
      duration: 1450, yoyo: true, repeat: -1, ease: "Sine.InOut",
    });

    this.makePlayButton(GAME_WIDTH / 2, 700);
    this.makeSideButton(78, 610, "?", "GUIDE", () => {
      this.scene.start("InstructionsScene");
    });
    this.makeSideButton(78, 755, "", gameState.nightMode ? "NIGHT" : "DAY", () => {
      gameState.nightMode = !gameState.nightMode;
      this.refreshBackground();
    }, true);
    this.refreshBackground();
  }

  private backgroundKey(): string {
    return gameState.nightMode ? "opening-night" : "opening-day";
  }

  private refreshBackground(): void {
    this.background.setTexture(this.backgroundKey());
    this.nightOverlay.setAlpha(gameState.nightMode ? 0.1 : 0);
    this.modeLabel?.setText(gameState.nightMode ? "NIGHT" : "DAY");
    this.modeIcon?.clear();
    if (this.modeIcon) this.drawModeIcon(this.modeIcon, gameState.nightMode);
  }

  private makePlayButton(x: number, y: number): void {
    const button = this.add.container(x, y).setDepth(5);
    const art = this.add.graphics();
    // Rounded green arcade button inspired by the supplied PLAY button artwork.
    art.fillStyle(0x352018, 1).fillRoundedRect(-146, -69, 292, 142, 36);
    art.fillStyle(0xe58b25, 1).fillRoundedRect(-139, -76, 278, 133, 34);
    art.fillStyle(0x542b18, 1).fillRoundedRect(-130, -82, 260, 126, 31);
    art.fillStyle(0x67b914, 1).fillRoundedRect(-125, -88, 250, 122, 30);
    art.lineStyle(5, 0x32190f, 1).strokeRoundedRect(-125, -88, 250, 122, 30);
    art.lineStyle(4, 0xf5b643, 1).strokeRoundedRect(-117, -80, 234, 106, 24);
    art.fillStyle(0x91db2d, 1).fillRoundedRect(-108, -70, 216, 80, 22);
    art.fillStyle(0xb5ed58, 0.65).fillRoundedRect(-81, -61, 42, 9, 5);
    const label = this.add.text(0, -37, "PLAY", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "66px",
      color: "#ffffff", stroke: "#49291b", strokeThickness: 9,
      shadow: { color: "#31190f", blur: 0, offsetX: 3, offsetY: 5, fill: true },
    }).setOrigin(0.5).setY(-27);
    const hitArea = this.add.zone(0, -15, 292, 142)
      .setInteractive({ useHandCursor: true });
    button.add([art, label, hitArea]);
    hitArea.on("pointerover", () => button.setScale(1.06));
    hitArea.on("pointerout", () => button.setScale(1));
    hitArea.on("pointerdown", () => this.scene.start("TankHangarScene"));
  }

  private makeSideButton(
    x: number, y: number, symbol: string, caption: string,
    action: () => void, isMode = false,
  ): void {
    const button = this.add.container(x, y).setDepth(5);
    const circle = this.add.graphics();
    circle.fillStyle(0x102235, 0.92).fillCircle(0, 0, 47);
    circle.lineStyle(5, isMode ? 0xffd76a : 0x82e9ff, 1).strokeCircle(0, 0, 47);
    circle.fillStyle(isMode ? 0x34415c : 0x70c2ae, 1).fillCircle(0, 0, 39);
    button.add(circle);
    if (isMode) {
      this.modeIcon = this.add.graphics();
      button.add(this.modeIcon);
      this.drawModeIcon(this.modeIcon, gameState.nightMode);
    } else {
      this.drawControllerIcon(button);
    }
    const hitArea = this.add.zone(0, 0, 96, 96).setInteractive({ useHandCursor: true });
    button.add(hitArea);
    hitArea.on("pointerover", () => button.setScale(1.08));
    hitArea.on("pointerout", () => button.setScale(1));
    hitArea.on("pointerdown", action);
    const label = this.add.text(140, y, isMode ? (gameState.nightMode ? "NIGHT" : "DAY") : caption, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "15px",
      color: "#ffffff", stroke: "#102030", strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(5);
    if (isMode) this.modeLabel = label;
  }

  private drawControllerIcon(button: Phaser.GameObjects.Container): void {
    const controller = this.add.graphics();
    controller.fillStyle(0xf5f2df, 1).fillRoundedRect(-31, -13, 62, 30, 13);
    controller.lineStyle(2, 0x32353a, 1).strokeRoundedRect(-31, -13, 62, 30, 13);
    controller.fillStyle(0x292c30, 1);
    controller.fillRoundedRect(-23, -5, 24, 8, 3);
    controller.fillRoundedRect(-15, -13, 8, 24, 3);
    controller.fillCircle(14, -5, 4);
    controller.fillCircle(23, 3, 4);
    controller.fillCircle(14, 11, 4);
    button.add(controller);
  }

  private drawModeIcon(graphics: Phaser.GameObjects.Graphics, night: boolean): void {
    graphics.clear();
    if (night) {
      graphics.fillStyle(0xffefaa, 1).fillCircle(0, 0, 20);
      graphics.fillStyle(0x34415c, 1).fillCircle(9, -9, 19);
    } else {
      graphics.fillStyle(0xffe26b, 1).fillCircle(0, 0, 16);
      graphics.lineStyle(4, 0xffe26b, 1);
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * i) / 4;
        graphics.lineBetween(Math.cos(angle) * 24, Math.sin(angle) * 24,
          Math.cos(angle) * 31, Math.sin(angle) * 31);
      }
    }
  }
}
