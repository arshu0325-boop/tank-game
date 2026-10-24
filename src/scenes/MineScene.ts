import Phaser from "phaser";
import { addBlockImage, GAME_HEIGHT, GAME_WIDTH, MINE_COLS, MINE_ROWS, TILE_SIZE, drawSky, formatTime } from "../grid";
import { gameState, MAX_HP, playerById, type PlayerId, type TileType } from "../state";

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
const DRILL_CENTER_Y = -15;
const DRILL_TIP_X = DRILL_MOUNT_X + DRILL_WIDTH;
const DRILL_TIP_Y = DRILL_CENTER_Y;

export class MineScene extends Phaser.Scene {
  private cells = new Map<string, MineCell>();
  private elapsed = 0;
  private timeLeft = MINE_SECONDS;
  private transitioning = false;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private surfaceGraphics!: Phaser.GameObjects.Graphics;
  private timerGraphics!: Phaser.GameObjects.Graphics;
  private timeText!: Phaser.GameObjects.Text;
  private p1Label!: Phaser.GameObjects.Text;
  private p2Label!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private tanks!: Record<PlayerId, Phaser.GameObjects.Image>;
  private tankGlows?: Record<PlayerId, Phaser.GameObjects.Image>;
  private drills!: Record<PlayerId, Phaser.GameObjects.Image>;
  private surfaceRows: number[] = [];
  private facing: Record<PlayerId, -1 | 1> = { 1: 1, 2: -1 };
  private fallVelocity: Record<PlayerId, number> = { 1: 0, 2: 0 };
  private mineCooldown: Record<PlayerId, number> = { 1: 0, 2: 0 };
  private keys!: {
    p1Left: Phaser.Input.Keyboard.Key;
    p1Right: Phaser.Input.Keyboard.Key;
    p1Up: Phaser.Input.Keyboard.Key;
    p2Left: Phaser.Input.Keyboard.Key;
    p2Right: Phaser.Input.Keyboard.Key;
    p2Up: Phaser.Input.Keyboard.Key;
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

    drawSky(this);
    this.createWorld();
    if (gameState.nightMode) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a1550, 0.42).setDepth(14);
      this.tankGlows = {
        1: this.makeTankGlow(1, 0x28c5ff),
        2: this.makeTankGlow(2, 0xff5968),
      };
    }
    this.createHud();
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        p1Left: Phaser.Input.Keyboard.KeyCodes.A,
        p1Right: Phaser.Input.Keyboard.KeyCodes.D,
        p1Up: Phaser.Input.Keyboard.KeyCodes.W,
        p2Left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        p2Right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        p2Up: Phaser.Input.Keyboard.KeyCodes.UP,
        p1Mine: Phaser.Input.Keyboard.KeyCodes.F,
        p2Mine: Phaser.Input.Keyboard.KeyCodes.ENTER,
      }) as typeof this.keys;
    }
    this.hintText = this.add.text(GAME_WIDTH / 2, 210,
      "DRIVE: P1 A / D  •  P2 ← / →     CLIMB: P1 W  •  P2 ↑     DRILL: P1 F  •  P2 ENTER", {
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
    this.drawMineTimerBar();
    this.updateTankMovement(delta / 1000);
    this.syncTankGlows();
    this.drawDrills();
    this.updateHud();
    if (this.input.keyboard && this.keys) {
      for (const id of [1, 2] as PlayerId[]) {
        this.mineCooldown[id] = Math.max(0, this.mineCooldown[id] - delta / 1000);
        const drilling = id === 1 ? this.keys.p1Mine.isDown : this.keys.p2Mine.isDown;
        if (drilling && this.mineCooldown[id] <= 0) {
          this.mineAtFront(id);
          this.mineCooldown[id] = 0.28;
        }
      }
    }
    if (this.timeLeft <= 0) {
      this.transitioning = true;
      this.scene.start("BuildScene");
    }
  }

  private createWorld(): void {
    this.surfaceRows = [];
    for (let col = 0; col < MINE_COLS; col++) {
      const surface = Math.max(2, Math.min(5, 3 + Math.round(Math.sin(col * 0.31) * 1.15 + Math.sin(col * 0.12) * 0.65)));
      this.surfaceRows.push(surface);
      for (let row = surface; row < MINE_ROWS; row++) {
        let type: TileType;
        let ore: "iron" | "coal" | undefined;
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
    this.tanks = {
      1: this.add.image(p1X, p1Ground, playerById(1).tankTexture).setOrigin(0.5, 1).setScale(0.95).setDepth(8),
      2: this.add.image(p2X, p2Ground, playerById(2).tankTexture).setOrigin(0.5, 1).setScale(0.95).setFlipX(true).setDepth(8),
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

  private makeTankGlow(id: PlayerId, color: number): Phaser.GameObjects.Image {
    const tank = this.tanks[id];
    return this.add.image(tank.x, tank.y - 28, "night-halo")
      .setTint(color)
      .setDisplaySize(190, 96)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.24)
      .setDepth(14.5);
  }

  private syncTankGlows(): void {
    if (!this.tankGlows) return;
    for (const id of [1, 2] as PlayerId[]) {
      this.tankGlows[id].setPosition(this.tanks[id].x, this.tanks[id].y - 28);
    }
  }

  private createHud(): void {
    this.hudGraphics = this.add.graphics().setDepth(25);
    this.add.text(48, 27, "P1: Controller", this.panelTitleStyle()).setDepth(26);
    this.add.text(1305, 27, "P2: Duelist", this.panelTitleStyle()).setDepth(26);
    this.p1Label = this.add.text(48, 66, `HP ${MAX_HP}   Fuel 100`, this.panelDetailStyle()).setDepth(26);
    this.p2Label = this.add.text(1305, 66, `HP ${MAX_HP}   Fuel 100`, this.panelDetailStyle()).setDepth(26);
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
    this.resourceText = this.add.text(GAME_WIDTH / 2, 875, "", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "18px", color: "#f9f3dc",
      stroke: "#101820", strokeThickness: 4, align: "center",
    }).setOrigin(0.5).setDepth(27);
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
        tank.setFlipX(direction < 0);
        if (player.fuel > 0) {
          const minX = id === 1 ? 42 : GAME_WIDTH / 2 + 42;
          const maxX = id === 1 ? GAME_WIDTH / 2 - 42 : GAME_WIDTH - 42;
          const desiredMove = direction * MINE_MOVE_SPEED * safeDelta;
          const fuelMove = player.fuel / MINE_FUEL_PER_PIXEL;
          const move = Math.sign(desiredMove) * Math.min(Math.abs(desiredMove), fuelMove);
          const nextX = Phaser.Math.Clamp(tank.x + move, minX, maxX);
          const currentSupportY = this.tankSupportY(tank.x, id);
          const nextSupportY = this.tankSupportY(nextX, id);
          const steppingUp = nextSupportY < currentSupportY - 3;
          if (!steppingUp || climb) {
            const distanceMoved = Math.abs(nextX - tank.x);
            tank.x = nextX;
            player.fuel = Math.max(0, player.fuel - distanceMoved * MINE_FUEL_PER_PIXEL);
          }
        }
      }

      const supportY = this.tankSupportY(tank.x, id);
      if (tank.y < supportY) {
        this.fallVelocity[id] += 1500 * safeDelta;
        tank.y = Math.min(supportY, tank.y + this.fallVelocity[id] * safeDelta);
        if (tank.y >= supportY) this.fallVelocity[id] = 0;
      } else if (tank.y > supportY) {
        this.fallVelocity[id] = 0;
        if (climb) tank.y = Math.max(supportY, tank.y - 115 * safeDelta);
      } else {
        this.fallVelocity[id] = 0;
      }
    }
  }

  private tankSupportY(x: number, id: PlayerId): number {
    const firstColumn = id === 1 ? 0 : MINE_COLS / 2;
    const lastColumn = id === 1 ? MINE_COLS / 2 - 1 : MINE_COLS - 1;
    const leftColumn = Math.max(firstColumn, Math.floor((x - 52) / TILE_SIZE));
    const rightColumn = Math.min(lastColumn, Math.floor((x + 52) / TILE_SIZE));
    let highestSupportRow = MINE_ROWS;
    for (let col = leftColumn; col <= rightColumn; col++) {
      for (let row = 0; row < MINE_ROWS; row++) {
        if (this.cells.has(this.cellKey(col, row))) {
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
    for (let col = 0; col < MINE_COLS; col++) {
      const originalTopRow = this.surfaceRows[col];
      if (!this.cells.has(this.cellKey(col, originalTopRow))) continue;
      const y = MINE_ORIGIN_Y + originalTopRow * TILE_SIZE;
      this.surfaceGraphics.fillStyle(0x4d962f, 1).fillRect(col * TILE_SIZE, y - 5, TILE_SIZE, 5);
      this.surfaceGraphics.fillStyle(0x8bd64a, 1).fillRect(col * TILE_SIZE, y - 5, TILE_SIZE, 2);
    }
  }

  private drawDrills(): void {
    if (!this.drills || !this.tanks) return;
    for (const id of [1, 2] as PlayerId[]) {
      const tank = this.tanks[id];
      const dir = this.facing[id];
      const drilling = id === 1 ? this.keys?.p1Mine.isDown : this.keys?.p2Mine.isDown;
      const drill = this.drills[id];
      drill.setOrigin(dir === 1 ? 0 : 1, 0.5);
      drill.setFlipX(dir === -1);
      const vibration = drilling ? Math.sin(this.elapsed * 42) * 2 : 0;
      drill.setPosition(tank.x + dir * (DRILL_MOUNT_X + vibration), tank.y + DRILL_CENTER_Y);
      drill.setAngle(0);
    }
  }

  private mineAtFront(id: PlayerId): void {
    if (this.transitioning) return;
    const tank = this.tanks[id];
    const dir = this.facing[id];
    const tipX = tank.x + dir * DRILL_TIP_X;
    const tipY = tank.y + DRILL_TIP_Y;
    if (tipX < 0 || tipX >= GAME_WIDTH || tipY < MINE_ORIGIN_Y || tipY >= MINE_ORIGIN_Y + MINE_ROWS * TILE_SIZE) return;

    // Only mine a cell the drill head is visibly overlapping. There is no
    // automatic scan down the column, so deeper blocks need the tank to fall
    // and bring its drill to that depth first.
    const hitLeft = dir === 1 ? tipX - 24 : tipX;
    const hitRight = dir === 1 ? tipX : tipX + 24;
    const hitTop = tipY - 16;
    const hitBottom = tipY + 16;
    const minCol = Math.max(id === 1 ? 0 : MINE_COLS / 2, Math.floor(hitLeft / TILE_SIZE));
    const maxCol = Math.min(id === 1 ? MINE_COLS / 2 - 1 : MINE_COLS - 1, Math.floor((hitRight - 0.01) / TILE_SIZE));
    const minRow = Math.max(0, Math.floor((hitTop - MINE_ORIGIN_Y) / TILE_SIZE));
    const maxRow = Math.min(MINE_ROWS - 1, Math.floor((hitBottom - 0.01 - MINE_ORIGIN_Y) / TILE_SIZE));
    const contacts: Array<{ cell: MineCell; distance: number }> = [];
    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const cell = this.cells.get(this.cellKey(col, row));
        if (cell) {
          const centerX = col * TILE_SIZE + TILE_SIZE / 2;
          const centerY = MINE_ORIGIN_Y + row * TILE_SIZE + TILE_SIZE / 2;
          contacts.push({ cell, distance: Phaser.Math.Distance.Between(centerX, centerY, tipX, tipY) });
        }
      }
    }
    const target = contacts.sort((a, b) => a.distance - b.distance)[0]?.cell;
    if (!target) return;

    const x = target.col * TILE_SIZE + TILE_SIZE / 2;
    const y = MINE_ORIGIN_Y + target.row * TILE_SIZE + TILE_SIZE / 2;
    target.hp--;
    target.image.setAlpha(0.55 + 0.45 * target.hp / target.maxHp);
    this.drawMiningCracks(target);
    this.emitBlockParticles(x, y, target.type === "dirt" ? 0xb7794c : target.type === "stone" ? 0x9ca4a7 : 0x9c82c2, 5);
    this.tweens.add({ targets: target.image, angle: { from: -4, to: 4 }, yoyo: true, duration: 45, repeat: 1 });
    if (target.hp > 0) {
      this.showMiningMessage(x, y - 12, `${target.hp} HP`, id === 1 ? "#73d8ff" : "#ff9a8c");
      return;
    }

    const player = playerById(id);
    player.inventory[target.type] += 1;
    if (target.ore === "iron") player.iron += 1;
    this.emitBlockParticles(x, y, target.ore === "iron" ? 0xffd05b : 0xd3a06e, 14);
    this.tweens.add({
      targets: target.image, scale: 0.2, alpha: 0, duration: 120,
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
      const particle = this.add.rectangle(x, y, Phaser.Math.Between(3, 6), Phaser.Math.Between(3, 6), color, 1).setDepth(10);
      const drift = Phaser.Math.Between(-30, 30);
      this.tweens.add({
        targets: particle,
        x: x + drift,
        y: y + Phaser.Math.Between(12, 48),
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(280, 520),
        ease: "Cubic.easeIn",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private updateHud(): void {
    this.hudGraphics.clear();
    const p1 = playerById(1);
    const p2 = playerById(2);
    this.hudGraphics.fillStyle(0x163047, 0.92).fillRoundedRect(18, 16, 306, 94, 14);
    this.hudGraphics.lineStyle(3, 0x3098f5, 1).strokeRoundedRect(18, 16, 306, 94, 14);
    this.hudGraphics.fillStyle(0x462b2b, 0.92).fillRoundedRect(1276, 16, 306, 94, 14);
    this.hudGraphics.lineStyle(3, 0xf05252, 1).strokeRoundedRect(1276, 16, 306, 94, 14);
    this.drawBar(165, 64, 145, 12, p1.hp / MAX_HP, 0x4fd65c);
    this.drawBar(165, 88, 145, 12, p1.fuel / 100, 0xf6bd43);
    this.drawBar(1420, 64, 145, 12, p2.hp / MAX_HP, 0x4fd65c);
    this.drawBar(1420, 88, 145, 12, p2.fuel / 100, 0xf6bd43);
    this.p1Label.setText(`HP ${p1.hp}   Fuel ${Math.ceil(p1.fuel)}`);
    this.p2Label.setText(`HP ${p2.hp}   Fuel ${Math.ceil(p2.fuel)}`);
    this.resourceText.setText(
      `P1  Dirt ${p1.inventory.dirt}  Stone ${p1.inventory.stone}  Obsidian ${p1.inventory.obsidian}  Iron ${p1.iron}` +
      `     |     P2  Dirt ${p2.inventory.dirt}  Stone ${p2.inventory.stone}  Obsidian ${p2.inventory.obsidian}  Iron ${p2.iron}`,
    );
  }

  private drawBar(x: number, y: number, w: number, h: number, ratio: number, color: number): void {
    const fillWidth = Math.max(0, (w - 4) * Phaser.Math.Clamp(ratio, 0, 1));
    if (fillWidth > 0) this.hudGraphics.fillStyle(color, 0.22).fillRoundedRect(x - 3, y - 3, fillWidth + 10, h + 6, 5);
    this.hudGraphics.fillStyle(0x12171b, 1).fillRect(x, y, w, h);
    this.hudGraphics.lineStyle(2, 0x090d10, 1).strokeRect(x, y, w, h);
    this.hudGraphics.fillStyle(color, 1).fillRect(x + 2, y + 2, fillWidth, h - 4);
  }

  private drawMineTimerBar(): void {
    if (!this.timerGraphics) return;
    const x = GAME_WIDTH / 2 - 160;
    const y = 126;
    const width = 320;
    const fill = width * Phaser.Math.Clamp(this.timeLeft / MINE_SECONDS, 0, 1);
    this.timerGraphics.clear();
    if (fill > 0) this.timerGraphics.fillStyle(0xffd34f, 0.3).fillRoundedRect(x - 4, y - 4, fill + 8, 20, 7);
    this.timerGraphics.fillStyle(0x15212a, 0.98).fillRoundedRect(x, y, width, 12, 5);
    this.timerGraphics.fillStyle(0xffd34f, 1).fillRoundedRect(x + 2, y + 2, Math.max(0, fill - 4), 8, 3);
    this.timerGraphics.lineStyle(1, 0xffef9a, 0.95).strokeRoundedRect(x, y, width, 12, 5);
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
