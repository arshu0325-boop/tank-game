import Phaser from "phaser";

let menuMusic: Phaser.Sound.BaseSound | undefined;

export function startMenuMusic(scene: Phaser.Scene): void {
  if (!menuMusic) {
    menuMusic = scene.sound.add("menu-result-bgm", { loop: true, volume: 0.45 });
  }
  if (!menuMusic.isPlaying) menuMusic.play();
}

export function stopMenuMusic(): void {
  if (menuMusic?.isPlaying) menuMusic.stop();
}
