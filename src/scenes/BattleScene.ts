import Phaser from "phaser";
import {
  BLOCK_HP, BATTLE_WORLD_WIDTH, BUILD_COLS, BUILD_ORIGIN_X, BUILD_ROWS, GAME_HEIGHT, GAME_WIDTH, TANK_X,
  TILE_SIZE, addBlockImage, baseTerrainY, clamp, distance, drawSky,
} from "../grid";
import { gameState, MAX_HP, otherPlayerId, playerById, type PlayerId, type TileType, type WeaponType } from "../state";

const TERRAIN_STEP = 8;
const BATTLE_P1_X = 445;
const BATTLE_P2_X = 1755;
const BATTLE_P1_BUILD_OFFSET = BATTLE_P1_X - TANK_X[1];
const BATTLE_P2_BUILD_OFFSET = BATTLE_P2_X - TANK_X[2];
const BATTLE_BASE_ZOOM = 1.1;
const BATTLE_CAMERA_START_X = (BATTLE_WORLD_WIDTH - GAME_WIDTH / BATTLE_BASE_ZOOM) / 2;
// Tank movement settings. Fuel is charged by actual distance moved.
const TANK_MOVE_SPEED = 190; // pixels per second
const TANK_FUEL_PER_PIXEL = 0.04; // 4 fuel per 100 pixels
const WEAPONS: Record<WeaponType, { label: string; damage: number; radius: number; speed: number; gravity: number; color: number }> = {
  shell: { label: "TANK SHOT", damage: 1, radius: 23, speed: 660, gravity: 520, color: 0xffefb0 },
  missile: { label: "MISSILE", damage: 10, radius: 72, speed: 520, gravity: 390, color: 0xff9a38 },
  boomerang: { label: "BOOMERANG", damage: 2, radius: 31, speed: 700, gravity: 205, color: 0x74f2ff },
};

interface BattleBlock {
  ownerId: PlayerId;
  col: number;
  row: number;
  type: TileType;
  hp: number;
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

interface ProjectileState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ownerId: PlayerId;
  weapon: WeaponType;
  damage: number;
  radius: number;
  gravity: number;
  returning: boolean;
  image: Phaser.GameObjects.Image;
  glowImage: Phaser.GameObjects.Image | null;
  trailClock: number;
}

interface WeaponButtonVisual {
  background: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  title: Phaser.GameObjects.Text;
  chargeText?: Phaser.GameObjects.Text;
  chargeBar?: Phaser.GameObjects.Graphics;
}

export class BattleScene extends Phaser.Scene {
  private terrain: number[] = [];
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private aimGraphics!: Phaser.GameObjects.Graphics;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private blocks: BattleBlock[] = [];
  private tanks!: Record<PlayerId, Phaser.GameObjects.Image>;
  private tankGlows?: Record<PlayerId, Phaser.GameObjects.Image>;
  private activeProjectile: ProjectileState | null = null;
  private power = 0.88;
  private fireMessage = "Aim with your mouse, then click to fire.";
  private turnText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private p1Text!: Phaser.GameObjects.Text;
  private p2Text!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private displayedCharge: Record<PlayerId, { missile: number; boomerang: number }> = {
    1: { missile: 0, boomerang: 0 },
    2: { missile: 0, boomerang: 0 },
  };
  private weaponButtons: Partial<Record<WeaponType, WeaponButtonVisual>> = {};
  private weaponButtonReady: Record<WeaponType, boolean> = { shell: true, missile: false, boomerang: false };

  // Point at the battlefield to aim, then release to fire.
  private isAiming = false;
  private aimPointerId: number | null = null;
  private currentAimAngle = -0.55;
  private chargeBonus = 0;
  private readonly maxChargeBonus = 0.35;
  private readonly chargeRate = 0.22; // extra power per second while holding
  private keys!: {
    one: Phaser.Input.Keyboard.Key;
    two: Phaser.Input.Keyboard.Key;
    three: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    p1Left: Phaser.Input.Keyboard.Key;
    p1Right: Phaser.Input.Keyboard.Key;
    p2Left: Phaser.Input.Keyboard.Key;
    p2Right: Phaser.Input.Keyboard.Key;
  };
  private resolving = false;

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.blocks = [];
    this.activeProjectile = null;
    this.tankGlows = undefined;
    this.resolving = false;
    this.fireMessage = "";
    this.isAiming = false;
    this.aimPointerId = null;
    this.chargeBonus = 0;
    const camera = this.cameras.main;
    camera.setBounds(0, 0, BATTLE_WORLD_WIDTH, GAME_HEIGHT);
    camera.setScroll(BATTLE_CAMERA_START_X, 0);
    camera.setZoom(BATTLE_BASE_ZOOM);

    gameState.selectedWeapon = "shell";
    gameState.round = 1;
    for (const id of [1, 2] as PlayerId[]) {
      this.displayedCharge[id] = { ...playerById(id).charge };
    }
    drawSky(this, false, BATTLE_WORLD_WIDTH);
    this.drawArenaGrid();
    this.createTerrain();
    this.drawTerrain();
    this.tanks = {
      1: this.add.image(BATTLE_P1_X, this.terrainAt(BATTLE_P1_X), playerById(1).tankTexture).setOrigin(0.5, 1).setDepth(7),
      2: this.add.image(BATTLE_P2_X, this.terrainAt(BATTLE_P2_X), playerById(2).tankTexture).setOrigin(0.5, 1).setFlipX(true).setDepth(7),
    };
    this.createBattleBlocks();
    if (gameState.nightMode) {
      this.add.rectangle(BATTLE_WORLD_WIDTH / 2, GAME_HEIGHT / 2, BATTLE_WORLD_WIDTH, GAME_HEIGHT, 0x09134c, 0.48).setDepth(14);
      this.tankGlows = {
        1: this.makeTankGlow(1, 0x28c5ff),
        2: this.makeTankGlow(2, 0xff5968),
      };
    }
    this.aimGraphics = this.add.graphics().setDepth(15);
    this.createHud();
    for (const child of this.children.list as unknown as Array<Phaser.GameObjects.GameObject & { depth: number; setScrollFactor(x: number, y?: number): unknown }>) {
      if (child.depth >= 25) child.setScrollFactor(0);
    }
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        one: Phaser.Input.Keyboard.KeyCodes.ONE,
        two: Phaser.Input.Keyboard.KeyCodes.TWO,
        three: Phaser.Input.Keyboard.KeyCodes.THREE,
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE,
        // Player 1 moves with A/D; Player 2 moves with Left/Right.
        p1Left: Phaser.Input.Keyboard.KeyCodes.A,
        p1Right: Phaser.Input.Keyboard.KeyCodes.D,
        p2Left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        p2Right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      }) as typeof this.keys;
    }
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    if (this.input.keyboard && this.keys) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.one)) this.selectWeapon("shell");
      if (Phaser.Input.Keyboard.JustDown(this.keys.two)) this.selectWeapon("missile");
      if (Phaser.Input.Keyboard.JustDown(this.keys.three)) this.selectWeapon("boomerang");
      if (Phaser.Input.Keyboard.JustDown(this.keys.up)) this.power = clamp(this.power + 0.06, 0.5, 1.2);
      if (Phaser.Input.Keyboard.JustDown(this.keys.down)) this.power = clamp(this.power - 0.06, 0.5, 1.2);
      if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
        if (this.isAiming) this.fireWeapon(undefined, undefined, this.currentAimAngle, this.effectivePower());
        else this.fireWeapon();
        this.cancelAim();
      }
    }

    // Movement is allowed only when no projectile is in flight and the impact
    // animation is not resolving. Only the player whose turn it is can move.
    if (this.input.keyboard && this.keys && !this.activeProjectile && !this.resolving && !this.isAiming) {
      this.updateTankMovement(delta / 1000);
    }

    this.tanks[1].y = this.terrainAt(this.tanks[1].x);
    this.tanks[2].y = this.terrainAt(this.tanks[2].x);
    this.syncTankGlows();
    if (!this.activeProjectile && !this.resolving && !this.isAiming) {
      this.cameras.main.scrollX = this.battleCameraScrollX();
    }
    if (this.isAiming && this.aimPointerId !== null) {
      const pointer = this.input.pointer1.id === this.aimPointerId
        ? this.input.pointer1
        : this.input.activePointer;
      this.currentAimAngle = this.aimAngle(gameState.currentPlayer, pointer.worldX, pointer.worldY);
      this.chargeBonus = Math.min(this.maxChargeBonus, this.chargeBonus + this.chargeRate * delta / 1000);
    } else if (!this.activeProjectile) {
      const pointer = this.input.activePointer;
      this.currentAimAngle = this.aimAngle(gameState.currentPlayer, pointer.worldX, pointer.worldY);
    }

    if (this.activeProjectile) this.updateProjectile(delta / 1000);
    else if (this.isAiming) this.drawTrajectoryPreview();
    else this.drawAimGuide();
    this.timerText.setText(`ROUND ${gameState.round}`);
    this.powerText.setText(`POWER  ${Math.round(this.effectivePower() * 100)}%`);
    this.weaponText.setText(this.weaponStatusText());
    this.updateHud(delta / 1000);
  }

  private updateTankMovement(deltaSeconds: number): void {
    const id = gameState.currentPlayer;
    const player = playerById(id);
    const tank = this.tanks[id];

    const movingLeft = id === 1 ? this.keys.p1Left.isDown : this.keys.p2Left.isDown;
    const movingRight = id === 1 ? this.keys.p1Right.isDown : this.keys.p2Right.isDown;
    const direction = Number(movingRight) - Number(movingLeft);
    if (direction === 0 || player.fuel <= 0) return;

    // Clamp the tank to its own half of the battlefield and keep it fully on screen.
    const halfTankWidth = tank.displayWidth / 2;
    const minX = id === 1 ? halfTankWidth : BATTLE_WORLD_WIDTH / 2 + halfTankWidth;
    const maxX = id === 1 ? BATTLE_WORLD_WIDTH / 2 - halfTankWidth : BATTLE_WORLD_WIDTH - halfTankWidth;

    // Cap large frame times so the tank does not jump after a brief tab switch.
    const safeDelta = Math.min(deltaSeconds, 0.05);
    const requestedX = tank.x + direction * TANK_MOVE_SPEED * safeDelta;
    let nextX = clamp(requestedX, minX, maxX);
    let distanceMoved = nextX - tank.x;

    // Do not let the final movement step spend more fuel than the player has.
    const maxDistanceFromFuel = player.fuel / TANK_FUEL_PER_PIXEL;
    if (Math.abs(distanceMoved) > maxDistanceFromFuel) {
      distanceMoved = Math.sign(distanceMoved) * maxDistanceFromFuel;
      nextX = tank.x + distanceMoved;
    }
    if (Math.abs(distanceMoved) < 0.001) return;

    const fuelShownBefore = Math.ceil(player.fuel);
    tank.x = nextX;
    player.fuel = Math.max(0, player.fuel - Math.abs(distanceMoved) * TANK_FUEL_PER_PIXEL);

    // Refresh the fuel bar and label once per whole fuel unit, not on every frame.
    if (Math.ceil(player.fuel) !== fuelShownBefore) {
      this.fireMessage = `P${id} moving — ${Math.ceil(player.fuel)} fuel remaining.`;
      this.updateHud();
    }
  }

  private createTerrain(): void {
    this.terrain = [];
    for (let x = 0; x <= BATTLE_WORLD_WIDTH; x += TERRAIN_STEP) this.terrain.push(baseTerrainY(x, BATTLE_WORLD_WIDTH));
    this.terrainGraphics = this.add.graphics().setDepth(2);
  }

  private makeTankGlow(id: PlayerId, color: number): Phaser.GameObjects.Image {
    const tank = this.tanks[id];
    const glow = this.add.image(tank.x, tank.y - 30, "night-halo")
      .setTint(color)
      .setDisplaySize(200, 108)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.22)
      .setDepth(14.5);
    this.tweens.add({ targets: glow, alpha: 0.12, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    return glow;
  }

  private syncTankGlows(): void {
    if (!this.tankGlows) return;
    for (const id of [1, 2] as PlayerId[]) {
      this.tankGlows[id].setPosition(this.tanks[id].x, this.tanks[id].y - 30);
    }
  }

  private drawTerrain(): void {
    const g = this.terrainGraphics;
    g.clear();
    const drawLayer = (offset: number, color: number): void => {
      g.fillStyle(color, 1);
      g.beginPath();
      for (let i = 0; i < this.terrain.length; i++) {
        const x = i * TERRAIN_STEP;
        const y = Math.min(GAME_HEIGHT, this.terrain[i] + offset);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.lineTo(BATTLE_WORLD_WIDTH, GAME_HEIGHT);
      g.lineTo(0, GAME_HEIGHT);
      g.closePath();
      g.fillPath();
    };
    drawLayer(0, 0x92572f);
    g.lineStyle(7, 0x4c8a2d, 1);
    g.beginPath();
    for (let i = 0; i < this.terrain.length; i++) {
      const x = i * TERRAIN_STEP;
      if (i === 0) g.moveTo(x, this.terrain[i]); else g.lineTo(x, this.terrain[i]);
    }
    g.strokePath();
    g.lineStyle(2, 0xc2eb61, 0.95);
    g.beginPath();
    for (let i = 0; i < this.terrain.length; i++) {
      const x = i * TERRAIN_STEP;
      if (i === 0) g.moveTo(x, this.terrain[i] - 3); else g.lineTo(x, this.terrain[i] - 3);
    }
    g.strokePath();
  }

  private drawArenaGrid(): void {
    const grid = this.add.graphics().setDepth(1);
    grid.lineStyle(1, 0xe6f5ff, 0.12);
    for (let x = 0; x <= BATTLE_WORLD_WIDTH; x += 40) grid.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += 40) grid.lineBetween(0, y, BATTLE_WORLD_WIDTH, y);
  }

  private createBattleBlocks(): void {
    for (const id of [1, 2] as PlayerId[]) {
      for (const placed of playerById(id).structure) {
        const offset = id === 1 ? BATTLE_P1_BUILD_OFFSET : BATTLE_P2_BUILD_OFFSET;
        const x = BUILD_ORIGIN_X[id] + offset + placed.col * TILE_SIZE + TILE_SIZE / 2;
        const groundY = this.terrainAt(id === 1 ? BATTLE_P1_X : BATTLE_P2_X);
        const y = groundY - (BUILD_ROWS - placed.row - 0.5) * TILE_SIZE;
        const image = addBlockImage(this, x, y, placed.type, { size: TILE_SIZE }).setDepth(6);
        this.blocks.push({ ownerId: id, col: placed.col, row: placed.row, type: placed.type, hp: BLOCK_HP[placed.type], image, x, y });
      }
    }
  }

  private createHud(): void {
    this.hudGraphics = this.add.graphics().setDepth(25);
    this.add.text(42, 28, "P1  /  BLUE TANK", this.titleStyle()).setDepth(26);
    this.add.text(1290, 28, "P2  /  RED TANK", this.titleStyle()).setDepth(26);
    this.p1Text = this.add.text(42, 54, "", this.detailStyle()).setDepth(26);
    this.p2Text = this.add.text(1558, 54, "", this.detailStyle()).setOrigin(1, 0).setDepth(26);
    this.add.rectangle(GAME_WIDTH / 2, 49, 390, 84, 0x172632, 0.94).setStrokeStyle(3, 0x9bb6c5, 0.9).setDepth(25);
    this.turnText = this.add.text(GAME_WIDTH / 2, 28, "BATTLE PHASE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "24px", color: "#f5fbff", stroke: "#17232c", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(26);
    this.timerText = this.add.text(GAME_WIDTH / 2, 65, "ROUND 1", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "27px", color: "#ffd45b", stroke: "#20221d", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(26);

    this.add.rectangle(GAME_WIDTH / 2, 846, 1080, 104, 0x14212b, 0.96).setStrokeStyle(3, 0x8da5b3, 0.9).setDepth(25);
    this.add.rectangle(GAME_WIDTH / 2, 790, 860, 30, 0x1b2d38, 0.92).setStrokeStyle(1, 0x66818f, 0.75).setDepth(25);
    this.statusText = this.add.text(GAME_WIDTH / 2, 790, "", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "15px", color: "#e9f5f8", stroke: "#121920", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(27);
    this.makeWeaponButton(570, "shell", "TANK SHOT", 0x344856);
    this.makeWeaponButton(730, "missile", "MISSILE", 0x4b3b32);
    this.makeWeaponButton(890, "boomerang", "BOOMERANG", 0x24464e);
    this.add.rectangle(1140, 850, 174, 66, 0xa94432, 1).setStrokeStyle(3, 0xffc18b, 1).setDepth(26);
    this.add.text(1140, 850, "FIRE  •  SPACE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "19px", color: "#fff7eb", stroke: "#502218", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(27);
    this.powerText = this.add.text(1400, 838, "POWER 88%", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "19px", color: "#ffe18c", stroke: "#1e2020", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(27);
    this.weaponText = this.add.text(1400, 870, "TANK SHOT", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "14px", color: "#f4f4ee", stroke: "#1e2020", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(27);
    this.add.text(GAME_WIDTH / 2, 893, "AIM WITH THE CURSOR  •  RELEASE TO FIRE     |     MOVE: P1 A/D   P2 ←/→     |     POWER: ↑ / ↓", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "13px", color: "#d6e0e5", stroke: "#111820", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(27);
  }

  private makeWeaponButton(x: number, type: WeaponType, label: string, color: number): void {
    const glow = this.add.rectangle(x, 850, 160, 78, color, 0)
      .setStrokeStyle(4, color, 0.9).setDepth(25);
    const background = this.add.rectangle(x, 850, 148, 64, color, 1)
      .setStrokeStyle(2, 0xaec2cb, 0.9).setDepth(26)
      .setInteractive({ useHandCursor: true });
    background.on("pointerdown", () => this.selectWeapon(type));
    const chargedWeapon = type !== "shell";
    const icon = this.add.image(x - 43, chargedWeapon ? 837 : 850, `projectile-${type}`)
      .setScale(type === "shell" ? 0.72 : 0.62).setDepth(27);
    const title = this.add.text(x + 12, chargedWeapon ? 837 : 850, label, {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: type === "boomerang" ? "11px" : type === "shell" ? "11px" : "14px",
      color: "#ffffff", stroke: "#10151a", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(27);
    const visual: WeaponButtonVisual = { background, glow, icon, title };
    if (chargedWeapon) {
      visual.chargeText = this.add.text(x, 857, "0%", {
        fontFamily: "Arial Black, Arial, sans-serif", fontSize: "12px", color: "#d5dce0", stroke: "#10151a", strokeThickness: 3,
      }).setOrigin(0.5).setDepth(27);
      visual.chargeBar = this.add.graphics().setDepth(27);
    }
    this.weaponButtons[type] = visual;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.resolving || this.activeProjectile) return;

    // Weapon buttons remain clickable and do not start an aiming drag.
    if (pointer.y >= 810) {
      if (pointer.x >= 495 && pointer.x < 645) this.selectWeapon("shell");
      else if (pointer.x >= 655 && pointer.x < 805) this.selectWeapon("missile");
      else if (pointer.x >= 815 && pointer.x < 965) this.selectWeapon("boomerang");
      else if (pointer.x >= 1050 && pointer.x < 1230) {
        this.fireWeapon(undefined, undefined, this.currentAimAngle, this.effectivePower());
        this.cancelAim();
      }
      return;
    }

    // Hold anywhere in the arena to set cannon angle; release to shoot.
    this.isAiming = true;
    this.aimPointerId = pointer.id;
    this.chargeBonus = 0;
    this.currentAimAngle = this.aimAngle(gameState.currentPlayer, pointer.worldX, pointer.worldY);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isAiming || (this.aimPointerId !== null && pointer.id !== this.aimPointerId)) return;
    if (!this.resolving && !this.activeProjectile) {
      this.currentAimAngle = this.aimAngle(gameState.currentPlayer, pointer.worldX, pointer.worldY);
      const angle = this.currentAimAngle;
      const shotPower = this.effectivePower();
      this.cancelAim();
      this.fireWeapon(undefined, undefined, angle, shotPower);
    } else {
      this.cancelAim();
    }
  }

  private cancelAim(): void {
    this.isAiming = false;
    this.aimPointerId = null;
    this.chargeBonus = 0;
    this.aimGraphics?.clear();
  }

  private effectivePower(): number {
    return clamp(this.power + this.chargeBonus, 0.5, 1.5);
  }

  private selectWeapon(type: WeaponType): void {
    gameState.selectedWeapon = type;
    this.updateHud();
  }

  private weaponStatusText(): string {
    const player = playerById(gameState.currentPlayer);
    const type = gameState.selectedWeapon;
    if (type === "shell") return "TANK SHOT  •  unlimited  •  1 damage";
    const charge = player.charge[type];
    const status = charge >= 100 ? "READY" : `${charge}% CHARGED`;
    return `${WEAPONS[type].label}  •  ${status}  •  ${WEAPONS[type].damage} damage`;
  }

  private updateHud(deltaSeconds = 0): void {
    this.hudGraphics.clear();
    const p1 = playerById(1);
    const p2 = playerById(2);
    for (const id of [1, 2] as PlayerId[]) {
      const charge = this.displayedCharge[id];
      const actual = playerById(id).charge;
      const blend = 1 - Math.exp(-7 * deltaSeconds);
      charge.missile = Phaser.Math.Linear(charge.missile, actual.missile, blend);
      charge.boomerang = Phaser.Math.Linear(charge.boomerang, actual.boomerang, blend);
    }
    this.drawPlayerBars(20, 18, 350, p1.hp, p1.fuel, 0x42b6ff);
    this.drawPlayerBars(1230, 18, 350, p2.hp, p2.fuel, 0xff6262);
    this.p1Text.setText(`HP ${p1.hp}  •  FUEL ${Math.ceil(p1.fuel)}  •  HITS ${p1.hits}`);
    this.p2Text.setText(`HP ${p2.hp}  •  FUEL ${Math.ceil(p2.fuel)}  •  HITS ${p2.hits}`);
    this.turnText.setText(`BATTLE PHASE  •  P${gameState.currentPlayer} TURN`);
    this.statusText.setText(this.fireMessage);
    const weaponButtons: Array<[number, WeaponType]> = [[570, "shell"], [730, "missile"], [890, "boomerang"]];
    for (const [x, type] of weaponButtons) {
      const selected = gameState.selectedWeapon === type;
      const visual = this.weaponButtons[type];
      const actualCharge = type === "shell" ? 100 : playerById(gameState.currentPlayer).charge[type];
      const charge = type === "shell" ? 100 : this.displayedCharge[gameState.currentPlayer][type];
      const ready = actualCharge >= 100;
      const dimAlpha = type === "shell" || ready ? 1 : 0.48;
      visual?.background.setAlpha(dimAlpha).setStrokeStyle(ready && type !== "shell" ? 3 : 2,
        ready && type !== "shell" ? WEAPONS[type].color : 0xaec2cb,
        ready && type !== "shell" ? 1 : 0.7);
      visual?.title.setAlpha(dimAlpha);
      visual?.icon.setAlpha(dimAlpha);
      visual?.chargeText?.setAlpha(dimAlpha).setText(ready ? "READY!" : `${Math.round(charge)}%`);
      if (type !== "shell" && this.weaponButtonReady[type] !== ready && visual) {
        this.weaponButtonReady[type] = ready;
        this.animateWeaponButton(type, visual, ready);
      }
      if (visual?.chargeBar) {
        visual.chargeBar.clear();
        visual.chargeBar.fillStyle(0x05080b, 0.95).fillRoundedRect(x - 58, 869, 116, 6, 3);
        if (charge > 0) visual.chargeBar.fillStyle(ready ? WEAPONS[type].color : 0x76828a, 1)
          .fillRoundedRect(x - 56, 871, 112 * clamp(charge / 100, 0, 1), 2, 1);
      }
      const selectedIsAvailable = selected && (type === "shell" || ready);
      this.hudGraphics.lineStyle(selectedIsAvailable ? 4 : 1,
        selectedIsAvailable ? 0x51dcff : 0x5d6469,
        selectedIsAvailable ? 1 : 0.45);
      this.hudGraphics.strokeRoundedRect(x - 76, 817, 152, 66, 5);
    }
  }

  private animateWeaponButton(type: WeaponType, visual: WeaponButtonVisual, ready: boolean): void {
    const targets = [visual.glow, visual.background, visual.title, visual.chargeText].filter(Boolean) as Phaser.GameObjects.GameObject[];
    this.tweens.killTweensOf(targets);
    if (!ready) {
      visual.glow.setAlpha(0).setScale(1);
      visual.background.setScale(1);
      visual.title.setScale(1);
      visual.chargeText?.setScale(1);
      return;
    }

    const color = WEAPONS[type].color;
    visual.glow.setFillStyle(color, 0.2).setStrokeStyle(5, color, 1).setAlpha(0.9).setScale(0.92);
    visual.background.setStrokeStyle(3, color, 1).setScale(1);
    this.tweens.add({
      targets: visual.glow,
      alpha: { from: 0.92, to: 0.32 },
      scale: { from: 0.92, to: 1.18 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: visual.background,
      scale: { from: 1, to: 1.055 },
      duration: 180,
      yoyo: true,
      repeat: 1,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: visual.chargeText,
      scale: { from: 1, to: 1.16 },
      duration: 190,
      yoyo: true,
      ease: "Back.easeOut",
    });
  }

  private drawPlayerBars(x: number, y: number, width: number, hp: number, fuel: number, accent: number): void {
    this.hudGraphics.fillStyle(0x13222c, 0.94).fillRoundedRect(x, y, width, 158, 8);
    this.hudGraphics.lineStyle(2, accent, 0.95).strokeRoundedRect(x, y, width, 158, 8);
    this.drawBar(x + 18, y + 84, width - 36, 8, hp / MAX_HP, 0x62df82);
    this.drawBar(x + 18, y + 102, width - 36, 7, fuel / 100, 0xffc456);
  }

  private drawBar(x: number, y: number, w: number, h: number, ratio: number, color: number): void {
    const fillWidth = Math.max(0, (w - 4) * clamp(ratio, 0, 1));
    if (fillWidth > 0) this.hudGraphics.fillStyle(color, 0.24).fillRoundedRect(x - 3, y - 3, fillWidth + 9, h + 6, 4);
    this.hudGraphics.fillStyle(0x05080b, 1).fillRect(x, y, w, h);
    this.hudGraphics.lineStyle(2, 0x020405, 1).strokeRect(x, y, w, h);
    this.hudGraphics.fillStyle(color, 1).fillRect(x + 2, y + 2, fillWidth, h - 4);
  }

  private pulseChargeText(id: PlayerId): void {
    const label = id === 1 ? this.p1Text : this.p2Text;
    this.tweens.add({ targets: label, alpha: 0.45, duration: 110, yoyo: true, repeat: 3, onComplete: () => label.setAlpha(1) });
  }

  private drawAimGuide(): void {
    this.aimGraphics.clear();
    const id = gameState.currentPlayer;
    const origin = this.muzzlePosition(id);
    this.drawTrajectory(origin.x, origin.y, this.currentAimAngle, this.power, 0xffe7a5, 0.28);
  }

  private drawTrajectoryPreview(): void {
    this.aimGraphics.clear();
    const id = gameState.currentPlayer;
    const origin = this.muzzlePosition(id);
    this.drawTrajectory(origin.x, origin.y, this.currentAimAngle, this.effectivePower(), 0x8cffb5, 0.9);
    const pointer = this.input.activePointer;
    this.aimGraphics.lineStyle(2, 0xfff6d1, 0.9);
    this.aimGraphics.strokeCircle(pointer.worldX, pointer.worldY, 9);
    this.aimGraphics.lineBetween(pointer.worldX - 13, pointer.worldY, pointer.worldX - 6, pointer.worldY);
    this.aimGraphics.lineBetween(pointer.worldX + 6, pointer.worldY, pointer.worldX + 13, pointer.worldY);
    this.aimGraphics.lineBetween(pointer.worldX, pointer.worldY - 13, pointer.worldX, pointer.worldY - 6);
    this.aimGraphics.lineBetween(pointer.worldX, pointer.worldY + 6, pointer.worldX, pointer.worldY + 13);

    // Hold to add a little extra firing power.
    const ratio = clamp(this.chargeBonus / this.maxChargeBonus, 0, 1);
    this.aimGraphics.fillStyle(0x14202a, 0.9).fillRoundedRect(origin.x - 34, origin.y - 52, 68, 9, 4);
    this.aimGraphics.fillStyle(ratio >= 0.8 ? 0xffb13b : 0x64e6ff, 1)
      .fillRoundedRect(origin.x - 32, origin.y - 50, 64 * ratio, 5, 3);
  }

  private drawTrajectory(
    startX: number,
    startY: number,
    angle: number,
    power: number,
    color: number,
    alpha: number,
  ): void {
    const id = gameState.currentPlayer;
    const weapon = WEAPONS[gameState.selectedWeapon];
    const speed = weapon.speed * power;
    let x = startX;
    let y = startY;
    let vx = Math.cos(angle) * speed * (id === 1 ? 1 : -1);
    let vy = Math.sin(angle) * speed;
    const boomerang = gameState.selectedWeapon === "boomerang";
    const dir = id === 1 ? 1 : -1;
    const enemyX = this.tanks[otherPlayerId(id)].x;
    const targetX = enemyX + dir * 25;
    const targetY = this.terrainAt(enemyX) - 32;
    let returning = false;
    this.aimGraphics.lineStyle(2, color, alpha);

    for (let i = 1; i <= (boomerang ? 100 : 28); i++) {
      const t = 0.055;
      if (boomerang && !returning && (dir === 1 ? x >= enemyX + 70 : x <= enemyX - 70)) returning = true;
      if (boomerang && returning) {
        const dx = targetX - x;
        const dy = targetY - y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const desiredVx = dx / len * weapon.speed * power;
        const desiredVy = dy / len * weapon.speed * power;
        const blend = 1 - Math.exp(-3 * t);
        vx += (desiredVx - vx) * blend;
        vy += (desiredVy - vy) * blend;
      }
      const nextX = x + vx * t;
      const nextY = y + vy * t;
      if (!returning) vy += weapon.gravity * t;
      x = nextX;
      y = nextY;

      if (x < 0 || x > BATTLE_WORLD_WIDTH || (!returning && (y > this.terrainAt(clamp(x, 0, BATTLE_WORLD_WIDTH)) || y > GAME_HEIGHT - 4))) break;

      const hitsBlock = this.blocks.some((block) => block.ownerId !== id &&
        Math.abs(x - block.x) <= TILE_SIZE * 0.46 && Math.abs(y - block.y) <= TILE_SIZE * 0.46
      );
      if (hitsBlock) break;

      if (i % 2 === 0) this.aimGraphics.strokeCircle(x, y, 2.5);
      if (returning && distance(x, y, enemyX, this.terrainAt(enemyX) - 30) < 29) break;
    }
  }

  private fireWeapon(pointerX?: number, pointerY?: number, angleOverride?: number, powerOverride?: number): void {
    if (this.resolving || this.activeProjectile) return;
    const ownerId = gameState.currentPlayer;
    const player = playerById(ownerId);
    const weaponType = gameState.selectedWeapon;
    if (weaponType !== "shell" && player.charge[weaponType] < 100) {
      this.fireMessage = `${WEAPONS[weaponType].label} charging: ${player.charge[weaponType]}% — hit or break the enemy wall.`;
      this.updateHud();
      return;
    }
    if (weaponType !== "shell") player.charge[weaponType] -= 100;
    const pointer = this.input.activePointer;
    const aimX = pointerX ?? pointer.worldX;
    const aimY = pointerY ?? pointer.worldY;
    const origin = this.muzzlePosition(ownerId);
    const angle = angleOverride ?? this.aimAngle(ownerId, aimX, aimY);
    const spec = WEAPONS[weaponType];
    const speed = spec.speed * clamp(powerOverride ?? this.power, 0.5, 1.5);
    const dir = ownerId === 1 ? 1 : -1;
    const projectileImage = this.add.image(origin.x, origin.y, `projectile-${weaponType}`)
      .setScale(0.55).setDepth(16);
    projectileImage.setRotation(angle);
    this.tweens.add({ targets: projectileImage, scale: 1.15, duration: 240, ease: "Cubic.easeOut" });
    const glowImage = gameState.nightMode
      ? this.add.image(origin.x, origin.y, "night-halo")
        .setDisplaySize(74, 74)
        .setTint(spec.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.92)
        .setDepth(15.5)
        .setRotation(angle)
      : null;
    this.activeProjectile = {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed * dir,
      vy: Math.sin(angle) * speed,
      age: 0,
      ownerId,
      weapon: weaponType,
      damage: spec.damage,
      radius: spec.radius,
      gravity: spec.gravity,
      returning: false,
      image: projectileImage,
      glowImage,
      trailClock: 0,
    };
    player.shotsFired += 1;
    this.tweens.killTweensOf(this.cameras.main);
    this.tweens.add({ targets: this.cameras.main, zoom: 1.32, duration: 260, ease: "Quad.easeOut" });
    this.cameras.main.startFollow(projectileImage, true, 0.13, 0.13);
    this.chargeBonus = 0;
    // Firing is free: fuel decreases only when the tank moves.
    this.fireMessage = `P${ownerId} fired ${spec.label.toLowerCase()} at ${Math.round(clamp(powerOverride ?? this.power, 0.5, 1.5) * 100)}% power — wait for impact.`;
    this.updateHud();
  }

  private updateProjectile(deltaSeconds: number): void {
    const projectile = this.activeProjectile;
    if (!projectile) return;
    projectile.age += deltaSeconds;
    projectile.trailClock += deltaSeconds;
    const enemyId = otherPlayerId(projectile.ownerId);
    const enemyX = this.tanks[enemyId].x;
    const enemyGround = this.terrainAt(enemyX);

    if (projectile.weapon === "boomerang" && !projectile.returning) {
      const dir = projectile.ownerId === 1 ? 1 : -1;
      if ((dir === 1 && projectile.x >= enemyX + 70) || (dir === -1 && projectile.x <= enemyX - 70)) {
        projectile.returning = true;
        this.fireMessage = "Boomerang is looping back toward the tank's rear!";
      }
    }

    if (projectile.weapon === "boomerang" && projectile.returning) {
      const dir = projectile.ownerId === 1 ? 1 : -1;
      const targetX = enemyX + dir * 25;
      const targetY = enemyGround - 32;
      const dx = targetX - projectile.x;
      const dy = targetY - projectile.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const desiredVx = (dx / len) * WEAPONS.boomerang.speed;
      const desiredVy = (dy / len) * WEAPONS.boomerang.speed;
      const blend = 1 - Math.exp(-3 * deltaSeconds);
      projectile.vx += (desiredVx - projectile.vx) * blend;
      projectile.vy += (desiredVy - projectile.vy) * blend;
      projectile.x += projectile.vx * deltaSeconds;
      projectile.y += projectile.vy * deltaSeconds;
      if (distance(projectile.x, projectile.y, enemyX, enemyGround - 30) < 37) {
        this.resolveImpact(projectile.x, projectile.y, projectile, enemyId);
        return;
      }
    } else {
      projectile.x += projectile.vx * deltaSeconds;
      projectile.y += projectile.vy * deltaSeconds;
      projectile.vy += projectile.gravity * deltaSeconds;
    }
    projectile.image.setPosition(projectile.x, projectile.y);
    const travelAngle = Math.atan2(projectile.vy, projectile.vx);
    projectile.image.setRotation(travelAngle + (projectile.weapon === "boomerang" ? projectile.age * 7 : 0));
    projectile.glowImage?.setPosition(projectile.x, projectile.y).setRotation(projectile.image.rotation);
    while (projectile.trailClock >= 0.024) {
      projectile.trailClock -= 0.024;
      this.emitProjectileTrail(projectile);
    }

    // A wall collision takes priority over the terrain check, allowing blocks to shield tanks.
    const hitBlock = this.blocks.find((block) => block.ownerId !== projectile.ownerId &&
      Math.abs(projectile.x - block.x) <= TILE_SIZE * 0.46 && Math.abs(projectile.y - block.y) <= TILE_SIZE * 0.46,
    );
    if (hitBlock) {
      this.resolveImpact(projectile.x, projectile.y, projectile, null);
      return;
    }

    if (distance(projectile.x, projectile.y, this.tanks[enemyId].x, enemyGround - 30) < 29) {
      this.resolveImpact(projectile.x, projectile.y, projectile, enemyId);
      return;
    }
    const groundY = this.terrainAt(clamp(projectile.x, 0, BATTLE_WORLD_WIDTH));
    if (projectile.y >= groundY) {
      this.resolveImpact(projectile.x, groundY, projectile, null);
      return;
    }
    if (projectile.x < -20 || projectile.x > BATTLE_WORLD_WIDTH + 20 || projectile.y > GAME_HEIGHT + 10 || projectile.age > 5.5) {
      this.resolveMiss(projectile);
    }
  }

  private emitProjectileTrail(projectile: ProjectileState): void {
    const length = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
    const backX = -projectile.vx / length;
    const backY = -projectile.vy / length;
    const isFire = projectile.weapon !== "boomerang";
    const color = projectile.weapon === "boomerang"
      ? (Math.random() > 0.5 ? 0x82f6ff : 0x5a9cff)
      : (Math.random() > 0.42 ? 0xffb21f : 0xff6926);
    const size = projectile.weapon === "missile" ? Phaser.Math.Between(4, 9) : Phaser.Math.Between(3, 6);
    const particle = this.add.circle(
      projectile.x + backX * 18 + Phaser.Math.Between(-3, 3),
      projectile.y + backY * 18 + Phaser.Math.Between(-3, 3),
      size,
      color,
      isFire ? 0.94 : 0.82,
    ).setDepth(17);
    if (gameState.nightMode) particle.setBlendMode(Phaser.BlendModes.ADD);
    if (isFire && Math.random() > 0.5) particle.setStrokeStyle(2, 0xffed75, 0.8);
    this.tweens.add({
      targets: particle,
      x: particle.x + backX * Phaser.Math.Between(22, 42),
      y: particle.y + backY * 18 + Phaser.Math.Between(-11, 11),
      alpha: 0,
      scale: 0.12,
      duration: projectile.weapon === "missile" ? 330 : 220,
      ease: "Cubic.easeOut",
      onComplete: () => particle.destroy(),
    });
  }

  private resolveImpact(x: number, y: number, projectile: ProjectileState, directTank: PlayerId | null): void {
    if (this.resolving) return;
    this.resolving = true;
    const enemyId = otherPlayerId(projectile.ownerId);
    let enemyWallHit = false;
    let wallBroken = false;

    for (const block of [...this.blocks]) {
      if (block.ownerId === projectile.ownerId) continue;
      const d = distance(x, y, block.x, block.y);
      if (d > projectile.radius + TILE_SIZE * 0.62) continue;
      const falloff = clamp(1 - d / (projectile.radius + TILE_SIZE * 0.62), 0.15, 1);
      const blockDamage = Math.max(1, Math.round(projectile.damage * falloff));
      block.hp -= blockDamage;
      block.image.setAlpha(clamp(0.48 + 0.52 * (block.hp / BLOCK_HP[block.type]), 0.18, 1));
      this.emitBlockParticles(block.x, block.y, block.type === "dirt" ? 0xc8915f : block.type === "stone" ? 0xc4d0d5 : 0xb7a4e4, block.hp <= 0 ? 13 : 3);
      if (block.ownerId !== projectile.ownerId) enemyWallHit = true;
      if (block.hp <= 0) {
        block.image.destroy();
        this.blocks = this.blocks.filter((entry) => entry !== block);
        const ownerStructure = playerById(block.ownerId).structure;
        const index = ownerStructure.findIndex((entry) => entry.col === block.col && entry.row === block.row);
        if (index >= 0) ownerStructure.splice(index, 1);
        if (block.ownerId !== projectile.ownerId) wallBroken = true;
      }
    }

    const blastCenterY = y;
    this.carveCrater(x, blastCenterY, projectile.radius);
    this.drawTerrain();

    for (const id of [1, 2] as PlayerId[]) {
      if (id === projectile.ownerId && directTank !== id) continue;
      const tankX = this.tanks[id].x;
      const tankY = this.terrainAt(tankX) - 30;
      const isDirect = directTank === id;
      if (isDirect || distance(x, y, tankX, tankY) <= projectile.radius + 26) {
        const player = playerById(id);
        player.hp = Math.max(0, player.hp - projectile.damage);
        if (id !== projectile.ownerId) playerById(projectile.ownerId).hits += 1;
      }
    }

    if (enemyWallHit) {
      const attacker = playerById(projectile.ownerId);
      attacker.charge.missile = Math.min(100, attacker.charge.missile + (wallBroken ? 24 : 15));
      attacker.charge.boomerang = Math.min(100, attacker.charge.boomerang + (wallBroken ? 38 : 22));
      this.pulseChargeText(projectile.ownerId);
      this.fireMessage = wallBroken
        ? `Enemy block broken! Missile +${wallBroken ? 24 : 15}% • Boomerang +${wallBroken ? 38 : 22}%`
        : "Enemy wall hit! Missile and boomerang charge increased.";
    } else {
      this.fireMessage = `${WEAPONS[projectile.weapon].label} impact • ${projectile.damage} damage • crater radius ${projectile.radius}px`;
    }

    this.showExplosion(x, y, projectile.radius, WEAPONS[projectile.weapon].color);
    this.cameras.main.shake(240, directTank ? 0.012 : 0.008);
    projectile.image.destroy();
    projectile.glowImage?.destroy();
    this.activeProjectile = null;
    this.cameras.main.stopFollow();
    this.updateHud();

    this.time.delayedCall(420, () => {
      const p1 = playerById(1);
      const p2 = playerById(2);
      if (p1.hp <= 0 || p2.hp <= 0) {
        gameState.winner = p1.hp === p2.hp ? 0 : p1.hp > p2.hp ? 1 : 2;
        this.scene.start("ResultScene");
        return;
      }
      this.returnCameraToStart(() => {
        gameState.currentPlayer = otherPlayerId(projectile.ownerId);
        gameState.round += 1;
        this.resolving = false;
        this.fireMessage = `P${gameState.currentPlayer} turn — ${this.weaponStatusText()}`;
        this.updateHud();
      });
    });
  }

  private resolveMiss(projectile: ProjectileState): void {
    if (this.resolving) return;
    this.resolving = true;
    projectile.image.destroy();
    projectile.glowImage?.destroy();
    this.activeProjectile = null;
    this.cameras.main.stopFollow();
    this.fireMessage = "Miss! The next tank gets its turn.";
    this.updateHud();
    this.time.delayedCall(250, () => {
      this.returnCameraToStart(() => {
        gameState.currentPlayer = otherPlayerId(projectile.ownerId);
        gameState.round += 1;
        this.resolving = false;
        this.updateHud();
      });
    });
  }

  private carveCrater(centerX: number, impactY: number, radius: number): void {
    const left = Math.max(0, Math.floor((centerX - radius) / TERRAIN_STEP));
    const right = Math.min(this.terrain.length - 1, Math.ceil((centerX + radius) / TERRAIN_STEP));
    for (let i = left; i <= right; i++) {
      const x = i * TERRAIN_STEP;
      const dx = x - centerX;
      const horizontal = Math.sqrt(Math.max(0, radius * radius - dx * dx));
      const verticalGap = this.terrain[i] - impactY;
      if (horizontal > verticalGap) {
        const depth = (horizontal - Math.max(0, verticalGap)) * 0.78;
        this.terrain[i] = clamp(this.terrain[i] + depth, this.terrain[i], GAME_HEIGHT - 18);
      }
    }
  }

  private showExplosion(x: number, y: number, radius: number, color: number): void {
    const ring = this.add.circle(x, y, radius, color, 0.2).setStrokeStyle(4, 0xffe8ae, 0.9).setDepth(18);
    if (gameState.nightMode) ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setScale(0.35);
    this.tweens.add({ targets: ring, scale: 1.45, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
    for (let i = 0; i < 9; i++) {
      const angle = (Math.PI * 2 * i) / 9;
      const spark = this.add.circle(x, y, i % 2 ? 3 : 4, i % 2 ? 0xffe3a3 : color, 1).setDepth(19);
      if (gameState.nightMode) spark.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * radius * (0.8 + (i % 3) * 0.25),
        y: y + Math.sin(angle) * radius * (0.8 + (i % 3) * 0.25),
        alpha: 0,
        duration: 300 + i * 8,
        onComplete: () => spark.destroy(),
      });
    }
  }

  private emitBlockParticles(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const particle = this.add.rectangle(x, y, Phaser.Math.Between(3, 6), Phaser.Math.Between(3, 6), color, 1).setDepth(12);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-30, 30),
        y: y + Phaser.Math.Between(8, 52),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(260, 500),
        ease: "Cubic.easeIn",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private returnCameraToStart(onComplete?: () => void): void {
    const camera = this.cameras.main;
    camera.stopFollow();
    this.tweens.add({
      targets: camera,
      scrollX: this.battleCameraScrollX(BATTLE_BASE_ZOOM),
      zoom: BATTLE_BASE_ZOOM,
      duration: 320,
      ease: "Sine.easeInOut",
      onComplete,
    });
  }

  private battleCameraScrollX(zoom = this.cameras.main.zoom): number {
    const tanksCenter = (this.tanks[1].x + this.tanks[2].x) / 2;
    const viewWidth = GAME_WIDTH / zoom;
    return clamp(tanksCenter - viewWidth / 2, 0, BATTLE_WORLD_WIDTH - viewWidth);
  }

  private muzzlePosition(id: PlayerId): { x: number; y: number } {
    const dir = id === 1 ? 1 : -1;
    const x = this.tanks[id].x + dir * 40;
    const y = this.terrainAt(this.tanks[id].x) - 39;
    return { x, y };
  }

  private aimAngle(id: PlayerId, pointerX: number, pointerY: number): number {
    const origin = this.muzzlePosition(id);
    const horizontalDistance = Math.max(55, Math.abs(pointerX - origin.x));
    const raw = Math.atan2(pointerY - origin.y, horizontalDistance);
    return clamp(raw, -1.34, 0.28);
  }

  private terrainAt(x: number): number {
    const position = clamp(x / TERRAIN_STEP, 0, this.terrain.length - 1);
    const index = Math.floor(position);
    const fraction = position - index;
    const a = this.terrain[index] ?? 580;
    const b = this.terrain[Math.min(this.terrain.length - 1, index + 1)] ?? a;
    return a + (b - a) * fraction;
  }

  private titleStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: "Arial Black, Arial, sans-serif", fontSize: "23px", color: "#f9f7eb", stroke: "#111820", strokeThickness: 5 };
  }

  private detailStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: "Arial Black, Arial, sans-serif", fontSize: "13px", color: "#f9f2df", stroke: "#111820", strokeThickness: 3 };
  }
}
