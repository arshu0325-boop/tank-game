import Phaser from "phaser";
import { addBlockImage, GAME_HEIGHT, GAME_WIDTH, MINE_COLS, MINE_ROWS, TILE_SIZE, drawSky, formatTime } from "../grid";
import { gameState, playerById, type PlayerId, type TileType } from "../state";

interface MineCell {
  col: number;
  row: number;
  type: TileType;
  ore?: "iron";
  image: Phaser.GameObjects.Image;
}

const MINE_ORIGIN_Y = 250;
const MINE_SECONDS = 23;

export class MineScene extends Phaser.Scene {
  private cells = new Map<string, MineCell>();
  private elapsed = 0;
  private timeLeft = MINE_SECONDS;
  private transitioning = false;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private timeText!: Phaser.GameObjects.Text;
  private p1Label!: Phaser.GameObjects.Text;
  private p2Label!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super("MineScene");
  }

  create(): void {
    drawSky(this);
    this.createWorld();
    this.createHud();
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.hintText = this.add.text(GAME_WIDTH / 2, 210,
      "MINE PHASE  •  Click blocks on your half to collect dirt, stone, obsidian and iron ore", {
        fontFamily: "Arial Black, Arial, sans-serif", fontSize: "19px", color: "#fff4cf",
        stroke: "#27313b", strokeThickness: 5, align: "center",
      }).setOrigin(0.5).setDepth(20);
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    if (this.transitioning) return;
    this.elapsed += delta / 1000;
    this.timeLeft = Math.max(0, MINE_SECONDS - this.elapsed);
    this.timeText.setText(formatTime(this.timeLeft));
    if (this.timeLeft <= 0) {
      this.transitioning = true;
      this.scene.start("BuildScene");
    }
  }

  private createWorld(): void {
    const surfaceRows: number[] = [];
    for (let col = 0; col < MINE_COLS; col++) {
      const surface = Math.max(2, Math.min(5, 3 + Math.round(Math.sin(col * 0.31) * 1.15 + Math.sin(col * 0.12) * 0.65)));
      surfaceRows.push(surface);
      for (let row = surface; row < MINE_ROWS; row++) {
        let type: TileType;
        let ore: "iron" | undefined;
        const depth = row - surface;
        if (depth < 5) {
          type = "dirt";
        } else if (depth >= 10 && Math.random() < 0.26) {
          type = "obsidian";
        } else {
          type = "stone";
          if (depth >= 3 && Math.random() < 0.11) ore = "iron";
        }
        const image = addBlockImage(
          this,
          col * TILE_SIZE + TILE_SIZE / 2,
          MINE_ORIGIN_Y + row * TILE_SIZE + TILE_SIZE / 2,
          type,
          { surface: row === surface, ore },
        ).setDepth(4);
        this.cells.set(this.cellKey(col, row), { col, row, type, ore, image });
      }
    }

    // The small grass strip makes the top of the underground mine easy to read.
    const ground = this.add.graphics().setDepth(3);
    ground.fillStyle(0x3d772f, 1);
    for (let col = 0; col < MINE_COLS; col++) {
      const y = MINE_ORIGIN_Y + surfaceRows[col] * TILE_SIZE;
      ground.fillRect(col * TILE_SIZE, y - 5, TILE_SIZE, 5);
      ground.fillStyle(0x6eaa43, 1);
      ground.fillRect(col * TILE_SIZE, y - 5, TILE_SIZE, 2);
      ground.fillStyle(0x3d772f, 1);
    }

    const p1X = 160;
    const p2X = 1440;
    const p1Ground = MINE_ORIGIN_Y + surfaceRows[Math.floor(p1X / TILE_SIZE)] * TILE_SIZE;
    const p2Ground = MINE_ORIGIN_Y + surfaceRows[Math.floor(p2X / TILE_SIZE)] * TILE_SIZE;
    this.add.image(p1X, p1Ground, "tank-blue").setOrigin(0.5, 1).setScale(0.95).setDepth(8);
    this.add.image(p2X, p2Ground, "tank-red").setOrigin(0.5, 1).setScale(0.95).setDepth(8);

    // Drill sparks and a subtle center divider make the two mining areas obvious.
    const divider = this.add.graphics().setDepth(12);
    divider.lineStyle(3, 0xf4df9b, 0.7);
    divider.lineBetween(GAME_WIDTH / 2, 280, GAME_WIDTH / 2, GAME_HEIGHT - 58);
    divider.lineStyle(1, 0x18242c, 0.8);
    divider.lineBetween(GAME_WIDTH / 2 + 3, 280, GAME_WIDTH / 2 + 3, GAME_HEIGHT - 58);
  }

  private createHud(): void {
    this.hudGraphics = this.add.graphics().setDepth(25);
    this.add.text(48, 27, "P1: Controller", this.panelTitleStyle()).setDepth(26);
    this.add.text(1305, 27, "P2: Duelist", this.panelTitleStyle()).setDepth(26);
    this.p1Label = this.add.text(48, 66, "HP 100   Fuel 100", this.panelDetailStyle()).setDepth(26);
    this.p2Label = this.add.text(1305, 66, "HP 100   Fuel 100", this.panelDetailStyle()).setDepth(26);
    this.add.rectangle(GAME_WIDTH / 2, 42, 420, 62, 0x552b18, 0.94).setStrokeStyle(4, 0xffbe43, 1).setDepth(25);
    this.add.text(GAME_WIDTH / 2, 41, "MINE & CRAFT PHASE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "31px", color: "#fff5e5",
      stroke: "#28180e", strokeThickness: 6,
    }).setOrigin(0.5).setDepth(26);
    this.timeText = this.add.text(GAME_WIDTH / 2, 100, formatTime(MINE_SECONDS), {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "42px", color: "#ffe12f",
      stroke: "#211d0a", strokeThickness: 7,
    }).setOrigin(0.5).setDepth(26);
    this.resourceText = this.add.text(GAME_WIDTH / 2, 875, "", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "18px", color: "#f9f3dc",
      stroke: "#101820", strokeThickness: 4, align: "center",
    }).setOrigin(0.5).setDepth(27);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.transitioning || pointer.y < MINE_ORIGIN_Y) return;
    const col = Math.floor(pointer.x / TILE_SIZE);
    const row = Math.floor((pointer.y - MINE_ORIGIN_Y) / TILE_SIZE);
    if (col < 0 || col >= MINE_COLS || row < 0 || row >= MINE_ROWS) return;
    const key = this.cellKey(col, row);
    const cell = this.cells.get(key);
    if (!cell) return;

    const id: PlayerId = pointer.x < GAME_WIDTH / 2 ? 1 : 2;
    const player = playerById(id);
    player.inventory[cell.type] += 1;
    if (cell.ore === "iron") player.iron += 1;
    cell.image.destroy();
    this.cells.delete(key);

    const itemLabel = cell.ore === "iron" ? `+1 ${cell.type}  +1 iron` : `+1 ${cell.type}`;
    const pop = this.add.text(pointer.x, pointer.y - 5, itemLabel, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "17px", color: id === 1 ? "#73d8ff" : "#ff9a8c",
      stroke: "#151b20", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(35);
    this.tweens.add({ targets: pop, y: pop.y - 36, alpha: 0, duration: 680, onComplete: () => pop.destroy() });
    this.updateHud();
  }

  private updateHud(): void {
    this.hudGraphics.clear();
    const p1 = playerById(1);
    const p2 = playerById(2);
    this.hudGraphics.fillStyle(0x163047, 0.92).fillRoundedRect(18, 16, 306, 94, 14);
    this.hudGraphics.lineStyle(3, 0x3098f5, 1).strokeRoundedRect(18, 16, 306, 94, 14);
    this.hudGraphics.fillStyle(0x462b2b, 0.92).fillRoundedRect(1276, 16, 306, 94, 14);
    this.hudGraphics.lineStyle(3, 0xf05252, 1).strokeRoundedRect(1276, 16, 306, 94, 14);
    this.drawBar(165, 64, 145, 12, p1.hp / 100, 0x4fd65c);
    this.drawBar(165, 88, 145, 12, p1.fuel / 100, 0xf6bd43);
    this.drawBar(1420, 64, 145, 12, p2.hp / 100, 0x4fd65c);
    this.drawBar(1420, 88, 145, 12, p2.fuel / 100, 0xf6bd43);
    this.p1Label.setText(`HP ${p1.hp}   Fuel ${p1.fuel}`);
    this.p2Label.setText(`HP ${p2.hp}   Fuel ${p2.fuel}`);
    this.resourceText.setText(
      `P1  Dirt ${p1.inventory.dirt}  Stone ${p1.inventory.stone}  Obsidian ${p1.inventory.obsidian}  Iron ${p1.iron}` +
      `     |     P2  Dirt ${p2.inventory.dirt}  Stone ${p2.inventory.stone}  Obsidian ${p2.inventory.obsidian}  Iron ${p2.iron}`,
    );
  }

  private drawBar(x: number, y: number, w: number, h: number, ratio: number, color: number): void {
    this.hudGraphics.fillStyle(0x12171b, 1).fillRect(x, y, w, h);
    this.hudGraphics.lineStyle(2, 0x090d10, 1).strokeRect(x, y, w, h);
    this.hudGraphics.fillStyle(color, 1).fillRect(x + 2, y + 2, Math.max(0, (w - 4) * ratio), h - 4);
  }

  private panelTitleStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: "Arial Black, Arial, sans-serif", fontSize: "24px", color: "#f8f6ec", stroke: "#151b23", strokeThickness: 5 };
  }

  private panelDetailStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: "Arial Black, Arial, sans-serif", fontSize: "15px", color: "#f6f0d8", stroke: "#151b23", strokeThickness: 3 };
  }

  private cellKey(col: number, row: number): string {
    return `${col},${row}`;
  }
}
