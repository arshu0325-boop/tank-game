import Phaser from "phaser";
import { MAX_FUEL, MAX_HP, playerById, type PlayerId } from "../state";

/** Shared player cards used in mining, building, and battle. */
export class PlayerStatusHud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly p1Name: Phaser.GameObjects.Text;
  private readonly p2Name: Phaser.GameObjects.Text;

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
    scene.add.text(116, 61, "HP", detailsStyle).setOrigin(0, 0.5).setDepth(depth + 1);
    scene.add.text(1484, 61, "HP", detailsStyle).setOrigin(1, 0.5).setDepth(depth + 1);
    scene.add.text(116, 87, "FUEL", detailsStyle).setOrigin(0, 0.5).setDepth(depth + 1);
    scene.add.text(1484, 87, "FUEL", detailsStyle).setOrigin(1, 0.5).setDepth(depth + 1);
    this.drawAvatar(scene, 1, 68, 65, depth + 2);
    this.drawAvatar(scene, 2, 1532, 65, depth + 2);
    this.update(0);
  }

  update(activePlayer: PlayerId | 0 = 0): void {
    this.graphics.clear();
    const p1 = playerById(1);
    const p2 = playerById(2);
    this.drawCard(1, p1.hp, p1.fuel, p1.color, activePlayer === 1);
    this.drawCard(2, p2.hp, p2.fuel, p2.color, activePlayer === 2);
    this.p1Name.setText(`P1  •  ${p1.name.toUpperCase()}`);
    this.p2Name.setText(`P2  •  ${p2.name.toUpperCase()}`);
  }

  private drawCard(id: PlayerId, hp: number, fuel: number, accent: number, active: boolean): void {
    const x = id === 1 ? 22 : 1188;
    this.graphics.fillStyle(0x101a35, 0.94).fillRoundedRect(x, 18, 390, 94, 13);
    this.graphics.lineStyle(active ? 3 : 2, active ? 0xc38aff : accent, active ? 1 : 0.9)
      .strokeRoundedRect(x, 18, 390, 94, 13);

    const barX = id === 1 ? 154 : 1202;
    const barWidth = 236;
    const barHeight = 12;
    const hpY = 55;
    const hpFill = (barWidth - 4) * Phaser.Math.Clamp(hp / MAX_HP, 0, 1);
    this.graphics.fillStyle(0x401b2b, 1).fillRoundedRect(barX, hpY, barWidth, barHeight, 4);
    if (hpFill > 0) {
      this.graphics.fillStyle(0xff3b61, 1).fillRoundedRect(barX + 2, hpY + 2, hpFill, barHeight - 4, 3);
      this.graphics.fillStyle(0xffb1bc, 0.82).fillRoundedRect(barX + 5, hpY + 3, Math.max(0, hpFill - 6), 2, 1);
    }
    this.graphics.lineStyle(1, 0x090d16, 1).strokeRoundedRect(barX, hpY, barWidth, barHeight, 4);

    const fuelX = id === 1 ? 154 : 1202;
    const fuelWidth = barWidth;
    const fuelY = 81;
    const fuelHeight = barHeight;
    const fuelFill = (fuelWidth - 4) * Phaser.Math.Clamp(fuel / MAX_FUEL, 0, 1);
    const fuelColor = fuel <= MAX_FUEL * 0.2 ? 0xff665a : 0xffb83f;
    this.graphics.fillStyle(0x30231d, 1).fillRoundedRect(fuelX, fuelY, fuelWidth, fuelHeight, 4);
    if (fuelFill > 0) {
      this.graphics.fillStyle(fuelColor, 1).fillRoundedRect(fuelX + 2, fuelY + 2, fuelFill, fuelHeight - 4, 3);
    }
    this.graphics.lineStyle(1, 0x090d16, 1).strokeRoundedRect(fuelX, fuelY, fuelWidth, fuelHeight, 4);
  }

  private drawAvatar(scene: Phaser.Scene, id: PlayerId, x: number, y: number, depth: number): void {
    const g = scene.add.graphics().setDepth(depth);
    const player = playerById(id);

    g.fillStyle(0x6d42d8, 1).fillRoundedRect(x - 41, y - 41, 82, 82, 13);
    g.lineStyle(3, 0xd5b6ff, 1).strokeRoundedRect(x - 41, y - 41, 82, 82, 13);
    g.fillStyle(0x101c49, 1).fillRoundedRect(x - 35, y - 35, 70, 70, 10);
    g.fillStyle(0x243c83, 0.82).fillCircle(x + 18, y - 17, 20);
    g.fillStyle(0x9ceaff, 0.9).fillCircle(x - 24, y - 23, 2);
    g.fillStyle(0xffffff, 0.8).fillCircle(x + 24, y + 8, 1.5);
    g.fillStyle(0x101522, 0.72).fillEllipse(x + 2, y + 27, 63, 10);
    g.fillStyle(player.color, 1).fillRoundedRect(x - 31, y + 29, 62, 3, 2);

    const facesLeftByDefault = player.tankTexture === "tank-red";
    scene.add.image(x, y + 5, player.tankTexture)
      .setDisplaySize(74, 41)
      .setFlipX(id === 1 ? facesLeftByDefault : !facesLeftByDefault)
      .setDepth(depth + 1);
  }
}
