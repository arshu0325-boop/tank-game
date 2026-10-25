import Phaser from "phaser";
import { MAX_HP, playerById, type PlayerId } from "../state";

/** Shared player cards used in mining, building, and battle. */
export class PlayerStatusHud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly p1Name: Phaser.GameObjects.Text;
  private readonly p2Name: Phaser.GameObjects.Text;
  private readonly p1Details: Phaser.GameObjects.Text;
  private readonly p2Details: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, depth = 25) {
    this.graphics = scene.add.graphics().setDepth(depth);
    const nameStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "18px",
      color: "#f9f7eb",
      stroke: "#111820",
      strokeThickness: 4,
    };
    const detailsStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Arial Black, Arial, sans-serif",
      fontSize: "12px",
      color: "#eeeaff",
      stroke: "#111820",
      strokeThickness: 3,
    };
    this.p1Name = scene.add.text(116, 28, "", nameStyle).setDepth(depth + 1);
    this.p2Name = scene.add.text(1484, 28, "", nameStyle).setOrigin(1, 0).setDepth(depth + 1);
    this.p1Details = scene.add.text(116, 82, "", detailsStyle).setDepth(depth + 1);
    this.p2Details = scene.add.text(1484, 82, "", detailsStyle).setOrigin(1, 0).setDepth(depth + 1);
    this.drawAvatar(scene, 1, 68, 65, depth + 2);
    this.drawAvatar(scene, 2, 1532, 65, depth + 2);
    this.update(0);
  }

  update(activePlayer: PlayerId | 0 = 0): void {
    this.graphics.clear();
    const p1 = playerById(1);
    const p2 = playerById(2);
    this.drawCard(1, p1.hp, p1.color, activePlayer === 1);
    this.drawCard(2, p2.hp, p2.color, activePlayer === 2);
    this.p1Name.setText(`P1  •  ${p1.name.toUpperCase()}`);
    this.p2Name.setText(`P2  •  ${p2.name.toUpperCase()}`);
    this.p1Details.setText(this.details(1));
    this.p2Details.setText(this.details(2));
  }

  private details(id: PlayerId): string {
    const player = playerById(id);
    return `${player.hp} / ${MAX_HP} HP   •   FUEL ${Math.ceil(player.fuel)}   •   HITS ${player.hits}`;
  }

  private drawCard(id: PlayerId, hp: number, accent: number, active: boolean): void {
    const x = id === 1 ? 22 : 1188;
    const barX = id === 1 ? 112 : 1202;
    this.graphics.fillStyle(0x101a35, 0.94).fillRoundedRect(x, 18, 390, 94, 13);
    this.graphics.lineStyle(active ? 3 : 2, active ? 0xc38aff : accent, active ? 1 : 0.9)
      .strokeRoundedRect(x, 18, 390, 94, 13);

    const barY = 54;
    const barWidth = 280;
    const barHeight = 22;
    const fillWidth = Math.max(0, (barWidth - 6) * Phaser.Math.Clamp(hp / MAX_HP, 0, 1));
    this.graphics.fillStyle(0x5d1728, 1).fillRoundedRect(barX, barY, barWidth, barHeight, 7);
    if (fillWidth > 0) {
      this.graphics.fillStyle(0xff344c, 1).fillRoundedRect(barX + 3, barY + 3, fillWidth, barHeight - 6, 5);
      this.graphics.fillStyle(0xffa0aa, 0.78).fillRoundedRect(barX + 6, barY + 4, Math.max(0, fillWidth - 8), 3, 2);
    }
    this.graphics.lineStyle(2, 0x080d20, 1).strokeRoundedRect(barX, barY, barWidth, barHeight, 7);
  }

  private drawAvatar(scene: Phaser.Scene, id: PlayerId, x: number, y: number, depth: number): void {
    const g = scene.add.graphics().setDepth(depth);
    const accent = playerById(id).color;
    const accentLight = id === 1 ? 0x63ddff : 0xff948c;
    const helmet = id === 1 ? 0xc5d8e6 : 0x8995b2;
    const suitDark = id === 1 ? 0x1167a7 : 0x7f2638;

    g.fillStyle(0x6d42d8, 1).fillRoundedRect(x - 41, y - 41, 82, 82, 13);
    g.lineStyle(3, 0xd5b6ff, 1).strokeRoundedRect(x - 41, y - 41, 82, 82, 13);
    g.fillStyle(0x101c49, 1).fillRoundedRect(x - 35, y - 35, 70, 70, 10);
    g.fillStyle(0x243c83, 0.78).fillCircle(x + 18, y - 17, 20);
    g.fillStyle(0x9ceaff, 0.9).fillCircle(x - 24, y - 23, 2);
    g.fillStyle(0xffffff, 0.8).fillCircle(x + 24, y + 8, 1.5);

    // Compact pilot portraits use the same colors as each player's tank.
    g.fillStyle(0x071328, 1).fillRoundedRect(x - 28, y + 14, 56, 23, 9);
    g.fillStyle(suitDark, 1).fillRoundedRect(x - 24, y + 12, 48, 24, 8);
    g.fillStyle(accent, 1).fillRoundedRect(x - 15, y + 18, 30, 12, 4);
    g.fillStyle(accentLight, 0.95).fillRoundedRect(x - 11, y + 20, 22, 3, 1);
    g.fillStyle(0x17243b, 1).fillRoundedRect(x - 7, y + 4, 14, 14, 4);
    g.fillStyle(helmet, 1).fillRoundedRect(x - 22, y - 27, 44, 39, 13);
    g.fillStyle(0xf3fbff, 0.8).fillRoundedRect(x - 15, y - 24, 23, 5, 2);
    g.fillStyle(id === 1 ? 0x2b789d : 0x454d6c, 1).fillRoundedRect(x - 18, y - 12, 36, 15, 6);
    g.lineStyle(2, accentLight, 0.95).strokeRoundedRect(x - 18, y - 12, 36, 15, 6);
    g.fillStyle(accentLight, 1).fillCircle(x - 8, y - 5, 3);
    g.fillStyle(accentLight, 1).fillCircle(x + 8, y - 5, 3);
    g.fillStyle(0xffffff, 0.95).fillCircle(x - 9, y - 6, 1);
    g.fillStyle(0xffffff, 0.95).fillCircle(x + 7, y - 6, 1);
    g.fillStyle(accent, 1).fillRoundedRect(x - 27, y - 18, 6, 21, 3);
    g.fillStyle(accent, 1).fillRoundedRect(x + 21, y - 18, 6, 21, 3);
    if (id === 1) {
      g.lineStyle(3, accentLight, 1).lineBetween(x + 12, y - 26, x + 21, y - 34);
      g.fillStyle(accentLight, 1).fillCircle(x + 22, y - 35, 3);
    } else {
      g.fillStyle(0x22263b, 1).fillRoundedRect(x - 24, y - 31, 48, 7, 3);
      g.fillStyle(accentLight, 1).fillRoundedRect(x - 8, y - 30, 16, 3, 1);
    }
  }
}
