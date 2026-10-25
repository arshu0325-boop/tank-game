import Phaser from "phaser";
import { addBlockImage, GAME_HEIGHT, GAME_WIDTH, MINE_COLS, MINE_ROWS, TILE_SIZE, formatTime } from "../grid";
import { gameState, MAX_FUEL, playerById, type PlayerId, type TileType } from "../state";
import { PlayerStatusHud } from "../ui/PlayerStatusHud";

interface MineCell {
  col: number;
  row: number;
  type: TileType;
  ore?: "iron" | "coal";
  hp: number;
  maxHp: number;
  image: Phaser.GameObjects.Image;
  crack?: Phaser.GameObjects.Graphics;
}


const MINE_ORIGIN_Y = 250;
const MINE_SECONDS = 23;
const MINE_MOVE_SPEED = 185;
const MINE_FUEL_PER_PIXEL = 0.04;
const DRILL_MOUNT_X = 30;
const DRILL_WIDTH = 72;
const DRILL_CENTER_Y = -16;
const DRILL_ANGLE = 0;
const DRILL_TIP_LENGTH = 70;
const DRILL_ANGLE_RADIANS = Phaser.Math.DegToRad(DRILL_ANGLE);
const DRILL_TIP_X = DRILL_MOUNT_X + Math.cos(DRILL_ANGLE_RADIANS) * DRILL_TIP_LENGTH;
const DRILL_TIP_Y = DRILL_CENTER_Y + Math.sin(DRILL_ANGLE_RADIANS) * DRILL_TIP_LENGTH;
const MINE_CAMERA_ZOOM = 1.45;
const TANK_HULL_HALF_WIDTH = 48;
const TANK_HULL_HEIGHT = 54;

export class MineScene extends Phaser.Scene {
  private cells = new Map<string, MineCell>();
  private elapsed = 0;
  private timeLeft = MINE_SECONDS;
  private transitioning = false;
  private playerHud!: PlayerStatusHud;
  private surfaceGraphics!: Phaser.GameObjects.Graphics;
  private timerGraphics!: Phaser.GameObjects.Graphics;
  private resourcePanelGraphics!: Phaser.GameObjects.Graphics;
  private timeText!: Phaser.GameObjects.Text;
  private resourceLabels: Record<PlayerId, Partial<Record<TileType | "iron", Phaser.GameObjects.Text>>> = { 1: {}, 2: {} };
  private hintText!: Phaser.GameObjects.Text;
  private tanks!: Record<PlayerId, Phaser.GameObjects.Image>;
  private drills!: Record<PlayerId, Phaser.GameObjects.Image>;
  private surfaceRows: number[] = [];
  private facing: Record<PlayerId, -1 | 1> = { 1: 1, 2: -1 };
  private fallVelocity: Record<PlayerId, number> = { 1: 0, 2: 0 };
  private mineCooldown: Record<PlayerId, number> = { 1: 0, 2: 0 };
  private keys!: {
    p1Left: Phaser.Input.Keyboard.Key;
    p1Right: Phaser.Input.Keyboard.Key;
    p1Up: Phaser.Input.Keyboard.Key;
    p1Down: Phaser.Input.Keyboard.Key;
    p2Left: Phaser.Input.Keyboard.Key;
    p2Right: Phaser.Input.Keyboard.Key;
    p2Up: Phaser.Input.Keyboard.Key;
    p2Down: Phaser.Input.Keyboard.Key;
    p1Mine: Phaser.Input.Keyboard.Key;
    p2Mine: Phaser.Input.Keyboard.Key;
  };
  private getBlockHp(type: TileType): number {
    switch (type) {
      case "dirt": return 2;
      case "stone": return 4;
      case "obsidian": return 10;
      default: return 1;
    }
  }
  
  constructor() {
    super("MineScene");
  }

  create(): void {
    this.elapsed = 0;
    this.timeLeft = MINE_SECONDS;
    this.transitioning = false;
    this.cells.clear();
    this.facing = { 1: 1, 2: -1 };
    this.fallVelocity = { 1: 0, 2: 0 };

    const background = gameState.nightMode ? "phase-night-background" : "phase-day-background";
    for (const x of [400, 1200]) {
      this.add.image(x, GAME_HEIGHT / 2, background).setDisplaySize(800, GAME_HEIGHT).setDepth(-10);
    }
    this.createWorld();
    if (gameState.nightMode) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a1550, 0.16).setDepth(7.5);
    }
    this.createHud();
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        p1Left: Phaser.Input.Keyboard.KeyCodes.A,
        p1Right: Phaser.Input.Keyboard.KeyCodes.D,
        p1Up: Phaser.Input.Keyboard.KeyCodes.W,
        p1Down: Phaser.Input.Keyboard.KeyCodes.S,
        p2Left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        p2Right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        p2Up: Phaser.Input.Keyboard.KeyCodes.UP,
        p2Down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        p1Mine: Phaser.Input.Keyboard.KeyCodes.F,
        p2Mine: Phaser.Input.Keyboard.KeyCodes.ENTER,
      }) as typeof this.keys;
    }
    this.hintText = this.add.text(GAME_WIDTH / 2, 210,
      "P1 DRIVE  A / D  •  P2  ← / →     |     CLIMB  W / ↑     |     SIDE DRILL  F / ENTER     |     DOWN  S / ↓", {
        fontFamily: "Arial Black, Arial, sans-serif", fontSize: "15px", color: "#fff4cf",
        stroke: "#27313b", strokeThickness: 5, align: "center",
      }).setOrigin(0.5).setDepth(21);
    this.updateHud();
    this.setupMiningCameras();
  }

  private setupMiningCameras(): void {
    const halfWidth = GAME_WIDTH / 2;
    const p1Camera = this.cameras.main;
    p1Camera.setViewport(0, 0, halfWidth, GAME_HEIGHT)
      .setBounds(0, 0, halfWidth, GAME_HEIGHT)
      .setZoom(MINE_CAMERA_ZOOM)
      .startFollow(this.tanks[1], true, 0.12, 0.12);

    const p2Camera = this.cameras.add(halfWidth, 0, halfWidth, GAME_HEIGHT);
    p2Camera.setBounds(halfWidth, 0, halfWidth, GAME_HEIGHT)
      .setZoom(MINE_CAMERA_ZOOM)
      .startFollow(this.tanks[2], true, 0.12, 0.12);

    // Keep the HUD at normal scale above the two zoomed mining views.
    const uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    uiCamera.setZoom(1).setScroll(0, 0);
    const children = this.children.list as Phaser.GameObjects.GameObject[];
    const worldObjects = children.filter((child) => (child as Phaser.GameObjects.GameObject & { depth: number }).depth < 20);
    const interfaceObjects = children.filter((child) => (child as Phaser.GameObjects.GameObject & { depth: number }).depth >= 20);
    p1Camera.ignore(interfaceObjects);
    p2Camera.ignore(interfaceObjects);
    uiCamera.ignore(worldObjects);
  }

  update(_time: number, delta: number): void {
    if (this.transitioning) return;
    this.elapsed += delta / 1000;
    this.timeLeft = Math.max(0, MINE_SECONDS - this.elapsed);
    this.timeText.setText(formatTime(this.timeLeft));
    this.drawMineTimerBar();
    this.updateTankMovement(delta / 1000);
    this.drawDrills();
    this.updateHud();
    if (this.input.keyboard && this.keys) {
      for (const id of [1, 2] as PlayerId[]) {
        this.mineCooldown[id] = Math.max(0, this.mineCooldown[id] - delta / 1000);
        const drillingDown = id === 1 ? this.keys.p1Down.isDown : this.keys.p2Down.isDown;
        const drillingSide = id === 1 ? this.keys.p1Mine.isDown : this.keys.p2Mine.isDown;
        if ((drillingDown || drillingSide) && this.mineCooldown[id] <= 0) {
          if (drillingDown) this.mineAtBelow(id);
          else this.mineAtFront(id);
          this.mineCooldown[id] = 0.28;
        }
      }
    }
    if (this.timeLeft <= 0) {
      this.transitioning = true;
      gameState.players.forEach((player) => { player.fuel = MAX_FUEL; });
      this.scene.start("BuildScene");
    }
  }

  private createWorld(): void {
    this.surfaceRows = [];
    for (let col = 0; col < MINE_COLS; col++) {
      const centerDip = 2.3 * Math.exp(-Math.pow((col - 20) / 5.2, 2));
      const leftRidge = 1.4 * Math.exp(-Math.pow((col - 5) / 3.6, 2));
      const rightRidge = 1.7 * Math.exp(-Math.pow((col - 35) / 4.5, 2));
      const surface = Math.max(2, Math.min(6, 3 + Math.round(
        centerDip - leftRidge - rightRidge + Math.sin(col * 0.31) * 0.55 + Math.sin(col * 0.12) * 0.35,
      )));
      this.surfaceRows.push(surface);
      for (let row = surface; row < MINE_ROWS; row++) {
        let type: TileType;
        let ore: "iron" | "coal" | undefined;
        const depth = row - surface;
        if (depth < 3) {
          type = "dirt";
        } else if ((depth >= 8 && Math.random() < 0.38) || (depth >= 5 && Math.random() < 0.16)) {
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
        const maxHp = this.getBlockHp(type);
        const crack = this.add.graphics().setDepth(6);

        this.cells.set(this.cellKey(col, row), {
          col,
          row,
          type,
          ore,
          hp: maxHp,
          maxHp,
          image,
          crack,
        });
      }
    }

    // The small grass strip makes the top of the underground mine easy to read.
    this.surfaceGraphics = this.add.graphics().setDepth(3);
    this.drawMineSurface();

    const p1X = 160;
    const p2X = 1440;
    const p1Ground = this.tankSupportY(p1X, 1);
    const p2Ground = this.tankSupportY(p2X, 2);
    const p1FacesLeftByDefault = playerById(1).tankTexture === "tank-red";
    const p2FacesLeftByDefault = playerById(2).tankTexture === "tank-red";
    this.tanks = {
      1: this.add.image(p1X, p1Ground, `${playerById(1).tankTexture}-preview`).setOrigin(0.5, 1).setScale(0.95).setFlipX(p1FacesLeftByDefault).setDepth(8),
      2: this.add.image(p2X, p2Ground, `${playerById(2).tankTexture}-preview`).setOrigin(0.5, 1).setScale(0.95).setFlipX(!p2FacesLeftByDefault).setDepth(8),
    };
    this.drills = {
      1: this.add.image(p1X + DRILL_MOUNT_X, p1Ground + DRILL_CENTER_Y, "tank-drill").setOrigin(0, 0.5).setDisplaySize(DRILL_WIDTH, 32).setDepth(9),
      2: this.add.image(p2X - DRILL_MOUNT_X, p2Ground + DRILL_CENTER_Y, "tank-drill").setOrigin(1, 0.5).setDisplaySize(DRILL_WIDTH, 32).setFlipX(true).setDepth(9),
    };
    this.drawDrills();

    // Drill sparks and a subtle center divider make the two mining areas obvious.
    const divider = this.add.graphics().setDepth(12);
    divider.lineStyle(3, 0xf4df9b, 0.7);
    divider.lineBetween(GAME_WIDTH / 2, 280, GAME_WIDTH / 2, GAME_HEIGHT - 58);
    divider.lineStyle(1, 0x18242c, 0.8);
    divider.lineBetween(GAME_WIDTH / 2 + 3, 280, GAME_WIDTH / 2 + 3, GAME_HEIGHT - 58);
  }

  private createHud(): void {
    this.playerHud = new PlayerStatusHud(this, 25);
    this.add.rectangle(GAME_WIDTH / 2, 210, 1250, 42, 0x111b35, 0.82)
      .setStrokeStyle(1, 0xa5c7ff, 0.62).setDepth(20);
    this.add.rectangle(GAME_WIDTH / 2, 42, 420, 62, 0x552b18, 0.94).setStrokeStyle(4, 0xffbe43, 1).setDepth(25);
    this.add.text(GAME_WIDTH / 2, 41, "MINE & CRAFT PHASE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "31px", color: "#fff5e5",
      stroke: "#28180e", strokeThickness: 6,
    }).setOrigin(0.5).setDepth(26);
    this.timeText = this.add.text(GAME_WIDTH / 2, 100, formatTime(MINE_SECONDS), {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "42px", color: "#ffe12f",
      stroke: "#211d0a", strokeThickness: 7,
    }).setOrigin(0.5).setDepth(26);
    this.timerGraphics = this.add.graphics().setDepth(26);
    this.drawMineTimerBar();
    this.tweens.add({ targets: this.timerGraphics, alpha: 0.72, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: this.timeText, scale: 1.045, duration: 720, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.resourcePanelGraphics = this.add.graphics().setDepth(25);
    this.resourcePanelGraphics.fillStyle(0x101b32, 0.96).fillRoundedRect(10, 834, 780, 64, 10);
    this.resourcePanelGraphics.lineStyle(2, playerById(1).color, 0.92).strokeRoundedRect(10, 834, 780, 64, 10);
    this.resourcePanelGraphics.fillStyle(0x101b32, 0.96).fillRoundedRect(810, 834, 780, 64, 10);
    this.resourcePanelGraphics.lineStyle(2, playerById(2).color, 0.92).strokeRoundedRect(810, 834, 780, 64, 10);
    this.resourcePanelGraphics.lineStyle(2, 0xd8e5ed, 0.65).lineBetween(GAME_WIDTH / 2, 838, GAME_WIDTH / 2, 894);
    this.add.text(400, 841, "P1 BLOCKS", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "13px", color: "#9cddff",
      stroke: "#101820", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(27);
    this.add.text(1200, 841, "P2 BLOCKS", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "13px", color: "#ffb9b9",
      stroke: "#101820", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(27);

    const resourceTypes: Array<TileType | "iron"> = ["dirt", "stone", "obsidian", "iron"];
    const centers: Record<PlayerId, number[]> = { 1: [102, 294, 486, 678], 2: [922, 1114, 1306, 1498] };
    for (const id of [1, 2] as PlayerId[]) {
      const player = playerById(id);
      resourceTypes.forEach((type, index) => {
        const x = centers[id][index];
        const fill = id === 1 ? 0x173d58 : 0x512a31;
        this.add.rectangle(x, 873, 174, 48, fill, 1)
          .setStrokeStyle(2, player.color, 0.95).setDepth(26);
        addBlockImage(this, x - 49, 873, type === "iron" ? "stone" : type, {
          size: 38,
          ...(type === "iron" ? { ore: "iron" as const } : {}),
        }).setDepth(27);
        this.add.text(x + 22, 862, type.toUpperCase(), {
          fontFamily: "Arial Black, Arial, sans-serif", fontSize: "10px", color: "#ffffff",
          stroke: "#101820", strokeThickness: 3,
        }).setOrigin(0.5).setDepth(28);
        this.resourceLabels[id][type] = this.add.text(x + 22, 884, "0", {
          fontFamily: "Arial Black, Arial, sans-serif", fontSize: "18px", color: id === 1 ? "#b7eaff" : "#ffd0cc",
          stroke: "#101820", strokeThickness: 4,
        }).setOrigin(0.5).setDepth(28);
      });
    }
  }

  private updateTankMovement(deltaSeconds: number): void {
    if (!this.input.keyboard || !this.keys) return;
    for (const id of [1, 2] as PlayerId[]) {
      const player = playerById(id);
      const tank = this.tanks[id];
      const left = id === 1 ? this.keys.p1Left.isDown : this.keys.p2Left.isDown;
      const right = id === 1 ? this.keys.p1Right.isDown : this.keys.p2Right.isDown;
      const climb = id === 1 ? this.keys.p1Up.isDown : this.keys.p2Up.isDown;
      const direction = Number(right) - Number(left);
      const safeDelta = Math.min(deltaSeconds, 0.05);
      if (direction !== 0) {
        this.facing[id] = direction as -1 | 1;
        const textureFacesLeft = player.tankTexture === "tank-red";
        tank.setFlipX((direction < 0) !== textureFacesLeft);
        if (player.fuel > 0) {
          const edge = tank.displayWidth / 2 + 4;
          const minX = id === 1 ? edge : GAME_WIDTH / 2 + edge;
          const maxX = id === 1 ? GAME_WIDTH / 2 - edge : GAME_WIDTH - edge;
          const desiredMove = direction * MINE_MOVE_SPEED * safeDelta;
          const fuelMove = player.fuel / MINE_FUEL_PER_PIXEL;
          const move = Math.sign(desiredMove) * Math.min(Math.abs(desiredMove), fuelMove);
          const nextX = Phaser.Math.Clamp(tank.x + move, minX, maxX);
          const currentSupportY = this.tankSupportY(tank.x, id, tank.y);
          const nextSupportY = this.tankSupportY(nextX, id, tank.y);
          const steppingUp = nextSupportY < currentSupportY - 3;
          if (!steppingUp || climb) {
            const nextY = steppingUp ? nextSupportY : tank.y;
            if (!this.tankOverlapsMineBlock(nextX, nextY, id)) {
              const distanceMoved = Math.abs(nextX - tank.x);
              tank.x = nextX;
              tank.y = nextY;
              player.fuel = Math.max(0, player.fuel - distanceMoved * MINE_FUEL_PER_PIXEL);
            }
          }
        }
      }

      const supportY = this.tankSupportY(tank.x, id, tank.y);
      if (tank.y < supportY) {
        this.fallVelocity[id] += 1500 * safeDelta;
        const nextY = Math.min(supportY, tank.y + this.fallVelocity[id] * safeDelta);
        if (this.tankOverlapsMineBlock(tank.x, nextY, id)) {
          this.fallVelocity[id] = 0;
        } else {
          tank.y = nextY;
          if (tank.y >= supportY) this.fallVelocity[id] = 0;
        }
      } else if (tank.y > supportY) {
        this.fallVelocity[id] = 0;
        if (climb) {
          const nextY = Math.max(supportY, tank.y - 115 * safeDelta);
          if (!this.tankOverlapsMineBlock(tank.x, nextY, id)) tank.y = nextY;
        }
      } else {
        this.fallVelocity[id] = 0;
      }
    }
  }

  private tankOverlapsMineBlock(x: number, y: number, id: PlayerId): boolean {
    // Use the tank hull rather than its transparent sprite margins. Leave a
    // small track gap so a block used as the ground is not treated as a wall.
    const left = x - TANK_HULL_HALF_WIDTH;
    const right = x + TANK_HULL_HALF_WIDTH;
    const top = y - TANK_HULL_HEIGHT;
    const bottom = y - 8;
    const firstColumn = id === 1 ? 0 : MINE_COLS / 2;
    const lastColumn = id === 1 ? MINE_COLS / 2 - 1 : MINE_COLS - 1;
    const minCol = Phaser.Math.Clamp(Math.floor(left / TILE_SIZE), firstColumn, lastColumn);
    const maxCol = Phaser.Math.Clamp(Math.floor((right - 0.01) / TILE_SIZE), firstColumn, lastColumn);
    const minRow = Phaser.Math.Clamp(Math.floor((top - MINE_ORIGIN_Y) / TILE_SIZE), 0, MINE_ROWS - 1);
    const maxRow = Phaser.Math.Clamp(Math.floor((bottom - 0.01 - MINE_ORIGIN_Y) / TILE_SIZE), 0, MINE_ROWS - 1);
    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        if (this.cells.has(this.cellKey(col, row))) return true;
      }
    }
    return false;
  }

  private tankSupportY(x: number, id: PlayerId, currentY?: number): number {
    const firstColumn = id === 1 ? 0 : MINE_COLS / 2;
    const lastColumn = id === 1 ? MINE_COLS / 2 - 1 : MINE_COLS - 1;
    const leftColumn = Math.max(firstColumn, Math.floor((x - 52) / TILE_SIZE));
    const rightColumn = Math.min(lastColumn, Math.floor((x + 52) / TILE_SIZE));
    let highestSupportRow = MINE_ROWS;
    for (let col = leftColumn; col <= rightColumn; col++) {
      for (let row = 0; row < MINE_ROWS; row++) {
        if (this.cells.has(this.cellKey(col, row))) {
          const blockSupportY = MINE_ORIGIN_Y + row * TILE_SIZE + 7;
          // Ignore blocks overhead while the tank is already in an excavated
          // tunnel. They are a ceiling, not the surface supporting the tracks.
          if (currentY !== undefined && blockSupportY < currentY - 8) continue;
          highestSupportRow = Math.min(highestSupportRow, row);
          break;
        }
      }
    }
    return MINE_ORIGIN_Y + highestSupportRow * TILE_SIZE + 7;
  }

  private drawMineSurface(): void {
    if (!this.surfaceGraphics) return;
    this.surfaceGraphics.clear();
    const grass = gameState.nightMode ? 0x37683b : 0x4d962f;
    const highlight = gameState.nightMode ? 0x87c954 : 0x8bd64a;
    for (let col = 0; col < MINE_COLS; col++) {
      const originalTopRow = this.surfaceRows[col];
      if (!this.cells.has(this.cellKey(col, originalTopRow))) continue;
      const y = MINE_ORIGIN_Y + originalTopRow * TILE_SIZE;
      this.surfaceGraphics.fillStyle(grass, 1).fillRect(col * TILE_SIZE, y - 5, TILE_SIZE, 5);
      this.surfaceGraphics.fillStyle(highlight, 1).fillRect(col * TILE_SIZE, y - 5, TILE_SIZE, 2);
    }
  }

  private drawDrills(): void {
    if (!this.drills || !this.tanks) return;
    for (const id of [1, 2] as PlayerId[]) {
      const tank = this.tanks[id];
      const dir = this.facing[id];
      const drillingDown = id === 1 ? this.keys?.p1Down.isDown : this.keys?.p2Down.isDown;
      const drillingSide = id === 1 ? this.keys?.p1Mine.isDown : this.keys?.p2Mine.isDown;
      const drill = this.drills[id];
      const vibration = drillingDown || drillingSide ? Math.sin(this.elapsed * 42) * 2 : 0;
      if (drillingDown) {
        drill.setOrigin(0.5, 0.5);
        drill.setFlipX(false);
        drill.setPosition(tank.x, tank.y + 14 + vibration);
        drill.setAngle(90);
      } else {
        drill.setOrigin(dir === 1 ? 0 : 1, 0.5);
        drill.setFlipX(dir === -1);
        drill.setPosition(tank.x + dir * (DRILL_MOUNT_X + vibration), tank.y + DRILL_CENTER_Y);
        drill.setAngle(dir * DRILL_ANGLE);
      }
    }
  }

  private mineAtFront(id: PlayerId): void {
    if (this.transitioning) return;
    const tank = this.tanks[id];
    const dir = this.facing[id];
    const tipX = tank.x + dir * DRILL_TIP_X;
    const tipY = tank.y + DRILL_TIP_Y;
    if (tipX < 0 || tipX >= GAME_WIDTH || tipY < MINE_ORIGIN_Y || tipY >= MINE_ORIGIN_Y + MINE_ROWS * TILE_SIZE) return;

    // Sample the drill from its mount toward its nose and mine the first block
    // its body touches. Using only the nose skipped a neighboring block when
    // the shaft contacted it before the pointed tip reached the next tile.
    const firstColumn = id === 1 ? 0 : MINE_COLS / 2;
    const lastColumn = id === 1 ? MINE_COLS / 2 - 1 : MINE_COLS - 1;
    const anchorX = tank.x + dir * DRILL_MOUNT_X;
    const anchorY = tank.y + DRILL_CENTER_Y;
    const alongX = dir * Math.cos(DRILL_ANGLE_RADIANS);
    const alongY = Math.sin(DRILL_ANGLE_RADIANS);
    const normalX = -Math.sin(DRILL_ANGLE_RADIANS);
    const normalY = dir * Math.cos(DRILL_ANGLE_RADIANS);
    const firstOutsideHull = Math.max(0, TANK_HULL_HALF_WIDTH - DRILL_MOUNT_X + 4);
    for (let along = firstOutsideHull; along <= DRILL_TIP_LENGTH; along += 4) {
      for (const across of [0, -8, 10 * dir]) {
        const sampleX = anchorX + alongX * along + normalX * across;
        const sampleY = anchorY + alongY * along + normalY * across;
        const col = Math.floor((sampleX - dir * 0.01) / TILE_SIZE);
        const row = Math.floor((sampleY - MINE_ORIGIN_Y) / TILE_SIZE);
        if (col < firstColumn || col > lastColumn || row < 0 || row >= MINE_ROWS) continue;
        const target = this.cells.get(this.cellKey(col, row));
        if (!target) continue;
        this.damageMineCell(id, target);
        return;
      }
    }
  }

  private mineAtBelow(id: PlayerId): void {
    if (this.transitioning) return;
    const tank = this.tanks[id];
    const firstColumn = id === 1 ? 0 : MINE_COLS / 2;
    const lastColumn = id === 1 ? MINE_COLS / 2 - 1 : MINE_COLS - 1;
    const leftColumn = Phaser.Math.Clamp(Math.floor((tank.x - TANK_HULL_HALF_WIDTH) / TILE_SIZE), firstColumn, lastColumn);
    const rightColumn = Phaser.Math.Clamp(Math.floor((tank.x + TANK_HULL_HALF_WIDTH) / TILE_SIZE), firstColumn, lastColumn);
    const firstRow = Phaser.Math.Clamp(Math.floor((tank.y - MINE_ORIGIN_Y - 7) / TILE_SIZE), 0, MINE_ROWS - 1);
    let target: MineCell | undefined;
    // Clear the blocks under the tracks from nearest to farthest. This makes
    // a hole wide enough for the tank to drop through instead of tunneling a
    // narrow shaft while the neighboring blocks keep it perched above.
    for (let row = firstRow; row < MINE_ROWS && !target; row++) {
      const candidates: MineCell[] = [];
      for (let col = leftColumn; col <= rightColumn; col++) {
        const cell = this.cells.get(this.cellKey(col, row));
        if (cell) candidates.push(cell);
      }
      target = candidates.sort((a, b) =>
        Math.abs(a.col * TILE_SIZE + TILE_SIZE / 2 - tank.x) - Math.abs(b.col * TILE_SIZE + TILE_SIZE / 2 - tank.x),
      )[0];
    }
    if (!target) return;
    this.damageMineCell(id, target);
  }

  private damageMineCell(id: PlayerId, target: MineCell): void {

    const x = target.col * TILE_SIZE + TILE_SIZE / 2;
    const y = MINE_ORIGIN_Y + target.row * TILE_SIZE + TILE_SIZE / 2;
    target.hp--;
    target.image.setAlpha(0.55 + 0.45 * target.hp / target.maxHp);
    this.drawMiningCracks(target);
    this.emitBlockParticles(x, y, target.type === "dirt" ? 0xb7794c : target.type === "stone" ? 0x9ca4a7 : 0x9c82c2, 9);
    this.tweens.add({ targets: target.image, angle: { from: -5, to: 5 }, yoyo: true, duration: 70, repeat: 1 });
    if (target.hp > 0) {
      this.showMiningMessage(x, y - 12, `${target.hp} HP`, id === 1 ? "#73d8ff" : "#ff9a8c");
      return;
    }

    const player = playerById(id);
    player.inventory[target.type] += 1;
    if (target.ore === "iron") player.iron += 1;
    this.emitBlockParticles(x, y, target.ore === "iron" ? 0xffd05b : 0xd3a06e, 26);
    this.tweens.add({
      targets: target.image, scale: 0.12, angle: Phaser.Math.Between(-12, 12), alpha: 0, duration: 240,
      onComplete: () => target.image.destroy(),
    });
    target.crack?.destroy();
    this.cells.delete(this.cellKey(target.col, target.row));
    this.drawMineSurface();
    const itemLabel = target.ore === "iron" ? `+1 ${target.type}  +1 iron` : `+1 ${target.type}`;
    this.showMiningMessage(x, y - 10, itemLabel, id === 1 ? "#73d8ff" : "#ff9a8c");
  }

  private emitBlockParticles(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const size = Phaser.Math.Between(4, 8);
      const particle = this.add.rectangle(x, y, size, size, color, 1).setDepth(10);
      const drift = Phaser.Math.Between(-48, 48);
      this.tweens.add({
        targets: particle,
        x: x + drift,
        y: y + Phaser.Math.Between(18, 78),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(600, 1000),
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private updateHud(): void {
    this.playerHud.update();
    for (const id of [1, 2] as PlayerId[]) {
      const player = playerById(id);
      for (const type of ["dirt", "stone", "obsidian"] as TileType[]) {
        this.resourceLabels[id][type]?.setText(`${player.inventory[type]}`);
      }
      this.resourceLabels[id].iron?.setText(`${player.iron}`);
    }
  }

  private drawMineTimerBar(): void {
    if (!this.timerGraphics) return;
    const x = GAME_WIDTH / 2 - 160;
    const y = 126;
    const width = 320;
    const fill = width * Phaser.Math.Clamp(this.timeLeft / MINE_SECONDS, 0, 1);
    const timerColor = this.timeLeft <= 5 ? 0xff5962 : 0xffd34f;
    this.timerGraphics.clear();
    if (fill > 0) this.timerGraphics.fillStyle(timerColor, 0.3).fillRoundedRect(x - 4, y - 4, fill + 8, 20, 7);
    this.timerGraphics.fillStyle(0x15212a, 0.98).fillRoundedRect(x, y, width, 12, 5);
    this.timerGraphics.fillStyle(timerColor, 1).fillRoundedRect(x + 2, y + 2, Math.max(0, fill - 4), 8, 3);
    this.timerGraphics.lineStyle(1, this.timeLeft <= 5 ? 0xffc0c0 : 0xffef9a, 0.95).strokeRoundedRect(x, y, width, 12, 5);
  }
  private drawMiningCracks(cell: MineCell): void {
  if (!cell.crack) return;

  const crack = cell.crack;
  crack.clear();

  if (cell.hp >= cell.maxHp) {
    return;
  }

  const damageRatio =
    1 - cell.hp / cell.maxHp;

  const x =
    cell.col * TILE_SIZE;

  const y =
    MINE_ORIGIN_Y +
    cell.row * TILE_SIZE;

  crack.lineStyle(
    3,
    0x151515,
    0.9
  );

  // Main crack
  crack.beginPath();
  crack.moveTo(
    x + TILE_SIZE * 0.25,
    y + TILE_SIZE * 0.15
  );
  crack.lineTo(
    x + TILE_SIZE * 0.45,
    y + TILE_SIZE * 0.42
  );
  crack.lineTo(
    x + TILE_SIZE * 0.35,
    y + TILE_SIZE * 0.70
  );
  crack.lineTo(
    x + TILE_SIZE * 0.60,
    y + TILE_SIZE * 0.90
  );
  crack.strokePath();

  // Second crack for heavier damage
  if (damageRatio >= 0.5) {
    crack.beginPath();
    crack.moveTo(
      x + TILE_SIZE * 0.65,
      y + TILE_SIZE * 0.15
    );
    crack.lineTo(
      x + TILE_SIZE * 0.55,
      y + TILE_SIZE * 0.40
    );
    crack.lineTo(
      x + TILE_SIZE * 0.75,
      y + TILE_SIZE * 0.62
    );
    crack.strokePath();
  }

  // Third crack when almost broken
  if (damageRatio >= 0.75) {
    crack.beginPath();
    crack.moveTo(
      x + TILE_SIZE * 0.15,
      y + TILE_SIZE * 0.55
    );
    crack.lineTo(
      x + TILE_SIZE * 0.40,
      y + TILE_SIZE * 0.50
    );
    crack.lineTo(
      x + TILE_SIZE * 0.80,
      y + TILE_SIZE * 0.80
    );
    crack.strokePath();
  }
}
  private showMiningMessage(
  x: number,
  y: number,
  message: string,
  color: string
): void {
  const pop = this.add.text(
    x,
    y - 5,
    message,
    {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "16px",
      color,
      stroke: "#374047",
      strokeThickness: 4,
    }
  )
    .setOrigin(0.5)
    .setDepth(35);

  this.tweens.add({
    targets: pop,
    y: pop.y - 28,
    alpha: 0,
    duration: 500,
    onComplete: () => pop.destroy(),
  });
}

  private cellKey(col: number, row: number): string {
    return `${col},${row}`;
  }
}
