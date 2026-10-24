 import Phaser from 'phaser';
import { TILE_SIZE, GRID_W, GRID_H, PHASE_TIME } from './config';
import { game, type TileType } from './state';
import { drawWorld, groundHeight, getTile, setTile, inBounds, TANK_ROW } from './Grid';

const TYPES: TileType[] = ['dirt', 'stone', 'obsidian'];
const BUILD_RADIUS = 3;   // how many tiles around your tank you can build

interface Placed { x: number; y: number; type: TileType }

export class BuildScene extends Phaser.Scene {
  private turn = 0;
  private timeLeft = 0;
  private swapping = true;
  private finished = false;
  private selected = 0;
  private placed: Placed[] = [];

  private ghost!: Phaser.GameObjects.Image;
  private cover!: Phaser.GameObjects.Rectangle;
  private coverLabel!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private ready!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Rectangle;
  private overlayText!: Phaser.GameObjects.Text;

  constructor() { super('Build'); }

  create() {
    this.turn = 0;
    this.selected = 0;
    this.placed = [];
    this.finished = false;

    drawWorld(this);   // sky, hills, block zones and tanks (the Mine scene's sprites are gone)

    this.input.mouse?.disableContextMenu();

    const W = GRID_W * TILE_SIZE;
    const H = GRID_H * TILE_SIZE;

    this.ghost = this.add.image(0, 0, 'dirt').setOrigin(0).setAlpha(0.6).setDepth(5).setVisible(false);

    // hides the other player's half so their shelter stays a surprise
    this.cover = this.add.rectangle(0, 0, W / 2, H, 0x222222).setOrigin(0).setDepth(6);
    this.coverLabel = this.add.text(0, H / 2, 'Hidden', { fontSize: '32px', color: '#888888' })
      .setOrigin(0.5).setDepth(7);

    this.hud = this.add.text(10, 8, '', {
      fontSize: '20px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 8, y: 4 },
    }).setDepth(10);

    this.ready = this.add.text(W / 2, 60, '[ READY ]', {
      fontSize: '24px', backgroundColor: '#228855', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    this.ready.on('pointerdown', () => { if (!this.swapping) this.endTurn(); });

    this.overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.92).setOrigin(0).setDepth(20);
    this.overlayText = this.add.text(W / 2, H / 2, '', {
      fontSize: '32px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5).setDepth(21);

    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => (this.selected = 0));
    kb.on('keydown-TWO', () => (this.selected = 1));
    kb.on('keydown-THREE', () => (this.selected = 2));
    kb.on('keydown-SPACE', () => { if (this.swapping && !this.finished) this.startTurn(); });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onClick(pointer));

    this.showSwap();
  }

  update(_time: number, delta: number) {
    if (this.swapping) return;

    this.timeLeft -= delta / 1000;
    if (this.timeLeft <= 0) { this.endTurn(); return; }

    const inv = game.players[this.turn].inventory;
    this.hud.setText(
      `Player ${this.turn + 1} building  |  ${Math.ceil(this.timeLeft)}s  |  ` +
      `1 Dirt ${inv.dirt}   2 Stone ${inv.stone}   3 Obsidian ${inv.obsidian}  |  Selected: ${TYPES[this.selected]}`
    );

    const p = this.input.activePointer;
    const tx = Math.floor(p.x / TILE_SIZE);
    const ty = Math.floor(p.y / TILE_SIZE);
    if (!inBounds(tx, ty)) { this.ghost.setVisible(false); return; }

    this.ghost.setVisible(true)
      .setTexture(TYPES[this.selected])
      .setPosition(tx * TILE_SIZE, ty * TILE_SIZE);
    if (this.canPlace(tx, ty)) this.ghost.clearTint(); else this.ghost.setTint(0xff0000);
  }

  private canPlace(tx: number, ty: number): boolean {
    if (!inBounds(tx, ty) || getTile(tx, ty)) return false;
    const p = game.players[this.turn];
    if (Math.abs(tx - p.x) > BUILD_RADIUS || Math.abs(ty - TANK_ROW) > BUILD_RADIUS) return false;
    if (tx === p.x && ty === TANK_ROW) return false;                  // your own tank
    const dir = this.turn === 0 ? 1 : -1;
    if (tx === p.x + dir && ty === TANK_ROW) return false;            // keep the firing slot open
    if ((ty + 1) * TILE_SIZE > groundHeight(tx * TILE_SIZE + TILE_SIZE / 2)) return false;  // inside the ground
    return p.inventory[TYPES[this.selected]] > 0;
  }

  private onClick(pointer: Phaser.Input.Pointer) {
    if (this.swapping) return;
    if (this.ready.getBounds().contains(pointer.x, pointer.y)) return;

    const tx = Math.floor(pointer.x / TILE_SIZE);
    const ty = Math.floor(pointer.y / TILE_SIZE);
    const inv = game.players[this.turn].inventory;

    if (pointer.rightButtonDown()) {
      // undo: only blocks placed this phase, refund the cost
      const i = this.placed.findIndex(b => b.x === tx && b.y === ty);
      if (i === -1) return;
      const b = this.placed.splice(i, 1)[0];
      setTile(b.x, b.y, null);
      inv[b.type]++;
    } else if (pointer.leftButtonDown() && this.canPlace(tx, ty)) {
      const type = TYPES[this.selected];
      setTile(tx, ty, type);
      inv[type]--;
      this.placed.push({ x: tx, y: ty, type });
    }
  }

  private showSwap() {
    this.swapping = true;
    this.ghost.setVisible(false);
    this.overlay.setVisible(true);
    this.overlayText.setVisible(true).setText(
      `Player ${this.turn + 1}: your turn to build\n` +
      `Player ${2 - this.turn}: look away!\n\nPress SPACE to start`
    );
  }

  private startTurn() {
    this.swapping = false;
    this.overlay.setVisible(false);
    this.overlayText.setVisible(false);
    this.timeLeft = PHASE_TIME.build;
    this.selected = 0;
    this.placed = [];

    // hide the other player's half
    const half = (GRID_W * TILE_SIZE) / 2;
    const hideLeft = this.turn === 1;
    this.cover.setX(hideLeft ? 0 : half);
    this.coverLabel.setX(hideLeft ? half / 2 : half + half / 2);
  }

  private endTurn() {
    this.turn++;
    if (this.turn < 2) { this.showSwap(); return; }

    // both players are done
    this.finished = true;
    this.swapping = true;
    game.turn = 0;
    this.cover.setVisible(false);
    this.coverLabel.setVisible(false);
    this.ghost.setVisible(false);
    if (this.scene.manager.keys['Battle']) {
      this.scene.start('Battle');
    } else {
      this.hud.setText('Build phase done. (Battle scene not made yet)');
    }
  }
}