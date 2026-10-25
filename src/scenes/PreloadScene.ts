 import Phaser from "phaser";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this.load.image("tankcraft-logo", "/assets/tankcraft-logo.png");
    this.load.image("opening-background", "/assets/opening-background.png");
    this.load.image("opening-night", "/assets/opening-night.png");
    this.load.image("opening-day", "/assets/opening-day.png");
    this.load.image("result-night-bg", "/assets/result-night.png");
    this.load.image("result-day-bg", "/assets/result-day.png");
  }

  create(): void {
    this.createPixelTile("tile-dirt", "#95572f", ["#713d21", "#bd7540", "#a95e30", "#804625"]);
    this.createPixelTile("tile-grass", "#95572f", ["#713d21", "#bd7540", "#a95e30", "#804625"], true);
    this.createPixelTile("tile-stone", "#788489", ["#536166", "#a6b3b7", "#66747a", "#c0c8ca"]);
    this.createPixelTile("tile-obsidian", "#201a38", ["#382857", "#5a3f88", "#161326", "#7858bd"]);
    this.createOreTile("ore-iron", false);
    this.createOreTile("ore-coal", true);
    this.createTankTexture("tank-blue", "#087de0", "#28c5ff", false, "balanced");
    this.createTankTexture("tank-blue-preview", "#087de0", "#28c5ff", false, "balanced", true);
    this.createTankTexture("tank-red", "#d92d2d", "#ff6960", true, "heavy");
    this.createTankTexture("tank-red-preview", "#d92d2d", "#ff6960", true, "heavy", true);
    this.createTankTexture("tank-gold", "#e99318", "#ffd05a", false, "siege");
    this.createTankTexture("tank-gold-preview", "#e99318", "#ffd05a", false, "siege", true);
    this.createTankTexture("tank-cyan", "#14a9c7", "#73f1ff", false, "twin");
    this.createTankTexture("tank-cyan-preview", "#14a9c7", "#73f1ff", false, "twin", true);
    this.createTankTexture("tank-lime", "#69a91d", "#c8ef45", false, "rocket");
    this.createTankTexture("tank-lime-preview", "#69a91d", "#c8ef45", false, "rocket", true);
    this.createTankTexture("tank-violet", "#7044c7", "#c39aff", false, "scout");
    this.createTankTexture("tank-violet-preview", "#7044c7", "#c39aff", false, "scout", true);
    this.createBattleBackground("battle-day-background", false, 2200);
    this.createBattleBackground("battle-night-background", true, 2200);
    this.createBattleBackground("phase-day-background", false, 800);
    this.createBattleBackground("phase-night-background", true, 800);
    this.createNightHaloTexture();
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

  private createTankTexture(
    key: string,
    baseColor: string,
    accent: string,
    mirror: boolean,
    model: "balanced" | "heavy" | "siege" | "twin" | "rocket" | "scout",
    includeCannon = false,
  ): void {
    const texture = this.textures.createCanvas(key, 128, 70);
    if (!texture) throw new Error(`Failed to create texture: ${key}`);

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    if (mirror) {
      ctx.translate(128, 0);
      ctx.scale(-1, 1);
    }

    const adjust = (hex: string, amount: number): string => {
      const value = Number.parseInt(hex.slice(1), 16);
      const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
        .map((channel) => Math.max(0, Math.min(255, Math.round(channel + (amount >= 0 ? 255 - channel : channel) * amount))));
      return `rgb(${channels[0]},${channels[1]},${channels[2]})`;
    };
    const vibrantColor = `#${baseColor.slice(1).match(/../g)!.map((part) =>
      Math.min(255, Math.round(Number.parseInt(part, 16) * 1.5)).toString(16).padStart(2, "0"),
    ).join("")}`;
    const dark = adjust(vibrantColor, -0.4);
    const light = adjust(vibrantColor, 0.5);

    // Layered tracks, wheels, and a cast shadow give the small sprite volume.
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath(); ctx.ellipse(65, 62, 57, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#141a21";
    ctx.beginPath(); ctx.roundRect(8, 43, 112, 22, 10); ctx.fill();
    ctx.fillStyle = "#59616b";
    ctx.beginPath(); ctx.roundRect(13, 46, 102, 15, 7); ctx.fill();
    ctx.fillStyle = "#222a34";
    ctx.beginPath(); ctx.roundRect(15, 48, 98, 12, 6); ctx.fill();
    for (const [index, x] of [21, 39, 57, 75, 93, 108].entries()) {
      const wheel = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
      wheel.addColorStop(0, "#343d48"); wheel.addColorStop(0.5, "#a2adb7"); wheel.addColorStop(1, "#343d48");
      ctx.fillStyle = "#11171d";
      ctx.beginPath(); ctx.arc(x, 54, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = wheel;
      ctx.beginPath(); ctx.arc(x, 54, 5.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#39434d";
      ctx.beginPath(); ctx.arc(x, 54, 2.2, 0, Math.PI * 2); ctx.fill();
      if (index % 2 === 0) {
        ctx.fillStyle = "rgba(230,240,246,0.56)";
        ctx.fillRect(x - 1, 48, 2, 2);
      }
    }
    ctx.strokeStyle = "rgba(210,222,230,0.34)";
    ctx.lineWidth = 1;
    for (let x = 14; x < 116; x += 9) {
      ctx.beginPath(); ctx.moveTo(x, 61); ctx.lineTo(x + 4, 63); ctx.stroke();
    }

    // Faceted hull with a bright top plane and a darker lower armor skirt.
    ctx.fillStyle = "#10161d";
    ctx.beginPath();
    ctx.moveTo(13, 46); ctx.lineTo(22, 33); ctx.lineTo(38, 27); ctx.lineTo(93, 28);
    ctx.lineTo(111, 38); ctx.lineTo(119, 47); ctx.lineTo(111, 51); ctx.lineTo(19, 51); ctx.closePath(); ctx.fill();
    const hull = ctx.createLinearGradient(18, 26, 20, 52);
    hull.addColorStop(0, light); hull.addColorStop(0.36, vibrantColor); hull.addColorStop(1, dark);
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(18, 44); ctx.lineTo(26, 34); ctx.lineTo(39, 30); ctx.lineTo(91, 30);
    ctx.lineTo(106, 38); ctx.lineTo(114, 45); ctx.lineTo(108, 48); ctx.lineTo(21, 48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(27, 34); ctx.lineTo(40, 31); ctx.lineTo(89, 31); ctx.lineTo(97, 35); ctx.lineTo(37, 35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.moveTo(24, 41); ctx.lineTo(33, 36); ctx.lineTo(80, 36); ctx.lineTo(74, 38); ctx.lineTo(31, 39); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(29, 42); ctx.lineTo(102, 42); ctx.lineTo(110, 47); ctx.lineTo(22, 47); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(32, 43, 5, 2); ctx.fillRect(42, 43, 5, 2); ctx.fillRect(91, 43, 5, 2);
    for (const [x, y] of [[31, 37], [47, 33], [82, 34], [103, 40]]) {
      ctx.fillStyle = "rgba(19,27,34,0.68)";
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // Glossy color sheen is clipped to the hull silhouette, so it brightens
    // the paint without creating a glow outside the tank's outline.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(18, 44); ctx.lineTo(26, 34); ctx.lineTo(39, 30); ctx.lineTo(91, 30);
    ctx.lineTo(106, 38); ctx.lineTo(114, 45); ctx.lineTo(108, 48); ctx.lineTo(21, 48); ctx.closePath();
    ctx.clip();
    const hullSheen = ctx.createLinearGradient(18, 28, 88, 51);
    hullSheen.addColorStop(0, "rgba(255,255,255,0.58)");
    hullSheen.addColorStop(0.32, "rgba(255,255,255,0.2)");
    hullSheen.addColorStop(0.58, "rgba(125,239,255,0.12)");
    hullSheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hullSheen;
    ctx.fillRect(16, 27, 104, 25);
    ctx.restore();

    if (includeCannon) {
      const drawBarrel = (y: number, thickness: number, length: number): void => {
        ctx.fillStyle = "#111820";
        ctx.beginPath(); ctx.roundRect(78, y - thickness / 2, length, thickness, thickness / 2); ctx.fill();
        const barrel = ctx.createLinearGradient(0, y - thickness / 2, 0, y + thickness / 2);
        barrel.addColorStop(0, "#eff7ff"); barrel.addColorStop(0.42, "#a8bac9"); barrel.addColorStop(1, "#526575");
        ctx.fillStyle = barrel;
        ctx.beginPath(); ctx.roundRect(80, y - thickness / 2 + 1, length - 3, thickness - 2, thickness / 2); ctx.fill();
        ctx.fillStyle = accent;
        ctx.fillRect(87, y - 1, Math.max(7, length - 34), 2);
        ctx.fillStyle = "#283440";
        ctx.fillRect(78 + length - 10, y - thickness / 2 - 1, 4, thickness + 2);
        ctx.fillStyle = "#dce9f2";
        ctx.fillRect(78 + length - 4, y - thickness / 2 + 2, 2, thickness - 4);
      };
      if (model === "twin") {
        drawBarrel(22, 5, 45); drawBarrel(30, 5, 48);
      } else if (model === "heavy") {
        drawBarrel(27, 10, 49);
      } else if (model === "siege") {
        drawBarrel(24, 8, 54);
      } else if (model === "balanced") {
        drawBarrel(27, 7, 46);
      } else if (model === "scout") {
        drawBarrel(28, 4, 50);
      }
    }

    const turretBox = model === "heavy" ? { x: 40, y: 15, w: 55, h: 20 }
      : model === "siege" ? { x: 34, y: 13, w: 56, h: 23 }
      : model === "rocket" ? { x: 46, y: 12, w: 53, h: 25 }
      : model === "scout" ? { x: 53, y: 20, w: 39, h: 15 }
      : model === "twin" ? { x: 43, y: 17, w: 48, h: 18 }
      : { x: 46, y: 17, w: 48, h: 18 };
    ctx.fillStyle = "#111820";
    ctx.beginPath(); ctx.roundRect(turretBox.x - 3, turretBox.y - 2, turretBox.w + 6, turretBox.h + 5, 7); ctx.fill();
    const turret = ctx.createLinearGradient(0, turretBox.y, 0, turretBox.y + turretBox.h + 3);
    turret.addColorStop(0, light); turret.addColorStop(0.48, vibrantColor); turret.addColorStop(1, dark);
    ctx.fillStyle = turret;
    ctx.beginPath(); ctx.roundRect(turretBox.x, turretBox.y, turretBox.w, turretBox.h, 6); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(turretBox.x, turretBox.y, turretBox.w, turretBox.h, 6); ctx.clip();
    const turretSheen = ctx.createLinearGradient(turretBox.x, turretBox.y, turretBox.x + turretBox.w, turretBox.y + turretBox.h);
    turretSheen.addColorStop(0, "rgba(255,255,255,0.52)");
    turretSheen.addColorStop(0.42, "rgba(255,255,255,0.12)");
    turretSheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = turretSheen;
    ctx.fillRect(turretBox.x, turretBox.y, turretBox.w, turretBox.h);
    ctx.restore();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.roundRect(turretBox.x + 5, turretBox.y + 3, turretBox.w - 15, 3, 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath(); ctx.roundRect(turretBox.x + 4, turretBox.y + 7, 7, turretBox.h - 11, 3); ctx.fill();

    if (model === "rocket") {
      // Original six-cell rocket pod instead of a conventional cannon.
      ctx.fillStyle = "#15212a";
      ctx.beginPath(); ctx.roundRect(55, 15, 40, 24, 5); ctx.fill();
      ctx.fillStyle = light;
      ctx.beginPath(); ctx.roundRect(58, 16, 35, 20, 4); ctx.fill();
      for (const [cx, cy] of [[65, 21], [77, 21], [88, 21], [65, 30], [77, 30], [88, 30]]) {
        ctx.fillStyle = "#24303a";
        ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(cx - 0.6, cy - 0.6, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      // BattleScene draws the aimed cannon separately; keep only the rocket pod
      // on the base tank texture so the weapon is not rendered twice.
      if (includeCannon) {
        ctx.fillStyle = "#111820";
        ctx.beginPath(); ctx.roundRect(76, 24, 49, 8, 4); ctx.fill();
        const barrel = ctx.createLinearGradient(0, 24, 0, 32);
        barrel.addColorStop(0, "#eff7ff"); barrel.addColorStop(0.42, "#a8bac9"); barrel.addColorStop(1, "#526575");
        ctx.fillStyle = barrel;
        ctx.beginPath(); ctx.roundRect(78, 25, 45, 6, 3); ctx.fill();
        ctx.fillStyle = accent;
        ctx.fillRect(84, 27, 24, 2);
        ctx.fillStyle = "#283440";
        ctx.fillRect(115, 23, 4, 10);
        ctx.fillStyle = "#dce9f2";
        ctx.fillRect(121, 26, 2, 4);
      }
    } else if (model === "scout") {
      ctx.fillStyle = "#111820";
      ctx.fillRect(66, 13, 2, 10);
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(67, 12, 2.4, 0, Math.PI * 2); ctx.fill();
    }

    // Glazed optics, panel seams, and a tiny headlamp add readable detail at game scale.
    ctx.fillStyle = "#16242e";
    ctx.beginPath(); ctx.roundRect(72, 22, 10, 5, 2); ctx.fill();
    ctx.fillStyle = "#b8f8ff";
    ctx.beginPath(); ctx.roundRect(73, 23, 7, 2, 1); ctx.fill();
    ctx.fillStyle = "#fff4a6";
    ctx.beginPath(); ctx.arc(111, 43, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(25, 48, 76, 1);
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

  private createNightHaloTexture(): void {
    const texture = this.textures.createCanvas("night-halo", 128, 128);
    if (!texture) throw new Error("Failed to create texture: night-halo");
    const ctx = texture.getContext();
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 63);
    gradient.addColorStop(0, "rgba(255,255,255,0.48)");
    gradient.addColorStop(0.24, "rgba(255,255,255,0.32)");
    gradient.addColorStop(0.58, "rgba(255,255,255,0.12)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    texture.refresh();
  }

  private createBattleBackground(key: string, night: boolean, width: number): void {
    const height = 900;
    const scale = width / 2200;
    const sx = (value: number): number => value * scale;
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) throw new Error(`Failed to create texture: ${key}`);
    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    if (night) {
      sky.addColorStop(0, "#090d42");
      sky.addColorStop(0.38, "#29216f");
      sky.addColorStop(0.72, "#764783");
      sky.addColorStop(1, "#f28467");
    } else {
      sky.addColorStop(0, "#1389c9");
      sky.addColorStop(0.4, "#48c9df");
      sky.addColorStop(0.74, "#ffbd74");
      sky.addColorStop(1, "#fff0a0");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    if (night) {
      for (let i = 0; i < Math.round(210 * scale); i++) {
        const x = (i * 967 + 83) % width;
        const y = (i * 193 + 29) % 430;
        const size = i % 13 === 0 ? 3 : i % 4 === 0 ? 2 : 1;
        ctx.fillStyle = i % 7 === 0 ? "#70eaff" : "#fff2cd";
        ctx.globalAlpha = i % 5 === 0 ? 0.95 : 0.66;
        ctx.fillRect(x, y, size, size);
        if (i % 13 === 0) {
          ctx.globalAlpha = 0.4;
          ctx.fillRect(x - 5, y + 1, 13, 1);
          ctx.fillRect(x + 1, y - 5, 1, 13);
        }
      }
      ctx.globalAlpha = 1;
      const moonX = sx(1580), moonRadius = sx(47), glowRadius = sx(160);
      ctx.save();
      ctx.translate(moonX, 172);
      const moonGlow = ctx.createRadialGradient(0, 0, 12 * scale, 0, 0, glowRadius);
      moonGlow.addColorStop(0, "rgba(149,202,255,0.35)");
      moonGlow.addColorStop(1, "rgba(100,141,255,0)");
      ctx.fillStyle = moonGlow;
      ctx.fillRect(-glowRadius, -glowRadius, glowRadius * 2, glowRadius * 2);
      ctx.fillStyle = "#d8e8ff";
      ctx.beginPath(); ctx.arc(0, 0, moonRadius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#a9bee9";
      ctx.fillRect(-20 * scale, -22, 13 * scale, 9); ctx.fillRect(17 * scale, 10, 17 * scale, 11); ctx.fillRect(-33 * scale, 21, 10 * scale, 8);
      ctx.restore();
    } else {
      const sunX = sx(1090), sunRadius = sx(68), sunGlowRadius = sx(260);
      const sunGlow = ctx.createRadialGradient(sunX, 420, 20 * scale, sunX, 420, sunGlowRadius);
      sunGlow.addColorStop(0, "rgba(255,255,215,0.96)");
      sunGlow.addColorStop(0.24, "rgba(255,238,160,0.62)");
      sunGlow.addColorStop(1, "rgba(255,204,104,0)");
      ctx.fillStyle = sunGlow;
      ctx.fillRect(sunX - sunGlowRadius, 420 - sunGlowRadius, sunGlowRadius * 2, sunGlowRadius * 2);
      ctx.fillStyle = "#fff8cb";
      ctx.beginPath(); ctx.arc(sunX, 420, sunRadius, 0, Math.PI * 2); ctx.fill();
    }

    const drawCloud = (x: number, y: number, w: number, h: number): void => {
      ctx.save();
      ctx.fillStyle = night ? "rgba(133,119,194,0.7)" : "rgba(244,255,255,0.86)";
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.5, h * 0.34, 0, 0, Math.PI * 2);
      ctx.ellipse(x - w * 0.25, y + 1, w * 0.23, h * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(x - w * 0.08, y - h * 0.18, w * 0.24, h * 0.44, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.18, y - h * 0.1, w * 0.25, h * 0.38, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.35, y + 2, w * 0.18, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = night ? "rgba(188,153,213,0.22)" : "rgba(255,255,255,0.64)";
      ctx.beginPath();
      ctx.ellipse(x - w * 0.08, y - h * 0.2, w * 0.16, h * 0.22, 0, Math.PI, Math.PI * 2);
      ctx.ellipse(x + w * 0.19, y - h * 0.1, w * 0.15, h * 0.18, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    drawCloud(sx(350), 235, sx(500), 125);
    drawCloud(sx(1060), 330, sx(430), 90);
    drawCloud(sx(1800), 225, sx(590), 140);

    const drawMountainRange = (baseY: number, peakHeight: number, phase: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= width; x += 34) {
        const broadPeak = Math.abs(Math.sin((x / scale) * 0.0047 + phase));
        const sharpPeak = Math.abs(Math.sin((x / scale) * 0.013 + phase * 2));
        const y = baseY - Math.pow(broadPeak, 4) * peakHeight - sharpPeak * 22;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    };
    drawMountainRange(620, 205, 0.2, night ? "#3d3479" : "#687f9a");
    drawMountainRange(675, 142, 1.1, night ? "#25275e" : "#426a77");

    // Soft haze separates the mountain layers from the destructible foreground.
    const haze = ctx.createLinearGradient(0, 480, 0, 730);
    haze.addColorStop(0, night ? "rgba(111,107,164,0)" : "rgba(255,231,164,0)");
    haze.addColorStop(1, night ? "rgba(57,94,116,0.7)" : "rgba(133,193,141,0.62)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 480, width, 250);
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

 
 
