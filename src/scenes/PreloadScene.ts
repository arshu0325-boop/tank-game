 import Phaser from "phaser";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  create(): void {
    this.createPixelTile("tile-dirt", "#95572f", ["#713d21", "#bd7540", "#a95e30", "#804625"]);
    this.createPixelTile("tile-grass", "#95572f", ["#713d21", "#bd7540", "#a95e30", "#804625"], true);
    this.createPixelTile("tile-stone", "#788489", ["#536166", "#a6b3b7", "#66747a", "#c0c8ca"]);
    this.createPixelTile("tile-obsidian", "#201a38", ["#382857", "#5a3f88", "#161326", "#7858bd"]);
    this.createOreTile("ore-iron", false);
    this.createOreTile("ore-coal", true);
    this.createTankTexture("tank-blue", "#087de0", "#28c5ff", false);
    this.createTankTexture("tank-red", "#d92d2d", "#ff6960", false);
    this.createTankTexture("tank-gold", "#e99318", "#ffd05a", false);
    this.createTankTexture("tank-cyan", "#14a9c7", "#73f1ff", false);
    this.createTankTexture("tank-lime", "#69a91d", "#c8ef45", false);
    this.createTankTexture("tank-violet", "#7044c7", "#c39aff", false);
    this.createDrillTexture();
    this.createProjectileTextures();
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
      ctx.fillStyle = "#4d962f";
      ctx.fillRect(0, 0, 40, 8);
      ctx.fillStyle = "#8bd64a";
      ctx.fillRect(0, 0, 40, 3);
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i % 2 ? "#397823" : "#a0e35a";
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
    ctx.fillStyle = "#788489";
    ctx.fillRect(0, 0, 40, 40);
    const stoneColors = ["#536166", "#a6b3b7", "#66747a", "#c0c8ca"];
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = stoneColors[i % stoneColors.length];
      ctx.fillRect((i * 13) % 37, (i * 19) % 37, i % 3 === 0 ? 5 : 3, i % 3 === 0 ? 4 : 3);
    }
    const oreColors = coal ? ["#25262a", "#38393e", "#111215"] : ["#e87320", "#ffb43e", "#f1d7ad"];
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

  private createProjectileTextures(): void {
    const shell = this.textures.createCanvas("projectile-shell", 32, 16);
    if (!shell) throw new Error("Failed to create texture: projectile-shell");
    let ctx = shell.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 16);
    ctx.fillStyle = "#20252b";
    ctx.beginPath(); ctx.moveTo(2, 6); ctx.lineTo(23, 6); ctx.lineTo(30, 8); ctx.lineTo(23, 10); ctx.lineTo(2, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e8b64d";
    ctx.beginPath(); ctx.moveTo(3, 6); ctx.lineTo(22, 6); ctx.lineTo(28, 8); ctx.lineTo(22, 10); ctx.lineTo(3, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff1a8"; ctx.fillRect(7, 6, 11, 2);
    ctx.fillStyle = "#747d84"; ctx.fillRect(3, 5, 3, 6);
    shell.refresh();

    const missile = this.textures.createCanvas("projectile-missile", 48, 20);
    if (!missile) throw new Error("Failed to create texture: projectile-missile");
    ctx = missile.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 48, 20);
    ctx.fillStyle = "#192129";
    ctx.beginPath(); ctx.moveTo(3, 7); ctx.lineTo(32, 7); ctx.lineTo(44, 10); ctx.lineTo(32, 13); ctx.lineTo(3, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#d84a32";
    ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(32, 8); ctx.lineTo(42, 10); ctx.lineTo(32, 12); ctx.lineTo(4, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f6d179"; ctx.fillRect(12, 8, 14, 2);
    ctx.fillStyle = "#f5f0dc"; ctx.fillRect(37, 9, 6, 2);
    ctx.fillStyle = "#26303a";
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(2, 3); ctx.lineTo(4, 9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(2, 17); ctx.lineTo(4, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffb437"; ctx.fillRect(0, 9, 4, 2);
    ctx.fillStyle = "#fff0a0"; ctx.fillRect(0, 9, 2, 2);
    missile.refresh();

    const boomerang = this.textures.createCanvas("projectile-boomerang", 36, 36);
    if (!boomerang) throw new Error("Failed to create texture: projectile-boomerang");
    ctx = boomerang.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 36, 36);
    ctx.fillStyle = "#14323c";
    ctx.beginPath(); ctx.moveTo(5, 4); ctx.lineTo(15, 7); ctx.lineTo(27, 21); ctx.lineTo(33, 30); ctx.lineTo(23, 27); ctx.lineTo(11, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#55e2ee";
    ctx.beginPath(); ctx.moveTo(7, 5); ctx.lineTo(14, 8); ctx.lineTo(26, 21); ctx.lineTo(30, 27); ctx.lineTo(23, 25); ctx.lineTo(12, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c3ffff"; ctx.fillRect(11, 8, 5, 2); ctx.fillRect(22, 21, 5, 2);
    boomerang.refresh();
  }
}

 
 
