 import Phaser from "phaser";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  create(): void {
    this.createPixelTile("tile-dirt", "#88512d", ["#6e3e24", "#a76a3d", "#9a5c34", "#734326"]);
    this.createPixelTile("tile-grass", "#86502e", ["#6e3e24", "#a76a3d", "#9a5c34", "#734326"], true);
    this.createPixelTile("tile-stone", "#727579", ["#54585d", "#8b9094", "#62676b", "#999da0"]);
    this.createPixelTile("tile-obsidian", "#171725", ["#28243d", "#342b4c", "#11111b", "#4a3c66"]);
    this.createOreTile("ore-iron", false);
    this.createOreTile("ore-coal", true);
    this.createTankTexture("tank-blue", "#087de0", "#28c5ff", false);
    this.createTankTexture("tank-red", "#d92d2d", "#ff6960", true);
    this.createDrillTexture();
    this.scene.start("MenuScene");
  }

  private createPixelTile(key: string, base: string, shades: string[], grassTop = false): void {
    const texture = this.textures.createCanvas(key, 40, 40);
    if (!texture) throw new Error(`Failed to create texture: ${key}`);

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 40, 40);

    // Deterministic pixel patches create a Minecraft-inspired block texture.
    for (let i = 0; i < 33; i++) {
      const x = (i * 13 + (i % 3) * 5) % 36;
      const y = (i * 17 + (i % 5) * 3) % 36;
      const size = i % 4 === 0 ? 7 : i % 3 === 0 ? 5 : 3;
      ctx.fillStyle = shades[i % shades.length];
      ctx.fillRect(x, y, size, size);
    }

    if (grassTop) {
      ctx.fillStyle = "#477b2e";
      ctx.fillRect(0, 0, 40, 8);
      ctx.fillStyle = "#68a941";
      ctx.fillRect(0, 0, 40, 3);
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i % 2 ? "#3f7028" : "#81ba4b";
        ctx.fillRect((i * 11) % 38, (i % 3) + 2, 3, 3);
      }
    }

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, 40, 2);
    ctx.fillRect(0, 0, 2, 40);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(2, 2, 36, 1);
    ctx.fillRect(2, 2, 1, 36);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 38, 40, 2);
    ctx.fillRect(38, 0, 2, 40);
    texture.refresh();
  }

  private createOreTile(key: string, coal: boolean): void {
    const texture = this.textures.createCanvas(key, 40, 40);
    if (!texture) throw new Error(`Failed to create texture: ${key}`);

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#73777a";
    ctx.fillRect(0, 0, 40, 40);
    const stoneColors = ["#555a5e", "#8e9295", "#656a6e", "#a0a3a6"];
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = stoneColors[i % stoneColors.length];
      ctx.fillRect((i * 13) % 37, (i * 19) % 37, i % 3 === 0 ? 5 : 3, i % 3 === 0 ? 4 : 3);
    }
    const oreColors = coal ? ["#25262a", "#38393e", "#111215"] : ["#d66b26", "#f49a42", "#e6d2ba"];
    const oreSpots: [number, number, number, number][] = [
      [5, 7, 6, 4], [23, 4, 5, 5], [14, 18, 7, 5],
      [29, 25, 6, 6], [4, 30, 5, 4], [22, 34, 4, 3],
    ];
    for (const [x, y, w, h] of oreSpots) {
      ctx.fillStyle = oreColors[(x + y) % oreColors.length];
      ctx.fillRect(x, y, w, h);
    }
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, 40, 2);
    ctx.fillRect(0, 0, 2, 40);
    ctx.fillRect(0, 38, 40, 2);
    ctx.fillRect(38, 0, 2, 40);
    texture.refresh();
  }

  private createTankTexture(key: string, baseColor: string, accent: string, mirror: boolean): void {
    const texture = this.textures.createCanvas(key, 128, 70);
    if (!texture) throw new Error(`Failed to create texture: ${key}`);

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    if (mirror) {
      ctx.translate(128, 0);
      ctx.scale(-1, 1);
    }

    // Shadow and tracks.
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(9, 54, 110, 9);
    ctx.fillStyle = "#20242a";
    ctx.fillRect(12, 43, 105, 20);
    ctx.fillStyle = "#50565c";
    ctx.fillRect(17, 47, 95, 11);
    for (const x of [21, 39, 57, 75, 93, 108]) {
      ctx.fillStyle = "#1b2025";
      ctx.beginPath(); ctx.arc(x, 53, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#879097";
      ctx.beginPath(); ctx.arc(x, 53, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3c444b";
      ctx.fillRect(x - 1, 50, 2, 6);
    }

    // Hull and dark outline.
    ctx.fillStyle = "#11171d";
    ctx.beginPath();
    ctx.moveTo(17, 43); ctx.lineTo(27, 28); ctx.lineTo(91, 28); ctx.lineTo(111, 43); ctx.closePath(); ctx.fill();
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(21, 40); ctx.lineTo(31, 31); ctx.lineTo(88, 31); ctx.lineTo(105, 40); ctx.lineTo(109, 43); ctx.lineTo(20, 43); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(31, 33, 57, 3);
    ctx.fillStyle = "rgba(255,255,255,0.24)";
    ctx.fillRect(27, 39, 70, 2);

    // Turret and barrel.
    ctx.fillStyle = "#11171d";
    ctx.fillRect(53, 21, 50, 12);
    ctx.fillRect(88, 24, 29, 6);
    ctx.fillStyle = baseColor;
    ctx.fillRect(56, 20, 44, 10);
    ctx.fillRect(91, 25, 27, 4);
    ctx.fillStyle = accent;
    ctx.fillRect(64, 21, 24, 2);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(102, 25, 13, 2);
    ctx.fillStyle = "#0e2637";
    ctx.fillRect(68, 12, 21, 10);
    ctx.fillStyle = baseColor;
    ctx.fillRect(70, 11, 19, 10);
    ctx.fillStyle = accent;
    ctx.fillRect(72, 12, 12, 3);
    ctx.fillStyle = "#15191e";
    ctx.fillRect(9, 42, 110, 3);
    texture.refresh();
  }

  private createDrillTexture(): void {
    const texture = this.textures.createCanvas("tank-drill", 72, 32);
    if (!texture) throw new Error("Failed to create texture: tank-drill");
    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 72, 32);

    // Reinforced mounting bracket.
    ctx.fillStyle = "#202830";
    ctx.fillRect(0, 8, 17, 16);
    ctx.fillStyle = "#697782";
    ctx.fillRect(3, 10, 14, 12);
    ctx.fillStyle = "#c0ccd2";
    ctx.fillRect(5, 11, 9, 3);
    ctx.fillStyle = "#3c4852";
    ctx.fillRect(5, 18, 10, 3);

    // Chunky metal drill body and shaft.
    ctx.fillStyle = "#141b21";
    ctx.fillRect(15, 10, 31, 12);
    ctx.fillStyle = "#9aa7af";
    ctx.fillRect(17, 11, 26, 9);
    ctx.fillStyle = "#5c6a74";
    ctx.fillRect(20, 12, 22, 3);
    ctx.fillStyle = "#d8e0e4";
    ctx.fillRect(20, 17, 20, 2);

    // The pointed bit faces right; the scene rotates it toward the drilling direction.
    ctx.fillStyle = "#12181d";
    ctx.beginPath();
    ctx.moveTo(42, 8); ctx.lineTo(59, 13); ctx.lineTo(70, 16);
    ctx.lineTo(59, 19); ctx.lineTo(42, 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#b4c0c7";
    ctx.beginPath();
    ctx.moveTo(44, 10); ctx.lineTo(60, 14); ctx.lineTo(68, 16);
    ctx.lineTo(60, 18); ctx.lineTo(44, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#56636c";
    ctx.fillRect(48, 12, 4, 3);
    ctx.fillRect(53, 16, 4, 3);
    ctx.fillRect(47, 18, 4, 3);
    ctx.fillStyle = "#f6d16a";
    ctx.fillRect(22, 8, 5, 3);
    texture.refresh();
  }
}

 
 