
import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, drawSky } from "../grid";
import { gameState, playerById } from "../state";

export class MenuScene extends Phaser.Scene {
  private startButton?: Phaser.GameObjects.Container;
  private buttonBackground?: Phaser.GameObjects.Graphics;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private nightDecorations!: Phaser.GameObjects.Container;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    drawSky(this, true);
    this.drawMenuGround();
    this.drawPixelDecorations();
    this.createNightLook();
    this.drawTitlePanel();
    this.drawStartButton();
    this.drawDescription();
    this.drawNightModeToggle();
    this.drawPlayerCard({
      x: GAME_WIDTH / 2 - 225,
      y: 515,
      color: 0x28c5ff,
      darkColor: 0x103d59,
      player: "PLAYER 1",
      team: "BLUE TEAM",
      controls: [
        { heading: "⛏ MINE", lines: ["A / D move  •  W climb", "Hold F  Drill for resources"] },
        { heading: "▦ BUILD", lines: ["1 / 2 / 3  Select block", "Drag across your grid to build"] },
        { heading: "⚔ BATTLE", lines: ["Aim with the cursor", "Release to fire  •  ↑ / ↓  Power"] },
        { heading: "◆ WEAPONS", lines: ["1  Shell     2  Missile", "3  Boomerang"] },
      ],
    });

    this.drawPlayerCard({
      x: GAME_WIDTH / 2 + 225,
      y: 515,
      color: 0xff5968,
      darkColor: 0x542532,
      player: "PLAYER 2",
      team: "RED TEAM",
      controls: [
        { heading: "⛏ MINE", lines: ["← / → move  •  ↑ climb", "Hold ENTER  Drill for resources"] },
        { heading: "▦ BUILD", lines: ["7 / 8 / 9  Select block", "Drag across your grid to build"] },
        { heading: "⚔ BATTLE", lines: ["Aim with the cursor", "Release to fire  •  ↑ / ↓  Power"] },
        { heading: "◆ WEAPONS", lines: ["4  Shell     5  Missile", "6  Boomerang"] },
      ],
    });

    this.drawFooter();
  }

  private drawTitlePanel(): void {
    this.add.image(GAME_WIDTH / 2, 125, "tankcraft-logo")
      .setDisplaySize(660, 220)
      .setDepth(4);
  }

  private drawStartButton(): void {
    const x = GAME_WIDTH / 2;
    const y = 265;
    const width = 350;
    const height = 62;

    const button = this.add.container(x, y).setDepth(5);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x101820, 1);
    shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 7, width, height, 13);

    const bg = this.add.graphics();
    const drawBackground = (color: number, outline: number) => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 13);
      bg.lineStyle(4, outline, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 13);

      // Bright highlight across the top.
      bg.fillStyle(0xffffff, 0.18);
      bg.fillRoundedRect(-width / 2 + 10, -height / 2 + 7, width - 20, 8, 4);
    };

    drawBackground(0x219653, 0x8cf56e);

    const label = this.add.text(10, 0, "CHOOSE TANKS", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "21px",
      color: "#ffffff",
      stroke: "#12331f",
      strokeThickness: 4,
    }).setOrigin(0.5);

    const playIcon = this.add.triangle(
      -width / 2 + 35, 0, 0, -9, 0, 9, 14, 0, 0xffffff
    ).setStrokeStyle(2, 0x12331f);

    button.add([shadow, bg, playIcon, label]);
    button.setSize(width, height);

    const hitArea = this.add.zone(0, 0, width, height)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    button.add(hitArea);

    hitArea.on("pointerover", () => {
      drawBackground(0x2fbd65, 0xc0ff88);
      this.tweens.add({
        targets: button,
        scaleX: 1.035,
        scaleY: 1.035,
        duration: 120,
        ease: "Back.Out",
      });
    });

    hitArea.on("pointerout", () => {
      drawBackground(0x219653, 0x8cf56e);
      this.tweens.add({
        targets: button,
        scaleX: 1,
        scaleY: 1,
        duration: 120,
      });
    });

    hitArea.on("pointerdown", () => {
      this.tweens.add({
        targets: button,
        scaleX: 0.96,
        scaleY: 0.96,
        duration: 70,
        yoyo: true,
        onComplete: () => {
          this.scene.start("TankHangarScene");
        },
      });
    });

    this.startButton = button;
    this.buttonBackground = bg;
  }

  private drawNightModeToggle(): void {
    const x = GAME_WIDTH / 2;
    const y = 690;
    const panel = this.add.rectangle(x, y, 250, 48, 0x17244b, 1)
      .setStrokeStyle(3, 0x91a5ff, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(5);
    const label = this.add.text(x, y, "", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "17px",
      color: "#ffffff",
      stroke: "#111a3b",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);

    const refresh = (): void => {
      label.setText(gameState.nightMode ? "☾  NIGHT MODE: ON" : "☀  NIGHT MODE: OFF");
      panel.setFillStyle(gameState.nightMode ? 0x17244b : 0x786944);
      this.nightOverlay.setAlpha(gameState.nightMode ? 0.48 : 0);
      this.nightDecorations.setVisible(gameState.nightMode);
    };
    panel.on("pointerdown", () => {
      gameState.nightMode = !gameState.nightMode;
      refresh();
    });
    refresh();
  }

  private createNightLook(): void {
    // This tint sits above the scenery and tanks but below every menu panel,
    // so toggling night mode changes the actual start-screen scene immediately.
    this.nightOverlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x08184f, 0.48,
    ).setDepth(2.5);
    this.nightDecorations = this.add.container(0, 0).setDepth(2.6);
    this.nightDecorations.add([
      this.add.circle(1392, 127, 53, 0x4e91df, 0.22),
      this.add.circle(1392, 127, 34, 0xf0f4d2, 0.96).setStrokeStyle(2, 0xdbe7ff, 0.9),
      this.add.image(190, 622, "night-halo").setTint(0x28c5ff).setDisplaySize(210, 105).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.1),
      this.add.image(1410, 613, "night-halo").setTint(0xff5968).setDisplaySize(210, 105).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.1),
    ]);
    const stars: Array<[number, number, number]> = [
      [82, 83, 3], [198, 188, 2], [322, 87, 2], [1295, 86, 2],
      [1467, 212, 3], [1518, 319, 2], [1340, 280, 2], [104, 264, 2],
      [263, 319, 2], [1254, 204, 2], [1538, 82, 2], [65, 207, 2],
    ];
    for (const [x, y, size] of stars) {
      this.nightDecorations.add(this.add.rectangle(x, y, size, size, 0xffffff, 0.95));
    }
    this.nightDecorations.setVisible(gameState.nightMode);
  }

  private drawDescription(): void {
    const x = GAME_WIDTH / 2;
    const y = 330;
    const width = 960;
    const height = 48;

    const panel = this.add.graphics().setDepth(3);
    panel.fillStyle(0x112536, 0.96);
    panel.fillRoundedRect(x - width / 2, y - height / 2, width, height, 12);
    panel.lineStyle(2, 0x376783, 1);
    panel.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 12);

    this.add.text(x, y,
      "Mine resources. Build your defenses. Battle across destructible terrain!", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        color: "#f4f8ff",
        align: "center",
        stroke: "#102030",
        strokeThickness: 2,
        wordWrap: { width: width - 30 },
      }
    ).setOrigin(0.5).setDepth(4);
  }

  private drawPlayerCard(options: {
    x: number;
    y: number;
    color: number;
    darkColor: number;
    player: string;
    team: string;
    controls: { heading: string; lines: string[] }[];
  }): void {
    const {
      x, y, color, darkColor, player, team, controls,
    } = options;

    const width = 410;
    const height = 300;
    const left = -width / 2;
    const top = -height / 2;

    const card = this.add.container(x, y).setDepth(4);
    const graphics = this.add.graphics();

    // Shadow and main rounded card.
    graphics.fillStyle(0x050a10, 0.65);
    graphics.fillRoundedRect(left + 5, top + 6, width, height, 15);

    graphics.fillStyle(0x101e2b, 0.98);
    graphics.fillRoundedRect(left, top, width, height, 15);

    graphics.lineStyle(4, color, 1);
    graphics.strokeRoundedRect(left, top, width, height, 15);

    // Colored header.
    graphics.fillStyle(darkColor, 1);
    graphics.fillRoundedRect(left + 5, top + 5, width - 10, 51, 10);
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(left + 8, top + 9, 6, 39, 3);

    // Pixel decorations.
    graphics.fillStyle(color, 0.95);
    graphics.fillRect(left + width - 34, top + 15, 8, 8);
    graphics.fillRect(left + width - 22, top + 27, 8, 8);
    graphics.fillRect(left + width - 34, top + 39, 8, 8);

    card.add(graphics);

    card.add(this.add.text(left + 27, top + 10, player, {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "20px",
      color: "#ffffff",
      stroke: "#101923",
      strokeThickness: 3,
    }));

    card.add(this.add.text(left + 27, top + 33, team, {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "11px",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#101923",
      strokeThickness: 1,
    }));

    // Four evenly spaced instruction sections.
    let currentY = top + 63;

    controls.forEach((section) => {
      card.add(this.add.text(left + 17, currentY, section.heading, {
        fontFamily: "Arial Black, Arial, sans-serif",
        fontSize: "13px",
        color: `#${color.toString(16).padStart(6, "0")}`,
        stroke: "#0a121b",
        strokeThickness: 2,
      }));
      currentY += 17;

      section.lines.forEach((line) => {
        card.add(this.add.text(left + 18, currentY, line, {
          fontFamily: "Arial, sans-serif",
          fontSize: "12px",
          color: "#f2f6fb",
          stroke: "#101923",
          strokeThickness: 1,
          wordWrap: { width: width - 38 },
        }));
        currentY += 16;
      });

      currentY += 3;
    });

    // Friendly hover animation.
    const hitArea = this.add.zone(x, y, width, height)
      .setInteractive({ useHandCursor: true })
      .setDepth(5);

    hitArea.on("pointerover", () => {
      this.tweens.add({
        targets: card,
        y: y - 4,
        duration: 130,
        ease: "Sine.Out",
      });
    });

    hitArea.on("pointerout", () => {
      this.tweens.add({
        targets: card,
        y,
        duration: 130,
        ease: "Sine.Out",
      });
    });
  }

  private drawMenuGround(): void {
    const g = this.add.graphics().setDepth(1);

    g.fillStyle(0x5f7c3b, 1);
    g.fillPoints([
      new Phaser.Geom.Point(0, 660),
      new Phaser.Geom.Point(180, 625),
      new Phaser.Geom.Point(360, 650),
      new Phaser.Geom.Point(540, 600),
      new Phaser.Geom.Point(760, 665),
      new Phaser.Geom.Point(980, 635),
      new Phaser.Geom.Point(1180, 660),
      new Phaser.Geom.Point(1390, 610),
      new Phaser.Geom.Point(1600, 650),
      new Phaser.Geom.Point(1600, GAME_HEIGHT),
      new Phaser.Geom.Point(0, GAME_HEIGHT),
    ], true);

    g.fillStyle(0x67442e, 1);
    g.fillRect(0, 685, GAME_WIDTH, GAME_HEIGHT - 685);

    g.lineStyle(8, 0x82b94c, 1);
    g.beginPath();
    g.moveTo(0, 660);
    g.lineTo(180, 625);
    g.lineTo(360, 650);
    g.lineTo(540, 600);
    g.lineTo(760, 665);
    g.lineTo(980, 635);
    g.lineTo(1180, 660);
    g.lineTo(1390, 610);
    g.lineTo(1600, 650);
    g.strokePath();

    this.add.image(190, 654, `${playerById(1).tankTexture}-preview`)
      .setOrigin(0.5, 1)
      .setScale(1.1)
      .setDepth(2);

    this.add.image(1410, 645, `${playerById(2).tankTexture}-preview`)
      .setOrigin(0.5, 1)
      .setScale(1.1)
      .setDepth(2);
  }

  private drawPixelDecorations(): void {
    const colors = [0x28c5ff, 0xffbf43, 0x85e65b, 0xff5968];

    for (let i = 0; i < 14; i++) {
      const x = 80 + ((i * 137) % (GAME_WIDTH - 160));
      const y = 220 + ((i * 71) % 360);
      const color = colors[i % colors.length];

      const pixel = this.add.rectangle(x, y, 7, 7, color, 0.85).setDepth(2);

      this.tweens.add({
        targets: pixel,
        alpha: 0.3,
        duration: 700 + (i % 4) * 200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }
  }

  private drawFooter(): void {
    const x = GAME_WIDTH / 2;

    this.add.text(x, 755, "★   TWO PLAYERS     •     ONE SCREEN     •     BIG DESTRUCTION   ★", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "15px",
      color: "#fff1d1",
      stroke: "#18232d",
      strokeThickness: 3,
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(4);

    this.add.text(x, 785, "TIP: Collect resources first, then build a smart defense!", {
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      color: "#e5edf3",
      stroke: "#18232d",
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4);
  }
}
