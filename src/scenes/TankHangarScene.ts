import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../grid";
import { gameState, playerById, resetGameState, TANK_CATALOG, type PlayerId } from "../state";

export class TankHangarScene extends Phaser.Scene {
  private activePlayer: PlayerId = 1;
  private nightButton!: Phaser.GameObjects.Container;
  private nightLabel!: Phaser.GameObjects.Text;
  private selectionStatus!: Phaser.GameObjects.Text;

  constructor() {
    super("TankHangarScene");
  }

  init(data?: { activePlayer?: PlayerId }): void {
    this.activePlayer = data?.activePlayer ?? 1;
  }

  create(): void {
    this.drawHangar();
    this.add.text(GAME_WIDTH / 2, 57, "TANK HANGAR", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "54px", color: "#fff4dc",
      stroke: "#261b25", strokeThickness: 9,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 111, "PICK A MACHINE FOR EACH PLAYER", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "18px", color: "#f5c65b",
      stroke: "#261b25", strokeThickness: 4,
    }).setOrigin(0.5);

    this.makePlayerTab(575, 174, 1);
    this.makePlayerTab(1025, 174, 2);
    this.makeNightToggle();
    TANK_CATALOG.forEach((tank, index) => this.makeTankCard(index));
    this.selectionStatus = this.add.text(GAME_WIDTH / 2, 766, "Choose a different tank for each player.", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "17px", color: "#f2d8a0",
      stroke: "#211922", strokeThickness: 4,
    }).setOrigin(0.5);

    this.makeButton(125, 840, 190, 58, "BACK", () => this.scene.start("MenuScene"), 0x36465f);
    this.makeButton(GAME_WIDTH / 2, 840, 390, 68, "START MATCH", () => {
      if (playerById(1).tankTexture === playerById(2).tankTexture) {
        this.selectionStatus.setText("Players must choose different tanks.").setColor("#ff8d93");
        return;
      }
      resetGameState();
      this.scene.start("MineScene");
    }, 0x378b37);
  }

  private drawHangar(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x252b34, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Steel shop wall with framed panels and an overhead beam.
    bg.fillStyle(0x343d48, 1).fillRect(0, 0, GAME_WIDTH, 760);
    bg.fillStyle(0x1b222a, 1).fillRect(0, 0, GAME_WIDTH, 18);
    bg.fillStyle(0x46515a, 1).fillRect(0, 188, GAME_WIDTH, 18);
    bg.fillStyle(0x202831, 1).fillRect(0, 206, GAME_WIDTH, 10);
    bg.lineStyle(3, 0x252e37, 0.9);
    for (let x = 20; x < GAME_WIDTH; x += 160) {
      bg.lineBetween(x, 18, x, 188);
      bg.fillStyle(0x65717a, 0.8).fillCircle(x, 197, 3);
    }

    // Long fluorescent fixtures cast a warm pool of workshop light.
    for (const x of [390, 800, 1210]) {
      bg.fillStyle(0x171e25, 1).fillRoundedRect(x - 88, 18, 176, 18, 7);
      bg.fillStyle(0xf5d99a, 0.95).fillRoundedRect(x - 73, 22, 146, 7, 3);
      bg.fillStyle(0xffe2a0, 0.08).fillTriangle(x - 73, 29, x + 73, 29, x, 184);
    }

    // Tool cabinets and pegboards sit at the edges of the selection bays.
    for (const x of [18, 1435]) {
      bg.fillStyle(0x151b22, 1).fillRoundedRect(x, 236, 147, 230, 8);
      bg.fillStyle(0x59636a, 1).fillRoundedRect(x + 7, 243, 133, 93, 5);
      bg.lineStyle(2, 0x879096, 0.7);
      for (let yy = 254; yy < 328; yy += 18) bg.lineBetween(x + 14, yy, x + 133, yy);
      bg.fillStyle(0xb7a274, 1);
      bg.fillRoundedRect(x + 27, 262, 7, 47, 3).fillRoundedRect(x + 54, 253, 7, 56, 3)
        .fillRoundedRect(x + 88, 267, 7, 42, 3).fillRoundedRect(x + 114, 256, 7, 53, 3);
      bg.fillStyle(0x303942, 1).fillRoundedRect(x + 7, 344, 133, 114, 5);
      for (const yy of [372, 401, 430]) {
        bg.fillStyle(0x1d252d, 1).fillRoundedRect(x + 15, yy, 117, 22, 4);
        bg.fillStyle(0x9fa9ad, 0.8).fillRoundedRect(x + 66, yy + 8, 16, 4, 2);
      }
      bg.fillStyle(0xe4ae43, 0.9).fillRect(x + 7, 460, 133, 5);
    }

    // Concrete floor with a marked service lane.
    bg.fillStyle(0x62676a, 1).fillRect(0, 760, GAME_WIDTH, 140);
    bg.fillStyle(0x464d53, 1).fillRect(0, 760, GAME_WIDTH, 8);
    bg.lineStyle(2, 0x85898a, 0.45);
    for (let x = 0; x <= GAME_WIDTH; x += 200) bg.lineBetween(x, 768, x - 55, GAME_HEIGHT);
    bg.lineStyle(3, 0xe0ad45, 0.75).lineBetween(170, 781, 170, 900).lineBetween(1430, 781, 1430, 900);
    bg.fillStyle(0xe0ad45, 0.12).fillRect(173, 781, 1254, 119);
    // Black and yellow safety stripe along the back of the floor.
    bg.fillStyle(0x20262c, 1).fillRect(0, 748, GAME_WIDTH, 12);
    for (let x = 0; x < GAME_WIDTH; x += 42) {
      bg.fillStyle(0xe0ad45, 1).fillTriangle(x, 760, x + 18, 760, x + 30, 748);
    }

    // Loose tools add a little workshop character in the open gaps around the cards.
    const addWrench = (x: number, y: number, angle: number): void => {
      const tool = this.add.graphics().setPosition(x, y).setRotation(angle).setAlpha(0.82);
      tool.lineStyle(9, 0x202a32, 1).lineBetween(-25, 1, 18, 1);
      tool.lineStyle(5, 0xaab4b6, 1).lineBetween(-25, -2, 14, -2);
      tool.lineStyle(7, 0x202a32, 1).strokeCircle(-25, 0, 7);
      tool.lineStyle(5, 0xaab4b6, 1).strokeCircle(-25, 0, 4);
      tool.lineStyle(8, 0x202a32, 1).lineBetween(14, 0, 24, -9).lineBetween(14, 0, 24, 9);
      tool.lineStyle(4, 0xaab4b6, 1).lineBetween(16, -1, 26, -11).lineBetween(16, 1, 26, 11);
    };
    const addHammer = (x: number, y: number, angle: number): void => {
      const tool = this.add.graphics().setPosition(x, y).setRotation(angle).setAlpha(0.84);
      tool.lineStyle(10, 0x252b30, 1).lineBetween(-3, 21, 5, -18);
      tool.lineStyle(5, 0xb77b46, 1).lineBetween(-1, 17, 7, -15);
      tool.fillStyle(0x252b30, 1).fillRoundedRect(-17, -28, 34, 12, 4);
      tool.fillStyle(0xb7c0c1, 1).fillRoundedRect(-14, -26, 27, 5, 2);
    };
    const addScrewdriver = (x: number, y: number, angle: number): void => {
      const tool = this.add.graphics().setPosition(x, y).setRotation(angle).setAlpha(0.84);
      tool.lineStyle(7, 0x252b30, 1).lineBetween(0, -14, 0, 23);
      tool.lineStyle(4, 0xd0a247, 1).lineBetween(0, -10, 0, 21);
      tool.fillStyle(0x252b30, 1).fillRoundedRect(-9, -31, 18, 19, 6);
      tool.fillStyle(0xd9573e, 1).fillRoundedRect(-6, -29, 12, 14, 4);
      tool.lineStyle(3, 0xaab4b6, 1).lineBetween(0, 23, 0, 30);
    };

    addWrench(535, 380, -0.65);
    addHammer(1065, 390, 0.45);
    addScrewdriver(535, 640, 0.35);
    addWrench(1060, 645, 0.8);
    addHammer(1290, 783, -0.3);
  }

  private makePlayerTab(x: number, y: number, id: PlayerId): void {
    const isActive = this.activePlayer === id;
    const color = id === 1 ? 0x148fea : 0xed464b;
    const card = this.add.container(x, y);
    const frame = this.add.graphics();
    const drawTab = (hover = false) => {
      frame.clear();
      frame.fillStyle(0x100e17, 0.45).fillRoundedRect(-171, -32, 350, 72, 18);
      frame.fillStyle(isActive ? (hover ? 0x267db0 : color) : (hover ? 0x343442 : 0x1b202d), 1)
        .fillRoundedRect(-175, -36, 350, 72, 18);
      frame.lineStyle(3, isActive ? 0xffffff : color, 0.95).strokeRoundedRect(-175, -36, 350, 72, 18);
      frame.fillStyle(color, isActive ? 0.7 : 0.32).fillRoundedRect(-169, -30, 338, 5, 3);
    };
    drawTab();
    card.add(frame);
    const panel = this.add.rectangle(0, 0, 350, 72, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    panel.on("pointerover", () => drawTab(true));
    panel.on("pointerout", () => drawTab());
    panel.on("pointerdown", () => {
      this.activePlayer = id;
      this.scene.restart({ activePlayer: id });
    });
    card.add(panel);
    card.add(this.add.text(0, -11, `PLAYER ${id}`, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "22px", color: "#ffffff",
      stroke: "#17202a", strokeThickness: 4,
    }).setOrigin(0.5));
    const selected = TANK_CATALOG.find((tank) => tank.texture === playerById(id).tankTexture)?.name ?? "Vanguard";
    card.add(this.add.text(0, 17, selected, {
      fontFamily: "Arial", fontSize: "16px", color: "#fff1c7",
    }).setOrigin(0.5));
  }

  private makeTankCard(index: number): void {
    const tank = TANK_CATALOG[index];
    const otherPlayer = this.activePlayer === 1 ? 2 : 1;
    const heldByOther = playerById(otherPlayer).tankTexture === tank.texture;
    const heldByCurrent = playerById(this.activePlayer).tankTexture === tank.texture;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 280 + col * 520;
    const y = 390 + row * 225;
    const frame = this.add.graphics();
    const drawFrame = (fill: number, line: number) => {
      frame.clear();
      frame.fillStyle(0x100e17, 0.42).fillRoundedRect(x - 174, y - 91, 360, 194, 23);
      frame.fillStyle(fill, 0.97).fillRoundedRect(x - 180, y - 97, 360, 194, 23);
      frame.lineStyle(3, line, 0.95).strokeRoundedRect(x - 180, y - 97, 360, 194, 23);
      frame.fillStyle(tank.color, 0.22).fillRoundedRect(x - 174, y - 91, 348, 7, 4);
    };
    drawFrame(heldByOther ? 0x28242e : heldByCurrent ? 0x4b3940 : 0x3c2931, tank.color);
    const panel = this.add.rectangle(x, y, 360, 194, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    panel.on("pointerover", () => drawFrame(heldByOther ? 0x38313d : 0x53383d, heldByOther ? 0xb08a9a : 0xffdfa0));
    panel.on("pointerout", () => drawFrame(heldByOther ? 0x28242e : heldByCurrent ? 0x4b3940 : 0x3c2931, tank.color));
    panel.on("pointerdown", () => {
      if (playerById(otherPlayer).tankTexture === tank.texture) {
        this.selectionStatus?.setText(`${tank.name} is already selected by Player ${otherPlayer}.`).setColor("#ff8d93");
        return;
      }
      playerById(this.activePlayer).tankTexture = tank.texture;
      playerById(this.activePlayer).color = tank.color;
      this.scene.restart({ activePlayer: this.activePlayer });
    });

    const selectedP1 = playerById(1).tankTexture === tank.texture;
    const selectedP2 = playerById(2).tankTexture === tank.texture;
    if (selectedP1 || selectedP2) {
      this.add.rectangle(x, y - 82, 128, 25, selectedP1 ? 0x138dea : 0xe43d46, 1)
        .setStrokeStyle(1, 0xffffff, 0.7);
      this.add.text(x, y - 82, selectedP1 && selectedP2 ? "P1 + P2" : selectedP1 ? "P1 PICK" : "P2 PICK", {
        fontFamily: "Arial Black, Arial, sans-serif", fontSize: "12px", color: "#ffffff",
      }).setOrigin(0.5);
    }
    this.add.ellipse(x + 5, y + 31, 205, 27, 0x111018, 0.62);
    const previewTexture = `${tank.texture}-preview`;
    const faceRightInCard = tank.texture === "tank-red";
    const shadow = this.add.image(x + 7, y - 3, previewTexture)
      .setScale(1.65).setFlipX(faceRightInCard).setTint(0x17141b).setAlpha(0.72);
    const preview = this.add.image(x, y - 11, previewTexture).setScale(1.65).setFlipX(faceRightInCard);
    panel.on("pointerover", () => this.tweens.add({ targets: preview, scale: 1.74, duration: 130, ease: "Back.Out" }));
    panel.on("pointerout", () => this.tweens.add({ targets: preview, scale: 1.65, duration: 130, ease: "Sine.Out" }));
    shadow.setScale(1.65);
    this.add.text(x, y + 64, tank.name.toUpperCase(), {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "21px", color: "#fff4dd",
      stroke: "#241b20", strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(x, y + 84, tank.role, {
      fontFamily: "Arial", fontSize: "16px", color: "#edc9a5",
    }).setOrigin(0.5);
    if (heldByOther) {
      this.add.rectangle(x, y, 360, 194, 0x10101b, 0.56).setStrokeStyle(2, 0xc3a6ad, 0.78);
      this.add.text(x, y + 4, `TAKEN BY PLAYER ${otherPlayer}`, {
        fontFamily: "Arial Black, Arial, sans-serif", fontSize: "16px", color: "#fff0f0",
        stroke: "#20151b", strokeThickness: 4, align: "center",
      }).setOrigin(0.5);
    }
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, callback: () => void, color: number): void {
    const frame = this.add.graphics();
    const drawButton = (hover = false) => {
      frame.clear();
      frame.fillStyle(0x100e17, 0.5).fillRoundedRect(x - w / 2 + 5, y - h / 2 + 6, w, h, 18);
      frame.fillStyle(hover ? Phaser.Display.Color.ValueToColor(color).brighten(16).color : color, 1)
        .fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
      frame.lineStyle(3, hover ? 0xffdf9b : 0xf3ead8, 0.98)
        .strokeRoundedRect(x - w / 2, y - h / 2, w, h, 18);
      frame.fillStyle(0xffffff, hover ? 0.2 : 0.12).fillRoundedRect(x - w / 2 + 8, y - h / 2 + 7, w - 16, 5, 3);
    };
    drawButton();
    const rect = this.add.rectangle(x, y, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    rect.on("pointerover", () => drawButton(true));
    rect.on("pointerout", () => drawButton());
    rect.on("pointerdown", callback);
    this.add.text(x, y, label, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "23px", color: "#ffffff",
      stroke: "#17202a", strokeThickness: 5,
    }).setOrigin(0.5);
  }

  private makeNightToggle(): void {
    this.nightButton = this.add.container(1415, 173);
    const panel = this.add.rectangle(0, 0, 230, 52, 0x151d4c, 1)
      .setStrokeStyle(2, 0x788eff, 1)
      .setInteractive({ useHandCursor: true });
    panel.on("pointerdown", () => {
      gameState.nightMode = !gameState.nightMode;
      this.updateNightToggle();
    });
    this.nightLabel = this.add.text(0, 0, "", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "17px", color: "#ffffff",
    }).setOrigin(0.5);
    this.nightButton.add([panel, this.nightLabel]);
    this.updateNightToggle();
  }

  private updateNightToggle(): void {
    this.nightLabel.setText(gameState.nightMode ? "☾  NIGHT MODE: ON" : "☀  NIGHT MODE: OFF");
  }
}
