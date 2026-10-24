import Phaser from 'phaser';
import { GRID, PHASE_TIME, PHYSICS, TILES, WEAPONS, WeaponType } from '../config';
import { gameState, PlayerState } from '../state';

export class BattleScene extends Phaser.Scene {
  private currentTurn: 1 | 2 = 1;
  private selectedWeapon: WeaponType = 'shot';
  private turnTimeLeft: number = PHASE_TIME.battle;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private aimVx: number = 0;
  private aimVy: number = 0;
  private turnLocked: boolean = false;

  private gridGraphics!: Phaser.GameObjects.Graphics;
  private aimGraphics!: Phaser.GameObjects.Graphics;
  private projGraphics!: Phaser.GameObjects.Graphics;
  private p1Tank!: Phaser.GameObjects.Rectangle;
  private p2Tank!: Phaser.GameObjects.Rectangle;
  private topText!: Phaser.GameObjects.Text;
  private activeProjectile: any = null;

  constructor() { super('BattleScene'); }

  create() {
    this.currentTurn = 1;
    this.turnTimeLeft = PHASE_TIME.battle;
    this.activeProjectile = null;
    this.turnLocked = false;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x1e293b).setOrigin(0);
    this.gridGraphics = this.add.graphics();
    this.aimGraphics = this.add.graphics();
    this.projGraphics = this.add.graphics();

    this.p1Tank = this.add.rectangle(gameState.p1.x, gameState.p1.y, 48, 32, gameState.p1.color);
    this.p2Tank = this.add.rectangle(gameState.p2.x, gameState.p2.y, 48, 32, gameState.p2.color);

    this.topText = this.add.text(this.scale.width / 2, 20, '', { fontSize: '24px', color: '#fff' }).setOrigin(0.5);

    this.setupInputs();
    this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => {
        if (!this.activeProjectile && !this.turnLocked) {
          this.turnTimeLeft--;
          if (this.turnTimeLeft <= 0) this.switchTurn();
          this.updateHUD();
        }
      }
    });

    this.redrawGrid();
    this.updateHUD();
  }

  private setupInputs() {
    this.input.keyboard?.on('keydown-ONE', () => this.selectedWeapon = 'shot');
    this.input.keyboard?.on('keydown-TWO', () => this.selectedWeapon = 'boomerang');
    this.input.keyboard?.on('keydown-THREE', () => this.selectedWeapon = 'missile');

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.turnLocked || this.activeProjectile) return;
      this.isDragging = true;
      this.dragStartX = p.x;
      this.dragStartY = p.y;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dx = p.x - this.dragStartX;
      const dy = p.y - this.dragStartY;
      const dist = Math.min(Math.hypot(dx, dy), PHYSICS.maxDragDist);
      const angle = Math.atan2(dy, dx);
      const speed = (dist / PHYSICS.maxDragDist) * PHYSICS.maxPower;
      this.aimVx = Math.cos(angle) * speed;
      this.aimVy = Math.sin(angle) * speed;

      this.aimGraphics.clear();
      this.aimGraphics.fillStyle(0xffffff, 0.8);
      const startX = this.getActivePlayer().x;
      const startY = this.getActivePlayer().y - 20;
      for (let i = 1; i <= 25; i++) {
        const t = i * 0.06;
        this.aimGraphics.fillCircle(startX + this.aimVx * t, startY + this.aimVy * t + 0.5 * PHYSICS.gravity * t * t, 4);
      }
    });

    this.input.on('pointerup', () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.aimGraphics.clear();
      if (Math.hypot(this.aimVx, this.aimVy) > 80) this.fireProjectile();
    });
  }

  private fireProjectile() {
    this.activeProjectile = {
      x: this.getActivePlayer().x,
      y: this.getActivePlayer().y - 24,
      vx: this.aimVx,
      vy: this.aimVy,
      weapon: WEAPONS[this.selectedWeapon]
    };
    this.updateHUD();
  }

  update(time: number, delta: number) {
    if (!this.activeProjectile) return;
    const dt = delta / 1000;
    
    this.activeProjectile.x += this.activeProjectile.vx * dt;
    this.activeProjectile.y += this.activeProjectile.vy * dt;
    this.activeProjectile.vy += PHYSICS.gravity * dt; // Apply gravity

    this.projGraphics.clear();
    this.projGraphics.fillStyle(this.activeProjectile.weapon.color, 1);
    this.projGraphics.fillCircle(this.activeProjectile.x, this.activeProjectile.y, 6);

    // Floor collision or out of bounds
    if (this.activeProjectile.y > this.scale.height || this.activeProjectile.x < 0 || this.activeProjectile.x > this.scale.width) {
      this.endShot();
      return;
    }

    // Grid Collision
    const tileX = Math.floor(this.activeProjectile.x / GRID.tileSize);
    const tileY = Math.floor(this.activeProjectile.y / GRID.tileSize);
    if (tileY >= 0 && tileY < GRID.rows && tileX >= 0 && tileX < GRID.cols) {
      const cell = gameState.grid[tileY][tileX];
      if (cell.type !== 'empty') {
        cell.hp -= this.activeProjectile.weapon.dmg;
        if (cell.hp <= 0) cell.type = 'empty';
        this.redrawGrid();
        this.endShot();
        return;
      }
    }

    // Tank Collision
    const enemy = this.getEnemyPlayer();
    if (Math.abs(this.activeProjectile.x - enemy.x) < 24 && Math.abs(this.activeProjectile.y - enemy.y) < 16) {
      enemy.hp -= this.activeProjectile.weapon.dmg;
      if (enemy.hp <= 0) {
        gameState.winner = this.getActivePlayer().id;
        this.scene.start('ResultScene');
      } else {
        this.endShot();
      }
    }
  }

  private endShot() {
    this.activeProjectile = null;
    this.projGraphics.clear();
    this.turnLocked = true;
    this.time.delayedCall(500, () => this.switchTurn());
  }

  private switchTurn() {
    this.currentTurn = this.currentTurn === 1 ? 2 : 1;
    this.turnTimeLeft = PHASE_TIME.battle;
    this.turnLocked = false;
    this.updateHUD();
  }

  private redrawGrid() {
    this.gridGraphics.clear();
    for (let y = 0; y < GRID.rows; y++) {
      for (let x = 0; x < GRID.cols; x++) {
        const cell = gameState.grid[y][x];
        if (cell.type !== 'empty') {
          this.gridGraphics.fillStyle(TILES[cell.type].color, 1);
          this.gridGraphics.fillRect(x * GRID.tileSize, y * GRID.tileSize, GRID.tileSize, GRID.tileSize);
          this.gridGraphics.lineStyle(1, 0x000, 0.5);
          this.gridGraphics.strokeRect(x * GRID.tileSize, y * GRID.tileSize, GRID.tileSize, GRID.tileSize);
        }
      }
    }
  }

  private updateHUD() {
    const name = this.getActivePlayer().name;
    this.topText.setText(`TURN: ${name} | TIME: ${this.turnTimeLeft}s | WEAPON: ${WEAPONS[this.selectedWeapon].name}`);
  }

  private getActivePlayer(): PlayerState { return this.currentTurn === 1 ? gameState.p1 : gameState.p2; }
  private getEnemyPlayer(): PlayerState { return this.currentTurn === 1 ? gameState.p2 : gameState.p1; }
}