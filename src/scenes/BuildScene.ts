import Phaser from "phaser";
import {
  addBlockImage, BUILD_COLS, BUILD_ORIGIN_X, BUILD_ORIGIN_Y, BUILD_ROWS,
  GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, drawSky, formatTime,
} from "../grid";
import { gameState, playerById, type PlayerId, type TileType } from "../state";

const BUILD_SECONDS = 15;

interface PlacedDisplay {
  ownerId: PlayerId;
  col: number;
  row: number;
  type: TileType;
  image: Phaser.GameObjects.Image;
}

export class BuildScene extends Phaser.Scene {
  private placed = new Map<string, PlacedDisplay>();
  private undoStack: string[] = [];
  private elapsed = 0;
  private timeLeft = BUILD_SECONDS;
  private transitioning = false;
  private placementPointerId: number | null = null;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private timerGraphics!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private selectionText!: Phaser.GameObjects.Text;
  private inventoryLabels: Partial<Record<TileType, Phaser.GameObjects.Text>> = {};
  private keyboardKeys!: {
    one: Phaser.Input.Keyboard.Key;
    two: Phaser.Input.Keyboard.Key;
    three: Phaser.Input.Keyboard.Key;
    undo: Phaser.Input.Keyboard.Key;
    ready: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super("BuildScene");
  }

  create(): void {
    drawSky(this);
    this.drawGround();
    this.drawBuildGrids();
    this.add.image(280, 590, playerById(1).tankTexture).setOrigin(0.5, 1).setDepth(6);
    this.add.image(1320, 590, playerById(2).tankTexture).setOrigin(0.5, 1).setFlipX(true).setDepth(6);
    if (gameState.nightMode) this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a1550, 0.42).setDepth(14);
    this.createHud();
    this.renderExistingBlocks();

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);
    if (this.input.keyboard) {
      this.keyboardKeys = this.input.keyboard.addKeys({
        one: Phaser.Input.Keyboard.KeyCodes.ONE,
        two: Phaser.Input.Keyboard.KeyCodes.TWO,
        three: Phaser.Input.Keyboard.KeyCodes.THREE,
        undo: Phaser.Input.Keyboard.KeyCodes.Z,
        ready: Phaser.Input.Keyboard.KeyCodes.ENTER,
      }) as typeof this.keyboardKeys;
    }
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    if (this.transitioning) return;
    this.elapsed += delta / 1000;
    this.timeLeft = Math.max(0, BUILD_SECONDS - this.elapsed);
    this.timerText.setText(formatTime(this.timeLeft));
    this.drawTimerBar();
    if (this.input.keyboard && this.keyboardKeys) {
      if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.one)) this.selectTile("dirt");
      if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.two)) this.selectTile("stone");
      if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.three)) this.selectTile("obsidian");
      if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.undo)) this.undoLastBlock();
      if (Phaser.Input.Keyboard.JustDown(this.keyboardKeys.ready)) this.finishBuild();
    }
    if (this.timeLeft <= 0) this.finishBuild();
  }

  private drawGround(): void {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x92572f, 1);
    g.fillPoints([
      new Phaser.Geom.Point(0, 590), new Phaser.Geom.Point(140, 567),
      new Phaser.Geom.Point(320, 590), new Phaser.Geom.Point(470, 575),
      new Phaser.Geom.Point(640, 625), new Phaser.Geom.Point(800, 670),
      new Phaser.Geom.Point(960, 630), new Phaser.Geom.Point(1120, 580),
      new Phaser.Geom.Point(1300, 590), new Phaser.Geom.Point(1450, 565),
      new Phaser.Geom.Point(1600, 590), new Phaser.Geom.Point(1600, 900),
      new Phaser.Geom.Point(0, 900),
    ], true);
    g.fillStyle(0x4f8d32, 1);
    g.fillPoints([
      new Phaser.Geom.Point(0, 590), new Phaser.Geom.Point(140, 567),
      new Phaser.Geom.Point(320, 590), new Phaser.Geom.Point(470, 575),
      new Phaser.Geom.Point(640, 625), new Phaser.Geom.Point(800, 670),
      new Phaser.Geom.Point(960, 630), new Phaser.Geom.Point(1120, 580),
      new Phaser.Geom.Point(1300, 590), new Phaser.Geom.Point(1450, 565),
      new Phaser.Geom.Point(1600, 590), new Phaser.Geom.Point(1600, 606),
      new Phaser.Geom.Point(1450, 581), new Phaser.Geom.Point(1300, 606),
      new Phaser.Geom.Point(1120, 596), new Phaser.Geom.Point(960, 646),
      new Phaser.Geom.Point(800, 686), new Phaser.Geom.Point(640, 641),
      new Phaser.Geom.Point(470, 591), new Phaser.Geom.Point(320, 606),
      new Phaser.Geom.Point(140, 583), new Phaser.Geom.Point(0, 606),
    ], true);
    g.lineStyle(3, 0xb5e65a, 0.95);
    g.beginPath();
    g.moveTo(0, 590); g.lineTo(140, 567); g.lineTo(320, 590); g.lineTo(470, 575);
    g.lineTo(640, 625); g.lineTo(800, 670); g.lineTo(960, 630); g.lineTo(1120, 580);
    g.lineTo(1300, 590); g.lineTo(1450, 565); g.lineTo(1600, 590); g.strokePath();
  }

  private drawBuildGrids(): void {
    const g = this.add.graphics().setDepth(3);
    for (const id of [1, 2] as PlayerId[]) {
      const x0 = BUILD_ORIGIN_X[id];
      g.fillStyle(id === 1 ? 0x123853 : 0x4a2027, 0.22);
      g.fillRoundedRect(x0 - 7, BUILD_ORIGIN_Y - 7, BUILD_COLS * TILE_SIZE + 14, BUILD_ROWS * TILE_SIZE + 14, 8);
      g.lineStyle(1, id === 1 ? 0x8fd0ff : 0xffaaaa, 0.56);
      for (let col = 0; col <= BUILD_COLS; col++) {
        g.lineBetween(x0 + col * TILE_SIZE, BUILD_ORIGIN_Y, x0 + col * TILE_SIZE, BUILD_ORIGIN_Y + BUILD_ROWS * TILE_SIZE);
      }
      for (let row = 0; row <= BUILD_ROWS; row++) {
        g.lineBetween(x0, BUILD_ORIGIN_Y + row * TILE_SIZE, x0 + BUILD_COLS * TILE_SIZE, BUILD_ORIGIN_Y + row * TILE_SIZE);
      }
      this.add.text(x0 + BUILD_COLS * TILE_SIZE / 2, 317, id === 1 ? "P1 DEFENSE" : "P2 DEFENSE", {
        fontFamily: "Arial Black, Arial, sans-serif", fontSize: "19px", color: id === 1 ? "#bfe8ff" : "#ffd0d0",
        stroke: "#1b2630", strokeThickness: 4,
      }).setOrigin(0.5).setDepth(5);
      // Blue/red tank sprite center is deliberately kept clear for building around it.
      g.lineStyle(2, id === 1 ? 0x54bcff : 0xff6c6c, 0.65);
      g.strokeRoundedRect(x0 + 3 * TILE_SIZE + 3, BUILD_ORIGIN_Y + 4 * TILE_SIZE + 3, 4 * TILE_SIZE - 6, 2 * TILE_SIZE - 6, 5);
    }
  }

  private createHud(): void {
    this.hudGraphics = this.add.graphics().setDepth(20);
    this.timerGraphics = this.add.graphics().setDepth(22);
    this.add.rectangle(GAME_WIDTH / 2, 43, 420, 62, 0x552b18, 0.94).setStrokeStyle(4, 0xffbe43, 1).setDepth(20);
    this.add.text(GAME_WIDTH / 2, 41, "BUILD PHASE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "34px", color: "#fff5e5",
      stroke: "#28180e", strokeThickness: 6,
    }).setOrigin(0.5).setDepth(21);
    this.timerText = this.add.text(GAME_WIDTH / 2, 100, formatTime(BUILD_SECONDS), {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "42px", color: "#ffe12f",
      stroke: "#211d0a", strokeThickness: 7,
    }).setOrigin(0.5).setDepth(21);
    this.drawTimerBar();
    this.tweens.add({ targets: this.timerGraphics, alpha: 0.72, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: this.timerText, scale: 1.045, duration: 720, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    this.add.rectangle(GAME_WIDTH / 2, 817, 1120, 112, 0x171b20, 0.96).setStrokeStyle(3, 0x8c9194, 1).setDepth(20);
    this.makeTileButton(545, 815, "dirt", "1");
    this.makeTileButton(675, 815, "stone", "2");
    this.makeTileButton(805, 815, "obsidian", "3");
    this.add.rectangle(405, 815, 100, 70, 0x303438, 1).setStrokeStyle(3, 0xb0b4b6, 1).setDepth(22);
    this.add.text(405, 815, "UNDO\n(Z)", { fontFamily: "Arial Black, Arial, sans-serif", fontSize: "20px", color: "#ffffff", align: "center", stroke: "#111111", strokeThickness: 3 }).setOrigin(0.5).setDepth(23);
    this.add.rectangle(1288, 815, 180, 74, 0x248334, 1).setStrokeStyle(5, 0x6cff69, 1).setDepth(22);
    this.add.text(1288, 815, "READY", { fontFamily: "Arial Black, Arial, sans-serif", fontSize: "32px", color: "#ffffff", stroke: "#0c3912", strokeThickness: 5 }).setOrigin(0.5).setDepth(23);
    this.selectionText = this.add.text(GAME_WIDTH / 2, 883, "Select a tile, then drag across your grid to place several blocks. Keep the tank area clear.", {
      fontFamily: "Arial", fontSize: "16px", color: "#e7e9e8", stroke: "#171b20", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(24);
  }

  private makeTileButton(x: number, y: number, type: TileType, number: string): void {
    const tint = type === "dirt" ? 0x3f332a : type === "stone" ? 0x343a40 : 0x292238;
    this.add.rectangle(x, y, 112, 70, tint, 1).setStrokeStyle(3, 0xb0b4b6, 1).setDepth(22);
    addBlockImage(this, x - 20, y - 5, type, { size: 32 }).setDepth(23);
    this.add.circle(x - 49, y - 24, 10, 0x111820, 1).setStrokeStyle(1, 0xd5e3e9, 0.9).setDepth(24);
    this.add.text(x - 49, y - 24, number, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "12px", color: "#ffffff", stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);
    this.inventoryLabels[type] = this.add.text(x + 1, y - 5, "", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "11px", color: "#ffffff", stroke: "#111111", strokeThickness: 3,
      lineSpacing: 1,
    }).setOrigin(0, 0.5).setDepth(24);
    this.add.text(x + 17, y + 22, type === "obsidian" ? "OBSIDIAN" : type.toUpperCase(), {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: type === "obsidian" ? "11px" : "13px", color: "#ffffff", stroke: "#111111", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(24);
  }

  private renderExistingBlocks(): void {
    for (const id of [1, 2] as PlayerId[]) {
      for (const block of playerById(id).structure) this.addPlacedBlock(id, block.col, block.row, block.type, false);
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.transitioning) return;
    if (pointer.y > 770) {
      if (pointer.x >= 350 && pointer.x <= 460) this.undoLastBlock();
      else if (pointer.x >= 485 && pointer.x <= 600) this.selectTile("dirt");
      else if (pointer.x >= 615 && pointer.x <= 735) this.selectTile("stone");
      else if (pointer.x >= 745 && pointer.x <= 865) this.selectTile("obsidian");
      else if (pointer.x >= 1180 && pointer.x <= 1400) this.finishBuild();
      return;
    }
    if (pointer.y < BUILD_ORIGIN_Y || pointer.y >= BUILD_ORIGIN_Y + BUILD_ROWS * TILE_SIZE) return;
    this.placementPointerId = pointer.id;
    this.placeAtPointer(pointer);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.isDown && this.placementPointerId === pointer.id) this.placeAtPointer(pointer);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.placementPointerId === pointer.id) this.placementPointerId = null;
  }

  private placeAtPointer(pointer: Phaser.Input.Pointer): void {
    if (this.transitioning || pointer.y < BUILD_ORIGIN_Y || pointer.y >= BUILD_ORIGIN_Y + BUILD_ROWS * TILE_SIZE) return;
    // Grid bounds determine which player's inventory receives the placement.
    let id: PlayerId | null = null;
    if (pointer.x >= BUILD_ORIGIN_X[2] && pointer.x < BUILD_ORIGIN_X[2] + BUILD_COLS * TILE_SIZE) id = 2;
    else if (pointer.x >= BUILD_ORIGIN_X[1] && pointer.x < BUILD_ORIGIN_X[1] + BUILD_COLS * TILE_SIZE) id = 1;
    if (id === null) return;
    const col = Math.floor((pointer.x - BUILD_ORIGIN_X[id]) / TILE_SIZE);
    const row = Math.floor((pointer.y - BUILD_ORIGIN_Y) / TILE_SIZE);
    if (col < 0 || col >= BUILD_COLS || row < 0 || row >= BUILD_ROWS || this.isTankCell(col, row)) return;
    const key = this.placementKey(id, col, row);
    if (this.placed.has(key)) return;
    const player = playerById(id);
    const type = gameState.selectedTile;
    if (player.inventory[type] <= 0) {
      this.selectionText.setText(`P${id} has no ${type}. Mine more blocks next round.`);
      return;
    }
    player.inventory[type] -= 1;
    player.structure.push({ col, row, type });
    this.addPlacedBlock(id, col, row, type);
    this.undoStack.push(key);
    this.updateHud();
  }

  private addPlacedBlock(id: PlayerId, col: number, row: number, type: TileType, animate = true): void {
    const x = BUILD_ORIGIN_X[id] + col * TILE_SIZE + TILE_SIZE / 2;
    const y = BUILD_ORIGIN_Y + row * TILE_SIZE + TILE_SIZE / 2;
    const image = addBlockImage(this, x, y, type, { size: TILE_SIZE }).setDepth(8);
    if (animate) {
      image.setScale(0.55).setAlpha(0.4);
      this.tweens.add({ targets: image, scale: 1, alpha: 1, duration: 160, ease: "Back.Out" });
      this.emitBlockParticles(x, y, type === "dirt" ? 0xc8915f : type === "stone" ? 0xc4d0d5 : 0xb7a4e4, 5);
    }
    const key = this.placementKey(id, col, row);
    this.placed.set(key, { ownerId: id, col, row, type, image });
  }

  private removeBlock(key: string): void {
    const block = this.placed.get(key);
    if (!block) return;
    this.emitBlockParticles(block.image.x, block.image.y, block.type === "dirt" ? 0xc8915f : block.type === "stone" ? 0xc4d0d5 : 0xb7a4e4, 9);
    this.tweens.add({
      targets: block.image, scale: 0.25, alpha: 0, duration: 130,
      onComplete: () => block.image.destroy(),
    });
    this.placed.delete(key);
    const structure = playerById(block.ownerId).structure;
    const index = structure.findIndex((item) => item.col === block.col && item.row === block.row);
    if (index >= 0) {
      structure.splice(index, 1);
      playerById(block.ownerId).inventory[block.type] += 1;
    }
  }

  private emitBlockParticles(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const particle = this.add.rectangle(x, y, Phaser.Math.Between(3, 6), Phaser.Math.Between(3, 6), color, 1).setDepth(10);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-24, 24),
        y: y + Phaser.Math.Between(8, 42),
        angle: Phaser.Math.Between(-150, 150),
        alpha: 0,
        duration: Phaser.Math.Between(260, 460),
        ease: "Cubic.easeIn",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private undoLastBlock(): void {
    while (this.undoStack.length) {
      const key = this.undoStack.pop()!;
      if (this.placed.has(key)) {
        this.removeBlock(key);
        this.updateHud();
        return;
      }
    }
  }

  private selectTile(type: TileType): void {
    gameState.selectedTile = type;
    this.selectionText.setText(`Selected ${type.toUpperCase()} • press 1 / 2 / 3 to switch material`);
    this.updateHud();
  }

  private updateHud(): void {
    this.hudGraphics.clear();
    for (const type of ["dirt", "stone", "obsidian"] as TileType[]) {
      const x = type === "dirt" ? 545 : type === "stone" ? 675 : 805;
      if (gameState.selectedTile === type) {
        this.hudGraphics.lineStyle(5, 0x48d9ff, 1).strokeRoundedRect(x - 58, 779, 116, 72, 5);
      }
    }
    const p1 = playerById(1);
    const p2 = playerById(2);
    for (const type of ["dirt", "stone", "obsidian"] as TileType[]) {
      this.inventoryLabels[type]?.setText(`P1 ${p1.inventory[type]}\nP2 ${p2.inventory[type]}`);
    }
  }

  private drawTimerBar(): void {
    if (!this.timerGraphics) return;
    const x = GAME_WIDTH / 2 - 160;
    const y = 137;
    const width = 320;
    const ratio = Phaser.Math.Clamp(this.timeLeft / BUILD_SECONDS, 0, 1);
    const fill = width * ratio;
    this.timerGraphics.clear();
    if (fill > 0) this.timerGraphics.fillStyle(0xffd64f, 0.25).fillRoundedRect(x - 4, y - 4, fill + 8, 16, 7);
    this.timerGraphics.fillStyle(0x15212a, 0.95).fillRoundedRect(x, y, width, 8, 4);
    this.timerGraphics.fillStyle(0xffd64f, 1).fillRoundedRect(x + 2, y + 2, Math.max(0, fill - 4), 4, 2);
    this.timerGraphics.lineStyle(1, 0xffef9a, 0.95).strokeRoundedRect(x, y, width, 8, 4);
  }

  private isTankCell(col: number, row: number): boolean {
    return row >= 4 && col >= 3 && col <= 6;
  }

  private finishBuild(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.scene.start("BattleScene");
  }

  private placementKey(id: PlayerId, col: number, row: number): string {
    return `${id}:${col},${row}`;
  }
}
