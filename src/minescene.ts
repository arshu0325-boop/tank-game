 import Phaser from 'phaser';
import { TILE_SIZE, GRID_W, TILES, PHASE_TIME } from './config';
import { game, type TileType } from './state';
import { setupMatch, drawWorld, getTile, setTile, ZONE_X, ZONE_W, ZONE_H, PAD_ROW } from './Grid';

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'drill', Phaser.Input.Keyboard.Key>;

const COLORS: Record<TileType, number> = { dirt: 0x8b5a2b, stone: 0x888888, obsidian: 0x3b1f5c };

export class MineScene extends Phaser.Scene {
  private cursor = [{ cx: 2, cy: 0 }, { cx: 2, cy: 0 }];   // position inside each zone
  private progress = [0, 0];
  private keys: Keys[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text[];
  private timerText!: Phaser.GameObjects.Text;
  private timeLeft = PHASE_TIME.mine;

  constructor() { super('Mine'); }

  create() {
    setupMatch();
    drawWorld(this);

    this.cursor = [{ cx: 2, cy: 0 }, { cx: 2, cy: 0 }];
    this.progress = [0, 0];
    this.timeLeft = PHASE_TIME.mine;
    this.fx = this.add.graphics().setDepth(5);

    const W = GRID_W * TILE_SIZE;
    this.timerText = this.add.text(W / 2, 14, '', {
      fontSize: '28px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: '#c9792a', padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setDepth(10);

    const style = { fontSize: '20px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 8, y: 4 } };
    this.hud = [
      this.add.text(10, 10, '', style).setDepth(10),
      this.add.text(W - 10, 10, '', style).setOrigin(1, 0).setDepth(10),
    ];
    this.add.text(W / 2, 680, 'P1: WASD move cursor, hold F to drill     P2: Arrows move cursor, hold Enter to drill', {
      fontSize: '16px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setDepth(10);

    const kb = this.input.keyboard!;
    this.keys = [
      kb.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D', drill: 'F' }) as Keys,
      kb.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', drill: 'ENTER' }) as Keys,
    ];
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.timerText.setText(`MINE PHASE  0:${String(Math.ceil(this.timeLeft)).padStart(2, '0')}`);

    if (this.timeLeft <= 0) {
      if (this.scene.manager.keys['Build']) this.scene.start('Build');
      return;
    }

    this.fx.clear();
    for (const i of [0, 1]) {
      this.moveCursor(i);
      this.drill(i, dt);
      const v = game.players[i].inventory;
      this.hud[i].setText(`P${i + 1}   Dirt ${v.dirt}   Stone ${v.stone}   Obsidian ${v.obsidian}`);
    }
  }

  private moveCursor(i: number) {
    const k = this.keys[i];
    const c = this.cursor[i];
    const J = Phaser.Input.Keyboard.JustDown;
    let moved = false;
    if (J(k.left))  { c.cx--; moved = true; }
    if (J(k.right)) { c.cx++; moved = true; }
    if (J(k.up))    { c.cy--; moved = true; }
    if (J(k.down))  { c.cy++; moved = true; }
    c.cx = Phaser.Math.Clamp(c.cx, 0, ZONE_W - 1);
    c.cy = Phaser.Math.Clamp(c.cy, 0, ZONE_H - 1);
    if (moved) this.progress[i] = 0;
  }

  private drill(i: number, dt: number) {
    const c = this.cursor[i];
    const gx = ZONE_X[i] + c.cx;
    const gy = PAD_ROW + c.cy;
    const px = gx * TILE_SIZE;
    const py = gy * TILE_SIZE;

    this.fx.lineStyle(4, i === 0 ? 0x66ccff : 0xff6666)
      .strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    const tile = getTile(gx, gy);
    if (!tile || !this.keys[i].drill.isDown) { this.progress[i] = 0; return; }

    this.progress[i] += dt / TILES[tile.type].mineTime;
    this.fx.fillStyle(0x000000, Math.min(this.progress[i], 1) * 0.7)
      .fillRect(px, py, TILE_SIZE, TILE_SIZE);

    if (this.progress[i] >= 1) {
      const type = tile.type;
      setTile(gx, gy, null);
      game.players[i].inventory[type]++;
      this.progress[i] = 0;
      this.debris(px + TILE_SIZE / 2, py + TILE_SIZE / 2, COLORS[type]);
    }
  }

  private debris(x: number, y: number, color: number) {
    for (let n = 0; n < 6; n++) {
      const r = this.add.rectangle(x, y, 8, 8, color).setDepth(6);
      this.tweens.add({
        targets: r,
        x: x + Phaser.Math.Between(-40, 40),
        y: y + Phaser.Math.Between(10, 50),
        alpha: 0, duration: 400,
        onComplete: () => r.destroy(),
      });
    }
  }
}