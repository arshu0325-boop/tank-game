import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../grid";
import { startMenuMusic } from "../menuMusic";

export class InstructionsScene extends Phaser.Scene {
  constructor() {
    super("InstructionsScene");
  }

  create(): void {
    startMenuMusic(this);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "opening-background")
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-2);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x07142b, 0.72)
      .setDepth(-1);
    this.add.text(GAME_WIDTH / 2, 86, "HOW TO PLAY", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "52px",
      color: "#ffffff", stroke: "#101923", strokeThickness: 7,
    }).setOrigin(0.5);

    this.makePlayerCard(445, "PLAYER 1", "BLUE TEAM", 0x28c5ff, [
      ["MINE", "A / D move  •  W climb", "Hold F to drill for resources"],
      ["BUILD", "1 / 2 / 3 select block", "Drag across your grid to build"],
      ["BATTLE", "Aim with the cursor", "Release to fire  •  ↑ / ↓ power"],
      ["WEAPONS", "1 Shell  •  2 Missile", "3 Boomerang"],
    ]);
    this.makePlayerCard(1155, "PLAYER 2", "RED TEAM", 0xff5968, [
      ["MINE", "← / → move  •  ↑ climb", "Hold ENTER to drill for resources"],
      ["BUILD", "7 / 8 / 9 select block", "Drag across your grid to build"],
      ["BATTLE", "Aim with the cursor", "Release to fire  •  ↑ / ↓ power"],
      ["WEAPONS", "4 Shell  •  5 Missile", "6 Boomerang"],
    ]);

    const back = this.add.text(GAME_WIDTH / 2, 835, "BACK TO HOME", {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "22px",
      color: "#ffffff", backgroundColor: "#145f91", padding: { x: 28, y: 14 },
      stroke: "#102030", strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on("pointerover", () => back.setScale(1.05));
    back.on("pointerout", () => back.setScale(1));
    back.on("pointerdown", () => this.scene.start("MenuScene"));
  }

  private makePlayerCard(
    x: number, player: string, team: string, color: number,
    sections: [string, string, string][],
  ): void {
    const y = 440;
    const width = 510;
    const height = 580;
    const card = this.add.graphics();
    card.fillStyle(0x050a10, 0.88).fillRoundedRect(x - width / 2, y - height / 2, width, height, 18);
    card.lineStyle(4, color, 1).strokeRoundedRect(x - width / 2, y - height / 2, width, height, 18);
    this.add.text(x, y - 245, `${player}  /  ${team}`, {
      fontFamily: "Arial Black, Arial, sans-serif", fontSize: "28px",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#101923", strokeThickness: 5,
    }).setOrigin(0.5);

    let currentY = y - 190;
    for (const [heading, line1, line2] of sections) {
      this.add.text(x - 210, currentY, heading, {
        fontFamily: "Arial Black, Arial, sans-serif", fontSize: "24px",
        color: `#${color.toString(16).padStart(6, "0")}`,
        stroke: "#050a10", strokeThickness: 3,
      });
      this.add.text(x - 210, currentY + 31, `${line1}\n${line2}`, {
        fontFamily: "Arial, sans-serif", fontSize: "21px", lineSpacing: 10,
        color: "#ffffff", stroke: "#050a10", strokeThickness: 2,
        wordWrap: { width: width - 45 },
      });
      currentY += 122;
    }
  }
}
