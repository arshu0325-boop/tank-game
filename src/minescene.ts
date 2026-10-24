 import Phaser from 'phaser';
import { TILE_SIZE, GRID_W, GRID_H, TILES, PHASE_TIME } from './config';
import { game, type TileType } from './state';
import { setupMatch, drawGrid, surface, getTile, setTile } from './Grid';

type Keys = Record<'left' | 'right' | 'down' | 'front', Phaser.Input.Keyboard.Key>;

interface Drill { x: number; y: number; progress: number }

export class MineScene extends Phaser.Scene {
  private tanks: Phaser.GameObjects.Image[] = [];
  private py: number[] = [];                 // tank row for each player
  private facing: number[] = [1, -1];        // 1 = right, -1 = left
  private drill: (Drill | null)[] = [null, null];
  private keys: Keys[] = [];
  private cracks!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private timeLeft = PHASE_TIME.mine;

  constructor() { super('Mine'); }

  create() {
    // temporary colored squares until C's Preload scene exists
    const colors: Record<string, number> = {
      dirt: 0x8b5a2b, stone: 0x888888, obsidian: 0x3b1f5c, tank: 0x44aa44,
    };
    for (const key in colors) {
      if (this.textures.exists(key)) continue;
      const g = this.add.graphics();
      g.fillStyle(colors[key]).fillRect(0, 0, 64, 64)
       .lineStyle(2, 0x000000).strokeRect(0, 0, 64, 64);
      g.generateTexture(key, 64, 64);
      g.destroy();
    }

    setupMatch();
    drawGrid(this);

    this.tanks = [];
    this.py = [];
    this.drill = [null, null];
    this.timeLeft = PHASE_TIME.mine;

    game.players.forEach((p, i) => {
      this.py[i] = surface[p.x] - 1;
      this.tanks[i] = this.add.image(0, 0, 'tank').setOrigin(0);
      this.place(i);
    });

    this.cracks = this.add.graphics();
    this.hud = this.add.text(10, 8, '', { fontSize: '20px', color: '#ffffff' }).setDepth(10);

    const kb = this.input.keyboard!;
    this.keys = [
      kb.addKeys({ left: 'A', right: 'D', down: 'S', front: 'F' }) as Keys,
      kb.addKeys({ left: 'LEFT', right: 'RIGHT', down: 'DOWN', front: 'ENTER' }) as Keys,
    ];
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if (this.scene.manager.keys['Build']) this.scene.start('Build');
    }

    this.cracks.clear();
    game.players.forEach((_p, i) => {
      this.handleMove(i);
      this.handleDrill(i, dt);
    });

    const inv = (i: number) => {
      const v = game.players[i].inventory;
      return `D${v.dirt} S${v.stone} O${v.obsidian}`;
    };
    this.hud.setText(
      `P1 ${inv(0)}   |   Mine: ${Math.ceil(this.timeLeft)}s   |   P2 ${inv(1)}`
    );
  }

  private place(i: number) {
    this.tanks[i].setPosition(game.players[i].x * TILE_SIZE, this.py[i] * TILE_SIZE);
  }

  private fall(i: number) {
    const x = game.players[i].x;
    while (this.py[i] + 1 < GRID_H && !getTile(x, this.py[i] + 1)) this.py[i]++;
  }

  private handleMove(i: number) {
    const k = this.keys[i];
    const dir = Phaser.Input.Keyboard.JustDown(k.left) ? -1
              : Phaser.Input.Keyboard.JustDown(k.right) ? 1 : 0;
    if (!dir) return;

    this.facing[i] = dir;
    const p = game.players[i];
    const nx = p.x + dir;
    const y = this.py[i];
    if (nx < 0 || nx >= GRID_W) return;

    if (getTile(nx, y)) {
      // blocked: can step up one tile if there is room
      if (getTile(nx, y - 1) || getTile(p.x, y - 1) || y - 1 < 0) return;
      this.py[i]--;
    }
    p.x = nx;
    this.fall(i);
    this.drill[i] = null;
    this.place(i);
  }

  private handleDrill(i: number, dt: number) {
    const k = this.keys[i];
    const p = game.players[i];
    let tx = -1, ty = -1;

    if (k.down.isDown) { tx = p.x; ty = this.py[i] + 1; }
    else if (k.front.isDown) { tx = p.x + this.facing[i]; ty = this.py[i]; }

    const t = tx >= 0 ? getTile(tx, ty) : null;
    if (!t) { this.drill[i] = null; return; }

    let d = this.drill[i];
    if (!d || d.x !== tx || d.y !== ty) d = this.drill[i] = { x: tx, y: ty, progress: 0 };

    d.progress += dt / TILES[t.type].mineTime;

    // crack overlay: gets darker as the tile is drilled
    this.cracks.fillStyle(0x000000, Math.min(d.progress, 1) * 0.7);
    this.cracks.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);

    if (d.progress >= 1) {
      const type: TileType = t.type;
      setTile(tx, ty, null);
      p.inventory[type]++;
      this.drill[i] = null;
      this.fall(i);
      this.place(i);
    }
  }
}