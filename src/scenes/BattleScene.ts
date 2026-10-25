import Phaser from "phaser";
import {
  BLOCK_HP, BATTLE_WORLD_WIDTH, BUILD_COLS, BUILD_ORIGIN_X, BUILD_ROWS, GAME_HEIGHT, GAME_WIDTH, TANK_X,
  TILE_SIZE, addBlockImage, clamp, distance,
} from "../grid";
import { gameState, otherPlayerId, playerById, type PlayerId, type TileType, type WeaponType } from "../state";
import { PlayerStatusHud } from "../ui/PlayerStatusHud";
import { playImpact, playShot, startTravelWhoosh } from "../sfx";

const TERRAIN_STEP = 8;
// Keep the opening distance inside the missile's normal-power flight range.
const BATTLE_P1_X = 650;
const BATTLE_P2_X = 1550;
const BATTLE_P1_BUILD_OFFSET = BATTLE_P1_X - TANK_X[1];
const BATTLE_P2_BUILD_OFFSET = BATTLE_P2_X - TANK_X[2];
const BATTLE_BASE_ZOOM = 1;
const BATTLE_CAMERA_START_X = (BATTLE_WORLD_WIDTH - GAME_WIDTH / BATTLE_BASE_ZOOM) / 2;
const TANK_EDGE_MARGIN = 28;
// Tank movement settings. Fuel is charged by actual distance moved.
const TANK_MOVE_SPEED = 190; // pixels per second
const TANK_FUEL_PER_PIXEL = 0.04; // 4 fuel per 100 pixels
const WEAPONS: Record<WeaponType, { label: string; damage: number; radius: number; speed: number; gravity: number; color: number }> = {
  shell: { label: "TANK SHOT", damage: 3, radius: 23, speed: 660, gravity: 520, color: 0xffefb0 },
  missile: { label: "MISSILE", damage: 10, radius: 72, speed: 700, gravity: 390, color: 0xff9a38 },
  boomerang: { label: "BOOMERANG", damage: 6.5, radius: 31, speed: 700, gravity: 205, color: 0x74f2ff },
};

interface BattleBlock {
  ownerId: PlayerId;
  col: number;
  row: number;
  type: TileType;
  hp: number;
  maxHp: number;
  image: Phaser.GameObjects.Image;
  crack: Phaser.GameObjects.Graphics;
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
  background: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  hitArea: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  ammoText: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private terrain: number[] = [];
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private aimGraphics!: Phaser.GameObjects.Graphics;
  private cannonGraphics!: Phaser.GameObjects.Graphics;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private playerHud!: PlayerStatusHud;
  private blocks: BattleBlock[] = [];
  private tanks!: Record<PlayerId, Phaser.GameObjects.Image>;
  private readonly tankHitLift: Record<PlayerId, { amount: number }> = {
    1: { amount: 0 },
    2: { amount: 0 },
  };
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private readonly mainCameraIgnored = new WeakSet<Phaser.GameObjects.GameObject>();
  private readonly uiCameraIgnored = new WeakSet<Phaser.GameObjects.GameObject>();
  private activeProjectile: ProjectileState | null = null;
  private firedThisTurn = false;
  private lastShotAt = Number.NEGATIVE_INFINITY;
  private fireButtonPointerId: number | null = null;
  private power = 0.88;
  private fireMessage = "Aim with your mouse, then click to fire.";
  private statusText!: Phaser.GameObjects.Text;
  private powerLabel!: Phaser.GameObjects.Text;
  private weaponButtons: Partial<Record<WeaponType, WeaponButtonVisual>> = {};

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
  private battleMusic?: Phaser.Sound.BaseSound;
  private stopTravelWhoosh?: () => void;

  constructor() {
    super("BattleScene");
  }

  create(): void {
    this.sound.stopAll();
    this.battleMusic = this.sound.add("battle-bgm", { loop: true, volume: 0.18 });
    this.battleMusic.play();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopTravelWhoosh?.();
      this.stopTravelWhoosh = undefined;
      this.battleMusic?.stop();
      this.battleMusic?.destroy();
      this.battleMusic = undefined;
    });
    this.blocks = [];
    this.activeProjectile = null;
    this.tankHitLift[1].amount = 0;
    this.tankHitLift[2].amount = 0;
    this.firedThisTurn = false;
    this.lastShotAt = Number.NEGATIVE_INFINITY;
    this.fireButtonPointerId = null;
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
    this.add.image(BATTLE_WORLD_WIDTH / 2, GAME_HEIGHT / 2,
      gameState.nightMode ? "battle-night-background" : "battle-day-background")
      .setDisplaySize(BATTLE_WORLD_WIDTH, GAME_HEIGHT)
      .setDepth(-10);
    this.createTerrain();
    this.drawTerrain();
    const p1FacesLeftByDefault = playerById(1).tankTexture === "tank-red";
    const p2FacesLeftByDefault = playerById(2).tankTexture === "tank-red";
    this.tanks = {
      1: this.add.image(BATTLE_P1_X, this.terrainAt(BATTLE_P1_X), playerById(1).tankTexture).setOrigin(0.5, 1).setFlipX(p1FacesLeftByDefault).setDepth(7),
      2: this.add.image(BATTLE_P2_X, this.terrainAt(BATTLE_P2_X), playerById(2).tankTexture).setOrigin(0.5, 1).setFlipX(!p2FacesLeftByDefault).setDepth(7),
    };
    this.tanks[1].rotation = this.tankSlopeAngle(BATTLE_P1_X, this.tanks[1]);
    this.tanks[2].rotation = this.tankSlopeAngle(BATTLE_P2_X, this.tanks[2]);
    this.cannonGraphics = this.add.graphics().setDepth(8);
    this.createBattleBlocks();
    this.aimGraphics = this.add.graphics().setDepth(15);
    this.createHud();
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.uiCamera.setZoom(1).setScroll(0, 0);
    const children = this.children.list as Array<Phaser.GameObjects.GameObject & { depth: number }>;
    const worldObjects = children.filter((child) => child.depth < 25);
    const interfaceObjects = children.filter((child) => child.depth >= 25);
    camera.ignore(interfaceObjects);
    this.uiCamera.ignore(worldObjects);
    worldObjects.forEach((object) => this.uiCameraIgnored.add(object));
    interfaceObjects.forEach((object) => this.mainCameraIgnored.add(object));
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
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.input.off("pointerup", this.handlePointerUp, this);
    this.input.off("pointerupoutside", this.handlePointerUp, this);
    this.input.off("pointerupoutside", this.handlePointerUpOutside, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUpOutside, this);
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    this.syncCameraLayers();
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

    this.tanks[1].y = this.terrainAt(this.tanks[1].x) - this.tankHitLift[1].amount;
    this.tanks[2].y = this.terrainAt(this.tanks[2].x) - this.tankHitLift[2].amount;
    if (!this.resolving && !this.isAiming) {
      const zoom = this.battleCameraZoomForTanks();
      this.cameras.main.setZoom(zoom);
      this.cameras.main.scrollX = this.battleCameraScrollX(zoom);
    }
    if (this.isAiming && this.aimPointerId !== null) {
      const pointer = this.input.pointer1.id === this.aimPointerId
        ? this.input.pointer1
        : this.input.activePointer;
      const point = this.battleWorldPoint(pointer);
      this.currentAimAngle = this.aimAngle(gameState.currentPlayer, point.x, point.y);
      this.chargeBonus = Math.min(this.maxChargeBonus, this.chargeBonus + this.chargeRate * delta / 1000);
    } else if (!this.activeProjectile) {
      const pointer = this.input.activePointer;
      const point = this.battleWorldPoint(pointer);
      this.currentAimAngle = this.aimAngle(gameState.currentPlayer, point.x, point.y);
    }
    this.drawCannons();

    if (this.activeProjectile) this.updateProjectile(delta / 1000);
    else if (this.isAiming) this.drawTrajectoryPreview();
    else this.drawAimGuide();
    this.updateHud(delta / 1000);
    this.syncCameraLayers();
  }

  private syncCameraLayers(): void {
    const children = this.children.list as Array<Phaser.GameObjects.GameObject & { depth: number }>;
    for (const object of children) {
      if (object.depth < 25) {
        if (!this.uiCameraIgnored.has(object)) {
          this.uiCamera.ignore(object);
          this.uiCameraIgnored.add(object);
        }
      } else if (!this.mainCameraIgnored.has(object)) {
        this.cameras.main.ignore(object);
        this.mainCameraIgnored.add(object);
      }
    }
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
    const minX = id === 1 ? halfTankWidth + TANK_EDGE_MARGIN : BATTLE_WORLD_WIDTH / 2 + halfTankWidth;
    const maxX = id === 1 ? BATTLE_WORLD_WIDTH / 2 - halfTankWidth : BATTLE_WORLD_WIDTH - halfTankWidth - TANK_EDGE_MARGIN;

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
    const nextY = this.terrainAt(nextX);
    if (this.tankOverlapsBlock(nextX, nextY, tank)) return;

    const fuelShownBefore = Math.ceil(player.fuel);
    tank.x = nextX;
    tank.rotation = this.tankSlopeAngle(nextX, tank);
    player.fuel = Math.max(0, player.fuel - Math.abs(distanceMoved) * TANK_FUEL_PER_PIXEL);

    // Refresh the fuel bar and label once per whole fuel unit, not on every frame.
    if (Math.ceil(player.fuel) !== fuelShownBefore) {
      this.fireMessage = `P${id} moving — ${Math.ceil(player.fuel)} fuel remaining.`;
      this.updateHud();
    }
  }

  private tankOverlapsBlock(x: number, groundY: number, tank: Phaser.GameObjects.Image): boolean {
    const halfWidth = tank.displayWidth * 0.42;
    const bodyTop = groundY - tank.displayHeight * 0.78;
    const bodyBottom = groundY - 8;
    for (const block of this.blocks) {
      const blockLeft = block.x - TILE_SIZE / 2;
      const blockRight = block.x + TILE_SIZE / 2;
      const blockTop = block.y - TILE_SIZE / 2;
      const blockBottom = block.y + TILE_SIZE / 2;
      if (x + halfWidth > blockLeft && x - halfWidth < blockRight &&
          bodyBottom > blockTop && bodyTop < blockBottom) return true;
    }
    return false;
  }

  private createTerrain(): void {
    this.terrain = [];
    for (let x = 0; x <= BATTLE_WORLD_WIDTH; x += TERRAIN_STEP) {
      const valley = 220 * Math.exp(-Math.pow((x - 1100) / 250, 2));
      const leftRidge = 30 * Math.exp(-Math.pow((x - 620) / 245, 2));
      const rightRidge = 48 * Math.exp(-Math.pow((x - 1570) / 255, 2));
      const unevenSoil = 5 * Math.sin(x / 57) + 3 * Math.sin(x / 23) + 2 * Math.sin(x / 13);
      this.terrain.push(clamp(430 + valley + leftRidge + rightRidge + unevenSoil, 410, 700));
    }
    this.terrainGraphics = this.add.graphics().setDepth(2);
  }

  private drawTerrain(): void {
    const g = this.terrainGraphics;
    g.clear();
    const night = gameState.nightMode;
    const drawBand = (topOffset: number, bottomOffset: number | null, color: number): void => {
      g.fillStyle(color, 1);
      g.beginPath();
      for (let i = 0; i < this.terrain.length; i++) {
        const x = i * TERRAIN_STEP;
        const y = Math.max(0, Math.min(GAME_HEIGHT, this.terrain[i] + topOffset));
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      if (bottomOffset === null) {
        g.lineTo(BATTLE_WORLD_WIDTH, GAME_HEIGHT);
        g.lineTo(0, GAME_HEIGHT);
      } else {
        for (let i = this.terrain.length - 1; i >= 0; i--) {
          const x = i * TERRAIN_STEP;
          const y = Math.min(GAME_HEIGHT, this.terrain[i] + bottomOffset);
          g.lineTo(x, y);
        }
      }
      g.closePath();
      g.fillPath();
    };

    // Layered soil and rock make the valley read like a dug-out battlefield.
    drawBand(250, null, night ? 0x252b49 : 0x363b50);
    drawBand(88, 250, night ? 0x49383d : 0x65402d);
    drawBand(0, 88, night ? 0x65434a : 0x8b512d);
    drawBand(0, 12, night ? 0x3f713d : 0x57933a);

    // Pixel flecks and angular stones break up the broad earth bands.
    for (let x = 18; x < BATTLE_WORLD_WIDTH; x += 31) {
      const surfaceY = this.terrainAt(x);
      for (let depth = 28; depth < 430; depth += 29) {
        const y = surfaceY + depth + Math.sin((x + depth) * 0.09) * 4;
        if (y > GAME_HEIGHT - 7) continue;
        const seed = Math.abs(Math.floor(x * 13 + depth * 7));
        const size = 2 + (seed % 5);
        if (depth < 100) {
          g.fillStyle((seed % 2 === 0 ? (night ? 0x98624b : 0xc17a42) : (night ? 0x372f3a : 0x633b29)), 0.72);
          g.fillRect(x + (seed % 11) - 5, y, size + 2, Math.max(2, size - 1));
        } else if (depth < 250) {
          g.fillStyle(seed % 2 === 0 ? (night ? 0x9b674f : 0xa96537) : (night ? 0x302b39 : 0x51352c), 0.75);
          g.fillRect(x + (seed % 9) - 4, y, size + 4, size);
        } else {
          g.fillStyle(seed % 2 === 0 ? (night ? 0x707b98 : 0x818b91) : (night ? 0x292840 : 0x272d3d), 0.76);
          g.fillRect(x + (seed % 13) - 6, y, size + 3, size + 2);
        }
        if (seed % 4 === 0) {
          g.fillStyle(night ? 0x31283b : 0x382b2a, 0.58);
          g.fillRect(x + 5, y + 5, size + 5, 2);
        }
      }
    }

    // A bright grass cap and darker underside follow the sculpted ridge.
    g.lineStyle(11, night ? 0x37683b : 0x477a35, 1);
    g.beginPath();
    for (let i = 0; i < this.terrain.length; i++) {
      const x = i * TERRAIN_STEP;
      if (i === 0) g.moveTo(x, this.terrain[i]); else g.lineTo(x, this.terrain[i]);
    }
    g.strokePath();
    g.lineStyle(4, night ? 0x87c954 : 0xb4e65b, 1);
    g.beginPath();
    for (let i = 0; i < this.terrain.length; i++) {
      const x = i * TERRAIN_STEP;
      if (i === 0) g.moveTo(x, this.terrain[i] - 2); else g.lineTo(x, this.terrain[i] - 2);
    }
    g.strokePath();
  }

  private createBattleBlocks(): void {
    for (const id of [1, 2] as PlayerId[]) {
      for (const placed of playerById(id).structure) {
        const offset = id === 1 ? BATTLE_P1_BUILD_OFFSET : BATTLE_P2_BUILD_OFFSET;
        const x = BUILD_ORIGIN_X[id] + offset + placed.col * TILE_SIZE + TILE_SIZE / 2;
        const groundY = this.terrainAt(id === 1 ? BATTLE_P1_X : BATTLE_P2_X);
        const y = groundY - (BUILD_ROWS - placed.row - 0.5) * TILE_SIZE;
        const image = addBlockImage(this, x, y, placed.type, { size: TILE_SIZE }).setDepth(6);
        const crack = this.add.graphics().setPosition(x, y).setDepth(6.5);
        this.blocks.push({ ownerId: id, col: placed.col, row: placed.row, type: placed.type, hp: BLOCK_HP[placed.type], maxHp: BLOCK_HP[placed.type], image, crack, x, y });
      }
    }
  }

  private drawBattleBlockCracks(block: BattleBlock): void {
    const crack = block.crack;
    crack.clear();
    if (block.hp >= block.maxHp) return;

    const damageRatio = 1 - block.hp / block.maxHp;
    crack.lineStyle(3, gameState.nightMode ? 0x17172a : 0x151515, 0.94);
    crack.beginPath();
    crack.moveTo(-10, -14);
    crack.lineTo(-2, -4);
    crack.lineTo(-7, 3);
    crack.lineTo(2, 14);
    crack.strokePath();

    if (damageRatio >= 0.5) {
      crack.beginPath();
      crack.moveTo(10, -14);
      crack.lineTo(3, -5);
      crack.lineTo(9, 2);
      crack.lineTo(4, 9);
      crack.strokePath();
    }
    if (damageRatio >= 0.75) {
      crack.beginPath();
      crack.moveTo(-15, 6);
      crack.lineTo(-5, 2);
      crack.lineTo(1, 9);
      crack.lineTo(12, 5);
      crack.strokePath();
    }
  }

  private createHud(): void {
    this.hudGraphics = this.add.graphics().setDepth(27);
    this.playerHud = new PlayerStatusHud(this, 25);
    this.add.rectangle(GAME_WIDTH / 2, 49, 390, 72, 0x172632, 0.96).setStrokeStyle(3, 0x9bb6c5, 0.9).setDepth(25);
    const phaseAccent = this.add.graphics().setDepth(26);
    phaseAccent.lineStyle(3, 0xffd15d, 0.95)
      .lineBetween(GAME_WIDTH / 2 - 174, 49, GAME_WIDTH / 2 - 147, 49)
      .lineBetween(GAME_WIDTH / 2 + 147, 49, GAME_WIDTH / 2 + 174, 49);
    this.add.text(GAME_WIDTH / 2, 49, "BATTLE PHASE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "28px", color: "#ffe18c", stroke: "#17232c", strokeThickness: 6,
    }).setOrigin(0.5).setDepth(26);
    this.makeExitButton();

    this.add.rectangle(GAME_WIDTH / 2, 846, 1080, 104, 0x14212b, 0.96).setStrokeStyle(3, 0x8da5b3, 0.9).setDepth(25);
    this.add.rectangle(GAME_WIDTH / 2, 790, 860, 30, 0x1b2d38, 0.92).setStrokeStyle(1, 0x66818f, 0.75).setDepth(25);
    this.statusText = this.add.text(GAME_WIDTH / 2, 790,
      "WEAPON: CLICK CARD  |  AIM: HOLD + RELEASE  |  MOVE: P1 A/D, P2 LEFT/RIGHT  |  POWER: UP/DOWN", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "12px", color: "#e9f5f8", stroke: "#121920", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(27);
    this.makeWeaponButton(500, "shell");
    this.makeWeaponButton(650, "missile");
    this.makeWeaponButton(800, "boomerang");
    const fireButton = this.add.graphics().setDepth(26);
    fireButton.fillStyle(0x090f14, 0.58).fillRoundedRect(953, 821, 174, 66, 17);
    fireButton.fillStyle(0x682b25, 1).fillRoundedRect(948, 817, 174, 66, 17);
    fireButton.lineStyle(3, 0xffb36b, 1).strokeRoundedRect(948, 817, 174, 66, 17);
    fireButton.fillStyle(0xef7c46, 0.85).fillRoundedRect(956, 824, 158, 6, 3);
    this.add.text(1012, 851, "FIRE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "23px", color: "#fff7eb", stroke: "#502218", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(27);
    const spaceKey = this.add.graphics().setDepth(27);
    spaceKey.fillStyle(0x2b1718, 1).fillRoundedRect(1050, 837, 60, 27, 8);
    spaceKey.lineStyle(1, 0xffd0a0, 0.9).strokeRoundedRect(1050, 837, 60, 27, 8);
    this.add.text(1080, 850, "SPACE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "11px", color: "#ffe4c7",
    }).setOrigin(0.5).setDepth(28);
    this.powerLabel = this.add.text(1233, 814, "POWER", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "11px", color: "#ffe8a3",
      stroke: "#111923", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(27);
  }

  private makeWeaponButton(x: number, type: WeaponType): void {
    const glow = this.add.graphics().setDepth(25);
    const background = this.add.graphics().setDepth(26);
    const hitArea = this.add.rectangle(x, 846, 124, 82, 0xffffff, 0.001)
      .setDepth(28).setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", () => this.selectWeapon(type));
    const iconSize: Record<WeaponType, [number, number]> = {
      shell: [70, 32], missile: [76, 30], boomerang: [38, 38],
    };
    const [iconWidth, iconHeight] = iconSize[type];
    const icon = this.add.image(x, 824, `projectile-${type}`)
      .setDisplaySize(iconWidth, iconHeight).setDepth(27);
    const label = this.add.text(x, 850, WEAPONS[type].label.toUpperCase(), {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "11px", color: "#edf6f8",
      stroke: "#101820", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(28);
    const ammoText = this.add.text(x + 43, 874, type === "shell" ? "∞" : `×${playerById(gameState.currentPlayer).ammo[type]}`, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "13px", color: "#ffffff", stroke: "#10151a", strokeThickness: 3,
      backgroundColor: "#101820",
      padding: { left: 4, right: 4, top: 1, bottom: 1 },
    }).setOrigin(1, 0.5).setDepth(28);
    const visual: WeaponButtonVisual = { background, glow, hitArea, icon, label, ammoText };
    this.weaponButtons[type] = visual;
  }

  private makeExitButton(): void {
    const x = 1450;
    const y = 850;
    const frame = this.add.graphics().setDepth(26);
    frame.fillStyle(0x080d12, 0.55).fillRoundedRect(x - 54, y - 24, 118, 56, 15);
    frame.fillStyle(0x303a43, 1).fillRoundedRect(x - 59, y - 28, 118, 56, 15);
    frame.lineStyle(2, 0xd3a95c, 0.95).strokeRoundedRect(x - 59, y - 28, 118, 56, 15);
    frame.fillStyle(0xe6b75b, 0.55).fillRoundedRect(x - 52, y - 22, 104, 4, 2);
    const hitArea = this.add.rectangle(x, y, 118, 56, 0xffffff, 0.001)
      .setDepth(28).setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", () => this.scene.start("MenuScene"));
    this.add.text(x, y, "EXIT", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "18px", color: "#fff4d6",
      stroke: "#17232c", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(29);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.resolving || this.activeProjectile || this.firedThisTurn) return;
    // Weapon buttons remain clickable and do not start an aiming drag.
    if (pointer.y >= 800) {
      if (pointer.x >= 438 && pointer.x < 562) this.selectWeapon("shell");
      else if (pointer.x >= 588 && pointer.x < 712) this.selectWeapon("missile");
      else if (pointer.x >= 738 && pointer.x < 862) this.selectWeapon("boomerang");
      else if (pointer.x >= 945 && pointer.x < 1125) {
        this.fireButtonPointerId = pointer.id;
      }
      return;
    }

    // Hold anywhere in the arena to set cannon angle; release to shoot.
    this.isAiming = true;
    this.aimPointerId = pointer.id;
    this.chargeBonus = 0;
    const point = this.battleWorldPoint(pointer);
    this.currentAimAngle = this.aimAngle(gameState.currentPlayer, point.x, point.y);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.fireButtonPointerId === pointer.id) {
      this.fireButtonPointerId = null;
      this.cancelAim();
      if (pointer.x >= 945 && pointer.x < 1125 && pointer.y >= 810) {
        this.fireWeapon(undefined, undefined, this.currentAimAngle, this.power);
      }
      return;
    }
    if (!this.isAiming || (this.aimPointerId !== null && pointer.id !== this.aimPointerId)) return;
    if (!this.resolving && !this.activeProjectile) {
      const point = this.battleWorldPoint(pointer);
      this.currentAimAngle = this.aimAngle(gameState.currentPlayer, point.x, point.y);
      const angle = this.currentAimAngle;
      const shotPower = this.effectivePower();
      this.cancelAim();
      this.fireWeapon(undefined, undefined, angle, shotPower);
    } else {
      this.cancelAim();
    }
  }

  private handlePointerUpOutside(pointer: Phaser.Input.Pointer): void {
    if (this.fireButtonPointerId === pointer.id) this.fireButtonPointerId = null;
    if (this.isAiming && (this.aimPointerId === null || pointer.id === this.aimPointerId)) this.cancelAim();
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
    const player = playerById(gameState.currentPlayer);
    if (type !== "shell" && player.ammo[type] <= 0) {
      this.fireMessage = `No ${WEAPONS[type].label.toLowerCase()} ammo left.`;
      this.updateHud();
      return;
    }
    gameState.selectedWeapon = type;
    this.updateHud();
  }

  private updateHud(_deltaSeconds = 0): void {
    this.hudGraphics.clear();
    this.playerHud.update(gameState.currentPlayer);
    this.statusText.setText(this.fireMessage ||
      "WEAPON: CLICK CARD  |  AIM: HOLD + RELEASE  |  MOVE: P1 A/D, P2 LEFT/RIGHT  |  POWER: UP/DOWN");
    const weaponButtons: Array<[number, WeaponType]> = [[500, "shell"], [650, "missile"], [800, "boomerang"]];
    for (const [x, type] of weaponButtons) {
      const selected = gameState.selectedWeapon === type;
      const visual = this.weaponButtons[type];
      const player = playerById(gameState.currentPlayer);
      const available = type === "shell" || player.ammo[type] > 0;
      const dimAlpha = available ? 1 : 0.32;
      if (visual) {
        const left = x - 62;
        const top = 805;
        visual.glow.clear();
        if (selected && available) {
          visual.glow.fillStyle(WEAPONS[type].color, 0.14).fillRoundedRect(left - 5, top - 4, 134, 90, 18);
          visual.glow.lineStyle(3, WEAPONS[type].color, 0.9).strokeRoundedRect(left - 5, top - 4, 134, 90, 18);
        }
        visual.background.clear();
        visual.background.fillStyle(0x090f14, 0.55).fillRoundedRect(left + 4, top + 6, 124, 82, 16);
        visual.background.fillStyle(selected && available ? 0x263641 : 0x1a2831, 0.98)
          .fillRoundedRect(left, top, 124, 82, 16);
        visual.background.lineStyle(selected && available ? 3 : 2,
          selected && available ? WEAPONS[type].color : 0x83949d,
          selected && available ? 1 : 0.72).strokeRoundedRect(left, top, 124, 82, 16);
        visual.background.fillStyle(WEAPONS[type].color, selected && available ? 0.78 : 0.38)
          .fillRoundedRect(left + 8, top + 7, 108, 5, 3);
        visual.background.setAlpha(dimAlpha);
      }
      visual?.icon.setAlpha(dimAlpha);
      visual?.label.setAlpha(dimAlpha);
      visual?.ammoText.setAlpha(dimAlpha).setText(type === "shell" ? "∞" : `×${player.ammo[type]}`);
    }
    this.drawPowerMeter();
  }

  private drawPowerMeter(): void {
    const x = 1138;
    const y = 832;
    const width = 190;
    const height = 34;
    const inset = 5;
    const innerWidth = width - inset * 2;
    const baseRatio = clamp(this.power / 1.5, 0, 1);
    const chargeRatio = clamp(this.chargeBonus / this.maxChargeBonus, 0, 1);
    const fillRatio = this.isAiming ? chargeRatio : 0;
    const fillWidth = innerWidth * fillRatio;
    const glowColor = this.isAiming ? (chargeRatio >= 0.8 ? 0xff7838 : 0x45d9ff) : 0xffa51f;
    const glowAlpha = this.isAiming ? 0.18 + chargeRatio * 0.48 : 0.06;
    this.powerLabel?.setText(this.isAiming ? "CHARGING" : "POWER");
    this.hudGraphics.fillStyle(glowColor, glowAlpha * 0.42).fillRoundedRect(x - 12, y - 10, width + 24, height + 20, 14);
    this.hudGraphics.fillStyle(glowColor, glowAlpha).fillRoundedRect(x - 5, y - 4, width + 10, height + 8, 10);
    this.hudGraphics.fillStyle(0x111923, 1).fillRoundedRect(x, y, width, height, 7);
    this.hudGraphics.fillStyle(0x080e17, 1).fillRoundedRect(x + inset, y + inset, innerWidth, height - inset * 2, 4);
    if (fillWidth > 0) {
      const fillColor = this.isAiming ? (chargeRatio >= 0.8 ? 0xff7838 : 0x45d9ff) : 0xffb91f;
      this.hudGraphics.fillStyle(fillColor, 1).fillRoundedRect(x + inset, y + inset, fillWidth, height - inset * 2, 4);
      this.hudGraphics.fillStyle(0xfff6b0, 0.98).fillRoundedRect(x + inset + 3, y + inset + 2, Math.max(0, fillWidth - 6), 5, 2);
    }
    if (this.isAiming) {
      const markerX = x + inset + innerWidth * baseRatio;
      this.hudGraphics.lineStyle(2, 0xffcf66, 1).lineBetween(markerX, y + 2, markerX, y + height - 2);
    }
    this.hudGraphics.lineStyle(2, this.isAiming ? glowColor : 0xffe8a3, this.isAiming ? 0.9 : 1)
      .strokeRoundedRect(x, y, width, height, 7);
    this.hudGraphics.lineStyle(1, 0x622c11, 0.75);
    for (const marker of [0.25, 0.5, 0.75]) {
      const markerX = x + inset + innerWidth * marker;
      this.hudGraphics.lineBetween(markerX, y + inset + 1, markerX, y + height - inset - 1);
    }
  }

  private drawAimGuide(): void {
    this.aimGraphics.clear();
    const id = gameState.currentPlayer;
    const origin = this.muzzlePosition(id);
    this.drawTrajectory(origin.x, origin.y, this.currentAimAngle, this.power, 0x79f4ff, 0.56);
  }

  private drawTrajectoryPreview(): void {
    this.aimGraphics.clear();
    const id = gameState.currentPlayer;
    const origin = this.muzzlePosition(id);
    this.drawTrajectory(origin.x, origin.y, this.currentAimAngle, this.effectivePower(), 0x91ffd0, 1);
    const pointer = this.input.activePointer;
    const aimPoint = this.battleWorldPoint(pointer);
    this.aimGraphics.lineStyle(2, 0xfff6d1, 0.9);
    this.aimGraphics.strokeCircle(aimPoint.x, aimPoint.y, 9);
    this.aimGraphics.lineBetween(aimPoint.x - 13, aimPoint.y, aimPoint.x - 6, aimPoint.y);
    this.aimGraphics.lineBetween(aimPoint.x + 6, aimPoint.y, aimPoint.x + 13, aimPoint.y);
    this.aimGraphics.lineBetween(aimPoint.x, aimPoint.y - 13, aimPoint.x, aimPoint.y - 6);
    this.aimGraphics.lineBetween(aimPoint.x, aimPoint.y + 6, aimPoint.x, aimPoint.y + 13);

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

    const sampleCount = boomerang ? 100 : gameState.selectedWeapon === "missile" ? 96 : 48;
    for (let i = 1; i <= sampleCount; i++) {
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

      if (i % 2 === 0) {
        this.aimGraphics.fillStyle(color, alpha * 0.28).fillCircle(x, y, 6);
        this.aimGraphics.fillStyle(color, alpha).fillCircle(x, y, 3.8);
        this.aimGraphics.fillStyle(0xffffff, alpha * 0.92).fillCircle(x, y, 1.45);
      }
      if (returning && distance(x, y, enemyX, this.terrainAt(enemyX) - 30) < 29) break;
    }
  }

  private fireWeapon(pointerX?: number, pointerY?: number, angleOverride?: number, powerOverride?: number): void {
    if (this.resolving || this.activeProjectile || this.firedThisTurn) return;
    const now = this.time.now;
    if (now - this.lastShotAt < 250) return;
    const ownerId = gameState.currentPlayer;
    const player = playerById(ownerId);
    const weaponType = gameState.selectedWeapon;
    if (weaponType !== "shell" && player.ammo[weaponType] <= 0) {
      this.fireMessage = `No ${WEAPONS[weaponType].label.toLowerCase()} ammo left. Choose another weapon.`;
      this.updateHud();
      return;
    }
    this.firedThisTurn = true;
    this.lastShotAt = now;
    if (weaponType !== "shell") player.ammo[weaponType] -= 1;
    this.updateHud();
    const pointer = this.input.activePointer;
    const aimPoint = this.battleWorldPoint(pointer);
    const aimX = pointerX ?? aimPoint.x;
    const aimY = pointerY ?? aimPoint.y;
    const origin = this.muzzlePosition(ownerId);
    const angle = angleOverride ?? this.aimAngle(ownerId, aimX, aimY);
    const spec = WEAPONS[weaponType];
    playShot(this, weaponType);
    this.stopTravelWhoosh?.();
    this.stopTravelWhoosh = startTravelWhoosh(this, weaponType);
    const speed = spec.speed * clamp(powerOverride ?? this.power, 0.5, 1.5);
    const dir = ownerId === 1 ? 1 : -1;
    this.aimGraphics.clear();
    const projectileImage = this.add.image(origin.x, origin.y, `projectile-${weaponType}`)
      .setScale(0.55).setDepth(16)
      .setTint(gameState.nightMode ? spec.color : 0xffffff);
    projectileImage.setRotation(angle);
    this.tweens.add({ targets: projectileImage, scale: 1.15, duration: 240, ease: "Cubic.easeOut" });
    // Keep exactly one visible moving shot. Night mode tints that sprite;
    // a second halo sprite made the projectile look like a duplicate.
    const glowImage = null;
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
    this.cameras.main.stopFollow();
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
    const trailStep = projectile.weapon === "shell" ? 0.035 : 0.024;
    while (projectile.trailClock >= trailStep) {
      projectile.trailClock -= trailStep;
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
    const isSmoke = projectile.weapon === "shell";
    const isFire = projectile.weapon === "missile";
    const color = isSmoke
      ? Phaser.Utils.Array.GetRandom([0x544d49, 0x71675f, 0x95877b])
      : projectile.weapon === "boomerang"
        ? Phaser.Utils.Array.GetRandom([0x82f6ff, 0x5a9cff, 0xc5ffff])
        : Phaser.Utils.Array.GetRandom([0xffb21f, 0xff6926, 0xffe66e]);
    const size = isSmoke ? Phaser.Math.Between(5, 9)
      : projectile.weapon === "missile" ? Phaser.Math.Between(5, 10) : Phaser.Math.Between(4, 7);
    const particle = this.add.circle(
      projectile.x + backX * (isSmoke ? 22 : 18) + Phaser.Math.Between(-4, 4),
      projectile.y + backY * (isSmoke ? 22 : 18) + Phaser.Math.Between(-4, 4),
      size,
      color,
      isSmoke ? 0.58 : isFire ? 0.98 : 0.86,
    ).setDepth(17);
    if (gameState.nightMode && !isSmoke) particle.setBlendMode(Phaser.BlendModes.ADD);
    if (isFire && Math.random() > 0.5) particle.setStrokeStyle(2, 0xffed75, 0.8);
    this.tweens.add({
      targets: particle,
      x: particle.x + backX * Phaser.Math.Between(isSmoke ? 38 : 24, isSmoke ? 68 : 48),
      y: particle.y + backY * (isSmoke ? 42 : 20) + Phaser.Math.Between(isSmoke ? -28 : -12, isSmoke ? 12 : 12),
      alpha: 0,
      scale: isSmoke ? Phaser.Math.FloatBetween(2, 3) : 0.12,
      duration: isSmoke ? Phaser.Math.Between(650, 950) : projectile.weapon === "missile" ? 480 : 360,
      ease: isSmoke ? "Sine.easeOut" : "Cubic.easeOut",
      onComplete: () => particle.destroy(),
    });
  }

  private resolveImpact(x: number, y: number, projectile: ProjectileState, directTank: PlayerId | null): void {
    if (this.resolving) return;
    this.resolving = true;
    this.stopTravelWhoosh?.();
    this.stopTravelWhoosh = undefined;
    if (projectile.weapon === "shell") this.sound.play("shell-hit-sfx", { volume: 1 });
    else if (projectile.weapon === "missile") this.sound.play("missile-hit-sfx", { volume: 1 });
    else playImpact(this, projectile.weapon);
    const enemyId = otherPlayerId(projectile.ownerId);
    for (const block of [...this.blocks]) {
      if (block.ownerId === projectile.ownerId) continue;
      const d = distance(x, y, block.x, block.y);
      if (d > projectile.radius + TILE_SIZE * 0.62) continue;
      const falloff = clamp(1 - d / (projectile.radius + TILE_SIZE * 0.62), 0.15, 1);
      const blockDamage = Math.max(1, Math.round(projectile.damage * falloff));
      block.hp -= blockDamage;
      block.image.setAlpha(clamp(0.48 + 0.52 * (block.hp / BLOCK_HP[block.type]), 0.18, 1));
      this.drawBattleBlockCracks(block);
      this.emitBlockParticles(block.x, block.y, block.type === "dirt" ? 0xc8915f : block.type === "stone" ? 0xc4d0d5 : 0xb7a4e4, block.hp <= 0 ? 26 : 9);
      if (block.hp > 0) {
        this.tweens.add({ targets: [block.image, block.crack], angle: { from: -5, to: 5 }, yoyo: true, duration: 70, repeat: 1 });
      }
      if (block.hp <= 0) {
        this.tweens.add({
          targets: [block.image, block.crack],
          scale: 0.12,
          angle: Phaser.Math.Between(-12, 12),
          alpha: 0,
          duration: 240,
          onComplete: () => {
            block.image.destroy();
            block.crack.destroy();
          },
        });
        this.blocks = this.blocks.filter((entry) => entry !== block);
        const ownerStructure = playerById(block.ownerId).structure;
        const index = ownerStructure.findIndex((entry) => entry.col === block.col && entry.row === block.row);
        if (index >= 0) ownerStructure.splice(index, 1);
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
        if (player.hp > 0) this.animateTankHit(id, x, projectile.radius, projectile.ownerId, isDirect);
      }
    }

    const eliminatedIds = ([1, 2] as PlayerId[]).filter((id) => playerById(id).hp <= 0);
    this.fireMessage = `${WEAPONS[projectile.weapon].label} impact • ${projectile.damage} damage • crater radius ${projectile.radius}px`;

    if (eliminatedIds.length > 0) {
      this.fireMessage = eliminatedIds.length === 2
        ? "BOTH TANKS DESTROYED!"
        : `P${eliminatedIds[0]} TANK DESTROYED!`;
      eliminatedIds.forEach((id) => this.showTankElimination(id));
      this.zoomToElimination(eliminatedIds);
    }

    this.showExplosion(x, y, projectile.radius, WEAPONS[projectile.weapon].color);
    this.cameras.main.shake(
      eliminatedIds.length > 0 ? 950 : 240,
      eliminatedIds.length > 0 ? 0.035 : directTank ? 0.012 : 0.008,
    );
    projectile.image.destroy();
    projectile.glowImage?.destroy();
    this.activeProjectile = null;
    this.cameras.main.stopFollow();
    this.updateHud();

    this.time.delayedCall(eliminatedIds.length > 0 ? 4500 : 420, () => {
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
        this.firedThisTurn = false;
        this.fireMessage = `P${gameState.currentPlayer} turn — choose a weapon and fire.`;
        this.updateHud();
      });
    });
  }

  private resolveMiss(projectile: ProjectileState): void {
    if (this.resolving) return;
    this.resolving = true;
    this.stopTravelWhoosh?.();
    this.stopTravelWhoosh = undefined;
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
        this.firedThisTurn = false;
        this.updateHud();
      });
    });
  }

  private animateTankHit(id: PlayerId, impactX: number, impactRadius: number, attackerId: PlayerId, isDirect: boolean): void {
    const tank = this.tanks[id];
    const halfWidth = tank.displayWidth / 2;
    const minX = id === 1 ? halfWidth + TANK_EDGE_MARGIN : BATTLE_WORLD_WIDTH / 2 + halfWidth;
    const maxX = id === 1 ? BATTLE_WORLD_WIDTH / 2 - halfWidth : BATTLE_WORLD_WIDTH - halfWidth - TANK_EDGE_MARGIN;
    const awayDirection = Math.sign(tank.x - impactX) || Math.sign(tank.x - this.tanks[attackerId].x) || (id === 1 ? -1 : 1);
    const shove = clamp(18 + impactRadius * 0.3 + (isDirect ? 8 : 0), 20, 46);
    const desiredX = clamp(tank.x + awayDirection * shove, minX, maxX);

    // Walk the shove in small steps so the hit cannot push a tank through a block.
    let safeX = tank.x;
    const distanceToMove = Math.abs(desiredX - tank.x);
    for (let moved = Math.min(4, distanceToMove); moved <= distanceToMove; moved += 4) {
      const candidateX = tank.x + awayDirection * moved;
      if (this.tankOverlapsBlock(candidateX, this.terrainAt(candidateX), tank)) break;
      safeX = candidateX;
    }

    const lift = this.tankHitLift[id];
    this.tweens.killTweensOf(lift);
    lift.amount = 0;
    this.tweens.add({
      targets: lift,
      amount: clamp(18 + impactRadius * 0.42 + (isDirect ? 12 : 0), 24, 62),
      duration: 180,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => { lift.amount = 0; },
    });
    this.tweens.add({
      targets: tank,
      x: safeX,
      duration: 220,
      ease: "Cubic.easeOut",
    });
    this.tweens.add({
      targets: tank,
      angle: awayDirection * 5,
      duration: 65,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut",
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

  private showTankElimination(id: PlayerId): void {
    const tank = this.tanks[id];
    const x = tank.x;
    const groundY = this.terrainAt(x);
    const y = groundY - 27;

    this.showDeathBlast(x, y);

    this.tweens.add({
      targets: tank,
      x: x + (id === 1 ? -4 : 4),
      angle: { from: -5, to: 5 },
      duration: 65,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.tweens.add({
          targets: tank,
          alpha: 0,
          scale: 0.2,
          y: groundY + 8,
          duration: 360,
          ease: "Cubic.easeIn",
          onComplete: () => tank.setVisible(false),
        });
      },
    });

    this.time.delayedCall(360, () => this.showGravestone(x, groundY - 3));
  }

  private showDeathBlast(x: number, y: number): void {
    const outer = this.add.circle(x, y, 70, 0xff771c, 0.82)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(20)
      .setScale(0.1);
    const inner = this.add.circle(x, y, 38, 0xffef8a, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(21)
      .setScale(0.08);
    this.tweens.add({
      targets: outer,
      scale: 4.2,
      alpha: 0,
      duration: 1050,
      ease: "Cubic.easeOut",
      onComplete: () => outer.destroy(),
    });
    this.tweens.add({
      targets: inner,
      scale: 2.3,
      alpha: 0,
      duration: 430,
      ease: "Cubic.easeOut",
      onComplete: () => inner.destroy(),
    });

    const fireColors = [0xfff0a0, 0xffa324, 0xff5728, 0xffd24a];
    for (let i = 0; i < 72; i++) {
      const angle = (Math.PI * 2 * i) / 72 + Phaser.Math.FloatBetween(-0.16, 0.16);
      const distance = Phaser.Math.Between(100, 320);
      const spark = this.add.circle(
        x + Phaser.Math.Between(-24, 24),
        y + Phaser.Math.Between(-20, 20),
        Phaser.Math.Between(5, 13),
        fireColors[i % fireColors.length],
        1,
      ).setBlendMode(Phaser.BlendModes.ADD).setDepth(21);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - Phaser.Math.Between(15, 90),
        scale: 0.12,
        alpha: 0,
        duration: Phaser.Math.Between(650, 1250),
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }

    for (let i = 0; i < 20; i++) {
      const smoke = this.add.circle(
        x + Phaser.Math.Between(-42, 42),
        y + Phaser.Math.Between(-24, 24),
        Phaser.Math.Between(12, 24),
        i % 2 ? 0x3a3030 : 0x57403a,
        0.64,
      ).setDepth(19);
      this.tweens.add({
        targets: smoke,
        x: smoke.x + Phaser.Math.Between(-95, 95),
        y: smoke.y - Phaser.Math.Between(90, 230),
        scale: Phaser.Math.FloatBetween(1.6, 2.4),
        alpha: 0,
        duration: Phaser.Math.Between(900, 1550),
        ease: "Sine.easeOut",
        onComplete: () => smoke.destroy(),
      });
    }
  }

  private zoomToElimination(ids: PlayerId[]): void {
    const camera = this.cameras.main;
    const focusX = ids.reduce((sum, id) => sum + this.tanks[id].x, 0) / ids.length;
    const focusY = ids.reduce((sum, id) => sum + this.terrainAt(this.tanks[id].x) - 34, 0) / ids.length;
    const zoom = 1.5;
    const viewWidth = GAME_WIDTH / zoom;
    const viewHeight = GAME_HEIGHT / zoom;
    const scrollX = clamp(focusX - viewWidth / 2, 0, BATTLE_WORLD_WIDTH - viewWidth);
    const scrollY = clamp(focusY - viewHeight / 2, 0, GAME_HEIGHT - viewHeight);
    this.tweens.killTweensOf(camera);
    this.tweens.add({
      targets: camera,
      scrollX,
      scrollY,
      zoom,
      duration: 950,
      ease: "Cubic.easeInOut",
    });
  }

  private showGravestone(x: number, groundY: number): void {
    const stone = this.add.container(x, groundY + 15).setDepth(22).setAlpha(0).setScale(0.35);
    const art = this.add.graphics();
    art.fillStyle(0x4c5963, 1);
    art.fillRoundedRect(-40, -100, 80, 103, 26);
    art.lineStyle(4, 0xc7d1d5, 0.98);
    art.strokeRoundedRect(-40, -100, 80, 103, 26);
    art.fillStyle(0x303b43, 1);
    art.fillRect(-45, -8, 90, 13);
    art.lineStyle(3, 0x39434a, 1);
    art.lineBetween(-27, -27, 27, -27);
    stone.add(art);
    const inscription = this.add.text(0, -63, "R.I.P.", {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "21px",
      color: "#fff8dc",
      stroke: "#303b43",
      strokeThickness: 4,
    }).setOrigin(0.5);
    stone.add(inscription);
    this.tweens.add({
      targets: stone,
      y: groundY - 2,
      alpha: 1,
      scale: 1,
      duration: 420,
      ease: "Back.easeOut",
    });
  }

  private emitBlockParticles(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const size = Phaser.Math.Between(4, 8);
      const particle = this.add.rectangle(x, y, size, size, color, 1).setDepth(12);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-48, 48),
        y: y + Phaser.Math.Between(18, 78),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(600, 1000),
        ease: "Cubic.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private returnCameraToStart(onComplete?: () => void): void {
    const camera = this.cameras.main;
    camera.stopFollow();
    const zoom = this.battleCameraZoomForTanks();
    this.tweens.add({
      targets: camera,
      scrollX: this.battleCameraScrollX(zoom),
      zoom,
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

  private battleCameraZoomForTanks(): number {
    const left = this.tanks[1].x - this.tanks[1].displayWidth / 2 - TANK_EDGE_MARGIN;
    const right = this.tanks[2].x + this.tanks[2].displayWidth / 2 + TANK_EDGE_MARGIN;
    const span = Math.max(1, right - left);
    const minZoom = GAME_WIDTH / BATTLE_WORLD_WIDTH;
    return clamp(GAME_WIDTH / span, minZoom, BATTLE_BASE_ZOOM);
  }

  private muzzlePosition(id: PlayerId): { x: number; y: number } {
    const dir = id === 1 ? 1 : -1;
    const angle = id === gameState.currentPlayer ? this.currentAimAngle : -0.55;
    const pivotX = this.tanks[id].x + dir * 6;
    const pivotY = this.terrainAt(this.tanks[id].x) - 42 - this.tankHitLift[id].amount;
    const x = pivotX + dir * Math.cos(angle) * 34;
    const y = pivotY + Math.sin(angle) * 34;
    return { x, y };
  }

  private drawCannons(): void {
    this.cannonGraphics.clear();
    for (const id of [1, 2] as PlayerId[]) {
      if (playerById(id).hp <= 0) continue;
      const dir = id === 1 ? 1 : -1;
      const angle = id === gameState.currentPlayer ? this.currentAimAngle : -0.55;
      const x = this.tanks[id].x + dir * 6;
      const y = this.terrainAt(this.tanks[id].x) - 42 - this.tankHitLift[id].amount;
      const endX = x + dir * Math.cos(angle) * 34;
      const endY = y + Math.sin(angle) * 34;
      this.cannonGraphics.lineStyle(10, 0x111820, 1).lineBetween(x, y, endX, endY);
      this.cannonGraphics.lineStyle(6, 0xa8bac9, 1).lineBetween(x, y, endX, endY);
      this.cannonGraphics.lineStyle(2, 0xeff7ff, 0.9).lineBetween(x, y - 1, endX, endY - 1);
      this.cannonGraphics.fillStyle(0x283440, 1).fillCircle(endX, endY, 4);
      this.cannonGraphics.fillStyle(0xdce9f2, 1).fillCircle(endX, endY, 2);
    }
  }

  private battleWorldPoint(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
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

  private tankSlopeAngle(x: number, tank: Phaser.GameObjects.Image): number {
    // Sample beneath both ends of the hull so its base follows the ground plane.
    const halfSpan = tank.displayWidth * 0.38;
    const leftY = this.terrainAt(x - halfSpan);
    const rightY = this.terrainAt(x + halfSpan);
    return clamp(Math.atan2(rightY - leftY, halfSpan * 2), -0.32, 0.32);
  }

}
