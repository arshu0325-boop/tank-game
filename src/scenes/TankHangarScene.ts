import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../grid";
import { gameState, playerById, resetGameState, TANK_CATALOG, type PlayerId } from "../state";

export class TankHangarScene extends Phaser.Scene {
  private activePlayer: PlayerId = 1;
  private nightButton!: Phaser.GameObjects.Container;
  private nightLabel!: Phaser.GameObjects.Text;

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

    this.makeButton(125, 840, 190, 58, "BACK", () => this.scene.start("MenuScene"), 0x36465f);
    this.makeButton(GAME_WIDTH / 2, 840, 390, 68, "START MATCH", () => {
      resetGameState();
      this.scene.start("MineScene");
    }, 0x378b37);
  }

  private drawHangar(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x33212e);
    const bg = this.add.graphics();
    bg.fillStyle(0x241b2a, 1);
    bg.fillRect(0, 205, GAME_WIDTH, 640);
    bg.fillStyle(0x70413c, 1);
    bg.fillRect(0, 303, GAME_WIDTH, 9);
    bg.fillStyle(0x4a2d32, 1);
    bg.fillRect(0, 312, GAME_WIDTH, 13);
    for (const y of [500, 725]) {
      bg.fillStyle(0x21171f, 0.85);
      bg.fillRect(0, y + 13, GAME_WIDTH, 26);
      bg.fillStyle(0x75423d, 1);
      bg.fillRect(0, y, GAME_WIDTH, 15);
      bg.fillStyle(0xc07850, 0.9);
      bg.fillRect(0, y, GAME_WIDTH, 3);
      bg.fillStyle(0x462b32, 1);
      bg.fillRect(0, y + 15, GAME_WIDTH, 4);
      for (let x = 80; x < GAME_WIDTH; x += 320) {
        bg.fillStyle(0x8a5146, 0.85);
        bg.fillRect(x, y + 4, 2, 8);
      }
    }
    bg.lineStyle(2, 0x65434a, 0.5);
    for (let x = 30; x < GAME_WIDTH; x += 160) bg.lineBetween(x, 210, x, 840);
    this.add.rectangle(GAME_WIDTH / 2, 207, GAME_WIDTH, 10, 0x8b5143, 0.85);
  }

  private makePlayerTab(x: number, y: number, id: PlayerId): void {
    const isActive = this.activePlayer === id;
    const color = id === 1 ? 0x148fea : 0xed464b;
    const card = this.add.container(x, y);
    const panel = this.add.rectangle(0, 0, 350, 72, isActive ? color : 0x1b202d, 1)
      .setStrokeStyle(3, isActive ? 0xffffff : color, 0.95)
      .setInteractive({ useHandCursor: true });
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
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 280 + col * 520;
    const y = 390 + row * 225;
    const panel = this.add.rectangle(x, y, 360, 194, 0x3c2931, 0.94)
      .setStrokeStyle(3, tank.color, 0.9)
      .setInteractive({ useHandCursor: true });
    panel.on("pointerover", () => panel.setFillStyle(0x53383d));
    panel.on("pointerout", () => panel.setFillStyle(0x3c2931));
    panel.on("pointerdown", () => {
      playerById(this.activePlayer).tankTexture = tank.texture;
      this.scene.restart({ activePlayer: this.activePlayer });
    });

    const selectedP1 = playerById(1).tankTexture === tank.texture;
    const selectedP2 = playerById(2).tankTexture === tank.texture;
    if (selectedP1 || selectedP2) {
      this.add.rectangle(x, y - 82, 112, 25, selectedP1 ? 0x138dea : 0xe43d46, 1)
        .setStrokeStyle(1, 0xffffff, 0.7);
      this.add.text(x, y - 82, selectedP1 && selectedP2 ? "P1 + P2" : selectedP1 ? "P1 PICK" : "P2 PICK", {
        fontFamily: "Arial Black, Arial, sans-serif", fontSize: "12px", color: "#ffffff",
      }).setOrigin(0.5);
    }
    this.add.ellipse(x + 5, y + 31, 205, 27, 0x111018, 0.62);
    const previewTexture = `${tank.texture}-preview`;
    const faceLeft = tank.texture === "tank-red";
    const shadow = this.add.image(x + 7, y - 3, previewTexture)
      .setScale(1.65).setFlipX(faceLeft).setTint(0x17141b).setAlpha(0.72);
    const preview = this.add.image(x, y - 11, previewTexture).setScale(1.65).setFlipX(faceLeft);
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

  private makeButton(x: number, y: number, w: number, h: number, label: string, callback: () => void, color: number): void {
    const rect = this.add.rectangle(x, y, w, h, color, 1).setStrokeStyle(3, 0xf3ead8, 0.95)
      .setInteractive({ useHandCursor: true });
    rect.on("pointerover", () => rect.setAlpha(0.82));
    rect.on("pointerout", () => rect.setAlpha(1));
    rect.on("pointerdown", callback);
    this.add.text(x, y, label, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "23px", color: "#ffffff",
      stroke: "#17202a", strokeThickness: 5,
    }).setOrigin(0.5);
  }
}
