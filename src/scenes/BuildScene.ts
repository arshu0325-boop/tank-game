import Phaser from "phaser";
import {
  addBlockImage, BUILD_COLS, BUILD_ORIGIN_X, BUILD_ORIGIN_Y, BUILD_ROWS,
  GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, formatTime,
} from "../grid";
import { gameState, playerById, type PlayerId, type TileType } from "../state";
import { PlayerStatusHud } from "../ui/PlayerStatusHud";

const BUILD_SECONDS = 15;

interface PlacedDisplay {
  ownerId: PlayerId;
  col: number;
  row: number;
  type: TileType;
  image: Phaser.GameObjects.Image;
}

export class BuildScene extends Phaser.Scene {
  private activeBuilder: PlayerId = 1;
  private placed = new Map<string, PlacedDisplay>();
  private undoStack: string[] = [];
  private elapsed = 0;
  private timeLeft = BUILD_SECONDS;
  private transitioning = false;
  private placementPointerId: number | null = null;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private playerHud!: PlayerStatusHud;
  private timerGraphics!: Phaser.GameObjects.Graphics;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private readonly mainCameraIgnored = new Set<Phaser.GameObjects.GameObject>();
  private readonly uiCameraIgnored = new Set<Phaser.GameObjects.GameObject>();
  private timerText!: Phaser.GameObjects.Text;
  private builderText!: Phaser.GameObjects.Text;
  private readyText!: Phaser.GameObjects.Text;
  private tanks!: Record<PlayerId, Phaser.GameObjects.Image>;
  private selectionText!: Phaser.GameObjects.Text;
  private inventoryLabels: Record<PlayerId, Partial<Record<TileType, Phaser.GameObjects.Text>>> = { 1: {}, 2: {} };
  private tileButtons: Record<PlayerId, Array<{
    panel: Phaser.GameObjects.Rectangle;
    icon: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
    count: Phaser.GameObjects.Text;
  }>> = { 1: [], 2: [] };
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
    this.activeBuilder = 1;
    this.elapsed = 0;
    this.timeLeft = BUILD_SECONDS;
    this.transitioning = false;
    this.placementPointerId = null;
    this.undoStack = [];
    this.placed = new Map();
    this.tileButtons = { 1: [], 2: [] };
    this.inventoryLabels = { 1: {}, 2: {} };
    this.mainCameraIgnored.clear();
    this.uiCameraIgnored.clear();
    const background = gameState.nightMode ? "battle-night-background" : "battle-day-background";
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, background)
      .setDisplaySize(GAME_WIDTH + 1000, GAME_HEIGHT).setDepth(-10);
    this.drawGround();
    this.drawBuildGrids();
    const p1FacesLeftByDefault = playerById(1).tankTexture === "tank-red";
    const p2FacesLeftByDefault = playerById(2).tankTexture === "tank-red";
    this.tanks = {
      1: this.add.image(280, 590, `${playerById(1).tankTexture}-preview`).setOrigin(0.5, 1)
        .setFlipX(p1FacesLeftByDefault).setDepth(6),
      2: this.add.image(1320, 590, `${playerById(2).tankTexture}-preview`).setOrigin(0.5, 1)
        .setFlipX(!p2FacesLeftByDefault).setDepth(6),
    };
    this.createHud();
    this.renderExistingBlocks();
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.syncCameraLayers();
    this.focusCameraOnBuilder(false);

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
    this.syncCameraLayers();
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

  private syncCameraLayers(): void {
    const objects = this.children.list as Array<Phaser.GameObjects.GameObject & { depth: number }>;
    for (const object of objects) {
      if (object.depth >= 20) {
        if (!this.mainCameraIgnored.has(object)) {
          this.cameras.main.ignore(object);
          this.mainCameraIgnored.add(object);
        }
      } else if (!this.uiCameraIgnored.has(object)) {
        this.uiCamera.ignore(object);
        this.uiCameraIgnored.add(object);
      }
    }
  }

  private focusCameraOnBuilder(animate: boolean): void {
    const camera = this.cameras.main;
    const zoom = 2;
    const tankCenter = this.tanks[this.activeBuilder].getCenter();
    // Phaser scroll values are screen-pixel offsets; centerOn accounts for zoom.
    const scrollX = tankCenter.x - GAME_WIDTH / 2;
    const scrollY = tankCenter.y - GAME_HEIGHT / 2;
    camera.setZoom(zoom);
    if (animate) {
      this.tweens.add({ targets: camera, scrollX, scrollY, duration: 450, ease: "Sine.easeInOut" });
    } else {
      camera.setScroll(scrollX, scrollY);
    }
  }

  private drawGround(): void {
    const g = this.add.graphics().setDepth(1);
    const night = gameState.nightMode;
    const surface: Array<[number, number]> = [
      [-500, 590], [0, 590], [140, 567], [320, 590], [470, 575], [640, 625], [800, 670],
      [960, 630], [1120, 580], [1300, 590], [1450, 565], [1600, 590], [2100, 590],
    ];
    const surfaceY = (x: number): number => {
      for (let i = 1; i < surface.length; i++) {
        const [rightX, rightY] = surface[i];
        const [leftX, leftY] = surface[i - 1];
        if (x <= rightX) return leftY + (rightY - leftY) * ((x - leftX) / (rightX - leftX));
      }
      return surface[surface.length - 1][1];
    };
    const drawBand = (topOffset: number, bottomOffset: number | null, color: number): void => {
      g.fillStyle(color, 1);
      g.beginPath();
      surface.forEach(([x, y], index) => {
        if (index === 0) g.moveTo(x, y + topOffset); else g.lineTo(x, y + topOffset);
      });
      if (bottomOffset === null) {
        g.lineTo(surface[surface.length - 1][0], GAME_HEIGHT);
        g.lineTo(surface[0][0], GAME_HEIGHT);
      } else {
        for (let i = surface.length - 1; i >= 0; i--) {
          const [x, y] = surface[i];
          g.lineTo(x, y + bottomOffset);
        }
      }
      g.closePath();
      g.fillPath();
    };
    drawBand(225, null, night ? 0x252b49 : 0x363b50);
    drawBand(88, 225, night ? 0x49383d : 0x65402d);
    drawBand(0, 88, night ? 0x65434a : 0x8b512d);
    drawBand(0, 13, night ? 0x3f713d : 0x57933a);

    for (let x = -500; x < GAME_WIDTH + 500; x += 34) {
      for (let depth = 32; depth < 360; depth += 33) {
        const seed = Math.floor(x * 11 + depth * 5);
        const y = surfaceY(x) + depth + Math.sin((x + depth) * 0.07) * 3;
        if (depth < 90) g.fillStyle(seed % 2 ? (night ? 0x98624b : 0xc17a42) : (night ? 0x372f3a : 0x633b29), 0.72);
        else if (depth < 225) g.fillStyle(seed % 2 ? (night ? 0x9b674f : 0xa96537) : (night ? 0x302b39 : 0x51352c), 0.75);
        else g.fillStyle(seed % 2 ? (night ? 0x707b98 : 0x818b91) : (night ? 0x292840 : 0x272d3d), 0.76);
        const size = 3 + Math.abs(seed % 5);
        g.fillRect(x + (seed % 7) - 3, y, size + 3, Math.max(2, size - 1));
      }
    }

    g.lineStyle(10, night ? 0x37683b : 0x477a35, 1);
    g.beginPath();
    surface.forEach(([x, y], index) => index === 0 ? g.moveTo(x, y) : g.lineTo(x, y));
    g.strokePath();
    g.lineStyle(4, night ? 0x87c954 : 0xb4e65b, 1);
    g.beginPath();
    surface.forEach(([x, y], index) => index === 0 ? g.moveTo(x, y - 2) : g.lineTo(x, y - 2));
    g.strokePath();
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
    this.hudGraphics = this.add.graphics().setDepth(26);
    this.playerHud = new PlayerStatusHud(this, 20);
    this.timerGraphics = this.add.graphics().setDepth(22);
    const phaseBadge = this.add.graphics().setDepth(20);
    phaseBadge.fillStyle(0x100e17, 0.5).fillRoundedRect(GAME_WIDTH / 2 - 205, 16, 420, 62, 17);
    phaseBadge.fillStyle(0x552b18, 0.97).fillRoundedRect(GAME_WIDTH / 2 - 210, 12, 420, 62, 17);
    phaseBadge.lineStyle(3, 0xffbe43, 1).strokeRoundedRect(GAME_WIDTH / 2 - 210, 12, 420, 62, 17);
    phaseBadge.fillStyle(0xffbe43, 0.3).fillRoundedRect(GAME_WIDTH / 2 - 204, 18, 408, 6, 3);
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
    this.builderText = this.add.text(GAME_WIDTH / 2, 174, "PLAYER 1  •  BUILD YOUR DEFENSE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "20px", color: "#bfe8ff",
      stroke: "#101820", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(21);

    this.add.rectangle(GAME_WIDTH / 2, 817, 1520, 112, 0x111923, 0.97).setStrokeStyle(3, 0x8cabbc, 0.95).setDepth(20);
    this.add.rectangle(358, 817, 600, 96, 0x12334b, 0.68).setStrokeStyle(2, 0x3aa7eb, 0.85).setDepth(21);
    this.add.rectangle(1242, 817, 600, 96, 0x48252c, 0.68).setStrokeStyle(2, 0xf05b66, 0.85).setDepth(21);
    this.add.rectangle(800, 817, 250, 96, 0x1b2733, 0.96).setStrokeStyle(2, 0xb0c4d0, 0.9).setDepth(21);
    this.add.text(358, 779, "P1 BLOCKS", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "15px", color: "#8ed7ff", stroke: "#101820", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(23);
    this.add.text(1242, 779, "P2 BLOCKS", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "15px", color: "#ffaaa8", stroke: "#101820", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(23);
    for (const [playerId, centers] of [[1, [168, 350, 532]], [2, [1068, 1250, 1432]]] as const) {
      const types: TileType[] = ["dirt", "stone", "obsidian"];
      centers.forEach((center, index) => this.makeTileButton(center, 831, types[index], playerId));
    }
    this.add.rectangle(800, 779, 118, 28, 0x303b46, 1).setStrokeStyle(2, 0xc1d3df, 1).setDepth(22);
    this.add.text(800, 779, "UNDO  •  Z", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "14px", color: "#ffffff", stroke: "#111111", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(23);
    this.add.rectangle(800, 831, 166, 64, 0x238338, 1).setStrokeStyle(4, 0x75ff77, 1).setDepth(22);
    this.readyText = this.add.text(800, 831, "READY", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "29px", color: "#ffffff", stroke: "#0c3912", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(23);
    this.selectionText = this.add.text(GAME_WIDTH / 2, 883, "SELECT A BLOCK  •  DRAG ON YOUR GRID TO PLACE  •  1/2/3 SWITCH MATERIAL  •  KEEP TANK AREA CLEAR", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "13px", color: "#e7e9e8", stroke: "#171b20", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(24);
  }

  private makeTileButton(x: number, y: number, type: TileType, playerId: PlayerId): void {
    const player = playerById(playerId);
    const panelFill = playerId === 1 ? 0x173d58 : 0x512a31;
    const panel = this.add.rectangle(x, y, 158, 70, panelFill, 1)
      .setStrokeStyle(2, player.color, 0.95).setDepth(22);
    const icon = addBlockImage(this, x - 48, y - 2, type, { size: TILE_SIZE }).setDepth(23);
    const label = this.add.text(x + 17, y - 18, type === "obsidian" ? "OBSIDIAN" : type.toUpperCase(), {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "11px", color: "#ffffff", stroke: "#111111", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(24);
    const count = this.add.text(x + 17, y + 11, `${player.inventory[type]}`, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "24px", color: playerId === 1 ? "#a7e4ff" : "#ffc1bd",
      stroke: "#101820", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(24);
    this.inventoryLabels[playerId][type] = count;
    this.tileButtons[playerId].push({ panel, icon, label, count });
    panel.setStrokeStyle(2, player.color, 0.95);
  }

  private renderExistingBlocks(): void {
    for (const id of [1, 2] as PlayerId[]) {
      for (const block of playerById(id).structure) this.addPlacedBlock(id, block.col, block.row, block.type, false);
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.transitioning) return;
    if (pointer.y >= 760) {
      if (pointer.x >= 740 && pointer.x <= 860 && pointer.y <= 795) {
        this.undoLastBlock();
      } else if (pointer.x >= 715 && pointer.x <= 885 && pointer.y >= 800 && pointer.y <= 866) {
        this.finishBuild();
      } else if (pointer.y >= 795 && pointer.y <= 867) {
        const tileCenters = [168, 350, 532, 1068, 1250, 1432];
        const buttonIndex = tileCenters.findIndex((center) => Math.abs(pointer.x - center) <= 80);
        if (buttonIndex >= 0) {
          const ownerId = buttonIndex < 3 ? 1 : 2;
          if (ownerId === this.activeBuilder) {
            this.selectTile((["dirt", "stone", "obsidian"] as TileType[])[buttonIndex % 3]);
          } else {
            this.selectionText.setText(`PLAYER ${this.activeBuilder} IS BUILDING NOW.`);
          }
        }
      }
      return;
    }
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (worldPoint.y < BUILD_ORIGIN_Y || worldPoint.y >= BUILD_ORIGIN_Y + BUILD_ROWS * TILE_SIZE) return;
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
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (this.transitioning || worldPoint.y < BUILD_ORIGIN_Y || worldPoint.y >= BUILD_ORIGIN_Y + BUILD_ROWS * TILE_SIZE) return;
    // Grid bounds determine which player's inventory receives the placement.
    let id: PlayerId | null = null;
    if (worldPoint.x >= BUILD_ORIGIN_X[2] && worldPoint.x < BUILD_ORIGIN_X[2] + BUILD_COLS * TILE_SIZE) id = 2;
    else if (worldPoint.x >= BUILD_ORIGIN_X[1] && worldPoint.x < BUILD_ORIGIN_X[1] + BUILD_COLS * TILE_SIZE) id = 1;
    if (id === null || id !== this.activeBuilder) return;
    const col = Math.floor((worldPoint.x - BUILD_ORIGIN_X[id]) / TILE_SIZE);
    const row = Math.floor((worldPoint.y - BUILD_ORIGIN_Y) / TILE_SIZE);
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
      image.setScale(0.42).setAlpha(0.28);
      this.tweens.add({ targets: image, scale: 1, alpha: 1, duration: 300, ease: "Back.Out" });
      this.emitBlockParticles(x, y, type === "dirt" ? 0xc8915f : type === "stone" ? 0xc4d0d5 : 0xb7a4e4, 12);
    }
    const key = this.placementKey(id, col, row);
    this.placed.set(key, { ownerId: id, col, row, type, image });
  }

  private removeBlock(key: string): void {
    const block = this.placed.get(key);
    if (!block) return;
    this.emitBlockParticles(block.image.x, block.image.y, block.type === "dirt" ? 0xc8915f : block.type === "stone" ? 0xc4d0d5 : 0xb7a4e4, 22);
    this.tweens.add({
      targets: block.image, scale: 0.12, angle: Phaser.Math.Between(-12, 12), alpha: 0, duration: 240,
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
      const size = Phaser.Math.Between(4, 8);
      const particle = this.add.rectangle(x, y, size, size, color, 1).setDepth(10);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-42, 42),
        y: y + Phaser.Math.Between(12, 64),
        angle: Phaser.Math.Between(-150, 150),
        alpha: 0,
        duration: Phaser.Math.Between(600, 950),
        ease: "Cubic.easeOut",
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
    this.playerHud.update(this.activeBuilder);
    const types: TileType[] = ["dirt", "stone", "obsidian"];
    const centers: Record<PlayerId, number[]> = { 1: [168, 350, 532], 2: [1068, 1250, 1432] };
    for (const id of [1, 2] as PlayerId[]) {
      const player = playerById(id);
      const enabledAlpha = id === this.activeBuilder ? 1 : 0.38;
      for (const button of this.tileButtons[id]) {
        button.panel.setAlpha(enabledAlpha);
        button.icon.setAlpha(enabledAlpha);
        button.label.setAlpha(enabledAlpha);
        button.count.setAlpha(enabledAlpha);
      }
      types.forEach((type, index) => {
        this.inventoryLabels[id][type]?.setText(`${player.inventory[type]}`);
        if (id === this.activeBuilder && gameState.selectedTile === type) {
          this.hudGraphics.lineStyle(4, id === 1 ? 0x58c8ff : 0xff7777, 1)
            .strokeRoundedRect(centers[id][index] - 81, 794, 162, 74, 8);
        }
      });
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
    if (this.activeBuilder === 1) {
      this.activeBuilder = 2;
      this.elapsed = 0;
      this.timeLeft = BUILD_SECONDS;
      this.undoStack = [];
      gameState.selectedTile = "dirt";
      this.timerText.setText(formatTime(this.timeLeft));
      this.builderText.setText("PLAYER 2  •  BUILD YOUR DEFENSE").setColor("#ffd0d0");
      this.readyText.setText("P2 READY").setFontSize(20);
      this.selectionText.setText("PLAYER 1 WALL COMPLETE  •  PLAYER 2, BUILD YOUR DEFENSE");
      this.drawTimerBar();
      this.updateHud();
      this.focusCameraOnBuilder(true);
      return;
    }
    this.transitioning = true;
    this.scene.start("BattleScene");
  }

  private placementKey(id: PlayerId, col: number, row: number): string {
    return `${id}:${col},${row}`;
  }
}
