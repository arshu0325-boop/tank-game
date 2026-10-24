import Phaser from "phaser";
import {
  BLOCK_HP, BUILD_COLS, BUILD_ORIGIN_X, BUILD_ROWS, GAME_HEIGHT, GAME_WIDTH,
  TILE_SIZE, addBlockImage, baseTerrainY, clamp, distance, drawSky,
} from "../grid";
import { gameState, otherPlayerId, playerById, type PlayerId, type TileType, type WeaponType } from "../state";

const TERRAIN_STEP = 8;
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
  image: Phaser.GameObjects.Arc;
}

export class BattleScene extends Phaser.Scene {
  private terrain: number[] = [];
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private aimGraphics!: Phaser.GameObjects.Graphics;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private blocks: BattleBlock[] = [];
  private tanks!: Record<PlayerId, Phaser.GameObjects.Image>;
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
  private keys!: {
    one: Phaser.Input.Keyboard.Key;
    two: Phaser.Input.Keyboard.Key;
    three: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
  };
  private resolving = false;

  constructor() {
    super("BattleScene");
  }

  create(): void {
    gameState.selectedWeapon = "shell";
    gameState.round = 1;
    drawSky(this);
    this.createTerrain();
    this.drawTerrain();
    this.tanks = {
      1: this.add.image(280, this.terrainAt(280), "tank-blue").setOrigin(0.5, 1).setDepth(7),
      2: this.add.image(1320, this.terrainAt(1320), "tank-red").setOrigin(0.5, 1).setDepth(7),
    };
    this.createBattleBlocks();
    this.aimGraphics = this.add.graphics().setDepth(15);
    this.createHud();
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        one: Phaser.Input.Keyboard.KeyCodes.ONE,
        two: Phaser.Input.Keyboard.KeyCodes.TWO,
        three: Phaser.Input.Keyboard.KeyCodes.THREE,
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      }) as typeof this.keys;
    }
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    if (this.input.keyboard && this.keys) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.one)) this.selectWeapon("shell");
      if (Phaser.Input.Keyboard.JustDown(this.keys.two)) this.selectWeapon("missile");
      if (Phaser.Input.Keyboard.JustDown(this.keys.three)) this.selectWeapon("boomerang");
      if (Phaser.Input.Keyboard.JustDown(this.keys.up)) this.power = clamp(this.power + 0.06, 0.5, 1.2);
      if (Phaser.Input.Keyboard.JustDown(this.keys.down)) this.power = clamp(this.power - 0.06, 0.5, 1.2);
      if (Phaser.Input.Keyboard.JustDown(this.keys.space)) this.fireWeapon();
    }

    this.tanks[1].y = this.terrainAt(this.tanks[1].x);
    this.tanks[2].y = this.terrainAt(this.tanks[2].x);
    if (this.activeProjectile) this.updateProjectile(delta / 1000);
    else this.drawAimGuide();
    this.timerText.setText(`ROUND ${gameState.round}`);
    this.powerText.setText(`POWER  ${Math.round(this.power * 100)}%`);
    this.weaponText.setText(this.weaponStatusText());
  }

  private createTerrain(): void {
    this.terrain = [];
    for (let x = 0; x <= GAME_WIDTH; x += TERRAIN_STEP) this.terrain.push(baseTerrainY(x));
    this.terrainGraphics = this.add.graphics().setDepth(2);
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
      g.lineTo(GAME_WIDTH, GAME_HEIGHT);
      g.lineTo(0, GAME_HEIGHT);
      g.closePath();
      g.fillPath();
    };
    drawLayer(0, 0x80502f);
    drawLayer(80, 0x777a79);
    drawLayer(185, 0x4c4038);
    // Pixel-like mineral flecks make the exposed soil resemble a blocky sandbox world.
    for (let i = 0; i < 150; i++) {
      const x = (i * 97 + 31) % GAME_WIDTH;
      const surface = this.terrainAt(x);
      const y = surface + 24 + ((i * 47) % 165);
      if (y < GAME_HEIGHT - 5) {
        g.fillStyle(i % 3 === 0 ? 0x4d3829 : i % 3 === 1 ? 0xa06c43 : 0x5c6061, 0.7);
        g.fillRect(x, y, 4 + (i % 3) * 2, 3 + (i % 2) * 2);
      }
    }
    g.lineStyle(7, 0x4c8030, 1);
    g.beginPath();
    for (let i = 0; i < this.terrain.length; i++) {
      const x = i * TERRAIN_STEP;
      if (i === 0) g.moveTo(x, this.terrain[i]); else g.lineTo(x, this.terrain[i]);
    }
    g.strokePath();
    g.lineStyle(2, 0xb2d064, 0.9);
    g.beginPath();
    for (let i = 0; i < this.terrain.length; i++) {
      const x = i * TERRAIN_STEP;
      if (i === 0) g.moveTo(x, this.terrain[i] - 3); else g.lineTo(x, this.terrain[i] - 3);
    }
    g.strokePath();
  }

  private createBattleBlocks(): void {
    for (const id of [1, 2] as PlayerId[]) {
      for (const placed of playerById(id).structure) {
        const x = BUILD_ORIGIN_X[id] + placed.col * TILE_SIZE + TILE_SIZE / 2;
        const groundY = this.terrainAt(id === 1 ? 280 : 1320);
        const y = groundY - (BUILD_ROWS - placed.row - 0.5) * TILE_SIZE;
        const image = addBlockImage(this, x, y, placed.type, { size: TILE_SIZE }).setDepth(6);
        this.blocks.push({ ownerId: id, col: placed.col, row: placed.row, type: placed.type, hp: BLOCK_HP[placed.type], image, x, y });
      }
    }
  }

  private createHud(): void {
    this.hudGraphics = this.add.graphics().setDepth(25);
    this.add.text(47, 24, "P1: Controller", this.titleStyle()).setDepth(26);
    this.add.text(1302, 24, "P2: Duelist", this.titleStyle()).setDepth(26);
    this.p1Text = this.add.text(48, 60, "", this.detailStyle()).setDepth(26);
    this.p2Text = this.add.text(1303, 60, "", this.detailStyle()).setDepth(26);
    this.add.rectangle(GAME_WIDTH / 2, 43, 350, 65, 0x462917, 0.95).setStrokeStyle(4, 0xffb940, 1).setDepth(25);
    this.turnText = this.add.text(GAME_WIDTH / 2, 28, "BATTLE PHASE", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "28px", color: "#fff4e1", stroke: "#21170f", strokeThickness: 6,
    }).setOrigin(0.5).setDepth(26);
    this.timerText = this.add.text(GAME_WIDTH / 2, 66, "ROUND 1", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "21px", color: "#ffe12f", stroke: "#211d0a", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(26);

    this.add.rectangle(GAME_WIDTH / 2, 849, 1120, 94, 0x151a20, 0.95).setStrokeStyle(3, 0x899096, 1).setDepth(25);
    this.makeWeaponButton(650, "shell", "1  TANK SHOT", 0x5a4a26);
    this.makeWeaponButton(810, "missile", "2  MISSILE", 0x593321);
    this.makeWeaponButton(970, "boomerang", "3  BOOMERANG", 0x204b58);
    this.statusText = this.add.text(GAME_WIDTH / 2, 783, "", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "17px", color: "#fff5da", stroke: "#121920", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(27);
    this.powerText = this.add.text(1380, 786, "POWER 88%", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "18px", color: "#ffe56a", stroke: "#1e2020", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(27);
    this.weaponText = this.add.text(1380, 815, "TANK SHOT", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "15px", color: "#f4f4ee", stroke: "#1e2020", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(27);
    this.add.text(GAME_WIDTH / 2, 894, "Aim with mouse • Click / Space to fire • ↑/↓ power • 1/2/3 weapon", {
      fontFamily: "Arial", fontSize: "15px", color: "#d6e0e5", stroke: "#111820", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(27);
  }

  private makeWeaponButton(x: number, type: WeaponType, label: string, color: number): void {
    this.add.rectangle(x, 849, 150, 60, color, 1).setStrokeStyle(3, 0xb8bec1, 1).setDepth(26);
    this.add.text(x, 849, label, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: type === "boomerang" ? "13px" : "15px", color: "#ffffff", stroke: "#10151a", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(27);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.resolving || this.activeProjectile) return;
    if (pointer.y >= 810) {
      if (pointer.x >= 575 && pointer.x < 730) this.selectWeapon("shell");
      else if (pointer.x >= 735 && pointer.x < 890) this.selectWeapon("missile");
      else if (pointer.x >= 895 && pointer.x < 1050) this.selectWeapon("boomerang");
      return;
    }
    this.fireWeapon(pointer.x, pointer.y);
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

  private updateHud(): void {
    this.hudGraphics.clear();
    const p1 = playerById(1);
    const p2 = playerById(2);
    this.drawPlayerBars(20, 18, 305, p1.hp, p1.fuel, 0x2b92e8);
    this.drawPlayerBars(1275, 18, 305, p2.hp, p2.fuel, 0xe54848);
    this.p1Text.setText(`HP ${p1.hp}   Fuel ${p1.fuel}   M ${p1.charge.missile}%  B ${p1.charge.boomerang}%`);
    this.p2Text.setText(`HP ${p2.hp}   Fuel ${p2.fuel}   M ${p2.charge.missile}%  B ${p2.charge.boomerang}%`);
    this.turnText.setText(`P${gameState.currentPlayer} TURN`);
    this.statusText.setText(this.fireMessage);
    const weaponButtons: Array<[number, WeaponType]> = [[650, "shell"], [810, "missile"], [970, "boomerang"]];
    for (const [x, type] of weaponButtons) {
      const selected = gameState.selectedWeapon === type;
      this.hudGraphics.lineStyle(selected ? 4 : 1, selected ? 0x51dcff : 0x5d6469, selected ? 1 : 0.65);
      this.hudGraphics.strokeRoundedRect(x - 76, 817, 152, 64, 5);
    }
  }

  private drawPlayerBars(x: number, y: number, width: number, hp: number, fuel: number, accent: number): void {
    this.hudGraphics.fillStyle(0x111820, 0.8).fillRoundedRect(x, y, width, 88, 10);
    this.hudGraphics.lineStyle(3, accent, 1).strokeRoundedRect(x, y, width, 88, 10);
    this.drawBar(x + 145, y + 41, 142, 12, hp / 100, 0x4ed35a);
    this.drawBar(x + 145, y + 64, 142, 12, fuel / 100, 0xf6bf43);
  }

  private drawBar(x: number, y: number, w: number, h: number, ratio: number, color: number): void {
    this.hudGraphics.fillStyle(0x05080b, 1).fillRect(x, y, w, h);
    this.hudGraphics.lineStyle(2, 0x020405, 1).strokeRect(x, y, w, h);
    this.hudGraphics.fillStyle(color, 1).fillRect(x + 2, y + 2, Math.max(0, (w - 4) * ratio), h - 4);
  }

  private drawAimGuide(): void {
    this.aimGraphics.clear();
    const pointer = this.input.activePointer;
    const id = gameState.currentPlayer;
    const origin = this.muzzlePosition(id);
    const angle = this.aimAngle(id, pointer.x, pointer.y);
    const weapon = WEAPONS[gameState.selectedWeapon];
    const speed = weapon.speed * this.power;
    let x = origin.x;
    let y = origin.y;
    let vx = Math.cos(angle) * speed * (id === 1 ? 1 : -1);
    let vy = Math.sin(angle) * speed;
    this.aimGraphics.lineStyle(2, 0xffe7a5, 0.48);
    let previousX = x;
    let previousY = y;
    for (let i = 1; i <= 18; i++) {
      const t = 0.08;
      x += vx * t;
      y += vy * t;
      vy += weapon.gravity * t;
      if (x < 0 || x > GAME_WIDTH || y > this.terrainAt(clamp(x, 0, GAME_WIDTH)) || y > 800) break;
      if (i % 2 === 0) this.aimGraphics.strokeCircle(x, y, 2.2);
      previousX = x;
      previousY = y;
    }
    // A very faint barrel-to-cursor line helps show the current aim direction.
    this.aimGraphics.lineStyle(1, 0xffffff, 0.08).lineBetween(origin.x, origin.y, previousX, previousY);
  }

  private fireWeapon(pointerX?: number, pointerY?: number): void {
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
    const aimX = pointerX ?? pointer.x;
    const aimY = pointerY ?? pointer.y;
    const origin = this.muzzlePosition(ownerId);
    const angle = this.aimAngle(ownerId, aimX, aimY);
    const spec = WEAPONS[weaponType];
    const speed = spec.speed * this.power;
    const dir = ownerId === 1 ? 1 : -1;
    const projectileImage = this.add.circle(origin.x, origin.y, weaponType === "missile" ? 8 : 5, spec.color, 1)
      .setStrokeStyle(2, weaponType === "missile" ? 0x7b3016 : 0x18232b, 1).setDepth(16);
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
    };
    player.shotsFired += 1;
    player.fuel = Math.max(0, player.fuel - 2);
    this.fireMessage = `P${ownerId} fired ${spec.label.toLowerCase()} — wait for impact.`;
    this.updateHud();
  }

  private updateProjectile(deltaSeconds: number): void {
    const projectile = this.activeProjectile;
    if (!projectile) return;
    projectile.age += deltaSeconds;
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
      projectile.vx = (dx / len) * 640;
      projectile.vy = (dy / len) * 640;
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

    // A wall collision takes priority over the terrain check, allowing blocks to shield tanks.
    const hitBlock = this.blocks.find((block) =>
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
    const groundY = this.terrainAt(clamp(projectile.x, 0, GAME_WIDTH));
    if (projectile.y >= groundY) {
      this.resolveImpact(projectile.x, groundY, projectile, null);
      return;
    }
    if (projectile.x < -20 || projectile.x > GAME_WIDTH + 20 || projectile.y > GAME_HEIGHT + 10 || projectile.age > 5.5) {
      this.resolveMiss(projectile);
    }
  }

  private resolveImpact(x: number, y: number, projectile: ProjectileState, directTank: PlayerId | null): void {
    if (this.resolving) return;
    this.resolving = true;
    const enemyId = otherPlayerId(projectile.ownerId);
    let enemyWallHit = false;
    let wallBroken = false;

    for (const block of [...this.blocks]) {
      const d = distance(x, y, block.x, block.y);
      if (d > projectile.radius + TILE_SIZE * 0.62) continue;
      const falloff = clamp(1 - d / (projectile.radius + TILE_SIZE * 0.62), 0.15, 1);
      const blockDamage = Math.max(1, Math.round(projectile.damage * falloff));
      block.hp -= blockDamage;
      block.image.setAlpha(clamp(0.48 + 0.52 * (block.hp / BLOCK_HP[block.type]), 0.18, 1));
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
      attacker.charge.missile = Math.min(100, attacker.charge.missile + (wallBroken ? 48 : 30));
      attacker.charge.boomerang = Math.min(100, attacker.charge.boomerang + (wallBroken ? 38 : 22));
      this.fireMessage = wallBroken
        ? `Enemy block broken! Missile +${wallBroken ? 48 : 30}% • Boomerang +${wallBroken ? 38 : 22}%`
        : "Enemy wall hit! Missile and boomerang charge increased.";
    } else {
      this.fireMessage = `${WEAPONS[projectile.weapon].label} impact • ${projectile.damage} damage • crater radius ${projectile.radius}px`;
    }

    this.showExplosion(x, y, projectile.radius, WEAPONS[projectile.weapon].color);
    projectile.image.destroy();
    this.activeProjectile = null;
    this.updateHud();

    this.time.delayedCall(420, () => {
      this.resolving = false;
      const p1 = playerById(1);
      const p2 = playerById(2);
      if (p1.hp <= 0 || p2.hp <= 0) {
        gameState.winner = p1.hp === p2.hp ? 0 : p1.hp > p2.hp ? 1 : 2;
        this.scene.start("ResultScene");
        return;
      }
      gameState.currentPlayer = otherPlayerId(projectile.ownerId);
      gameState.round += 1;
      this.fireMessage = `P${gameState.currentPlayer} turn — ${this.weaponStatusText()}`;
      this.updateHud();
    });
  }

  private resolveMiss(projectile: ProjectileState): void {
    if (this.resolving) return;
    this.resolving = true;
    projectile.image.destroy();
    this.activeProjectile = null;
    this.fireMessage = "Miss! The next tank gets its turn.";
    this.updateHud();
    this.time.delayedCall(250, () => {
      gameState.currentPlayer = otherPlayerId(projectile.ownerId);
      gameState.round += 1;
      this.resolving = false;
      this.updateHud();
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
    ring.setScale(0.35);
    this.tweens.add({ targets: ring, scale: 1.45, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
    for (let i = 0; i < 9; i++) {
      const angle = (Math.PI * 2 * i) / 9;
      const spark = this.add.circle(x, y, i % 2 ? 3 : 4, i % 2 ? 0xffe3a3 : color, 1).setDepth(19);
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
