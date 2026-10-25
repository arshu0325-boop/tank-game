import Phaser from "phaser";

type WeaponSound = "shell" | "missile" | "boomerang";

function getAudioContext(scene: Phaser.Scene): AudioContext | null {
  const context = (scene.sound as unknown as { context?: AudioContext }).context;
  if (!context || context.state === "closed") return null;
  return context;
}

function whenAudioReady(scene: Phaser.Scene, play: (context: AudioContext) => void): void {
  const context = getAudioContext(scene);
  if (!context) return;
  // On browsers that start Web Audio suspended, scheduling nodes before resume
  // can leave short effects silent. Resume from the firing/drilling gesture,
  // then build the effect against the live audio clock.
  if (context.state === "suspended") {
    void context.resume().then(() => {
      if (context.state === "running") play(context);
    }).catch(() => undefined);
    return;
  }
  play(context);
}

function tone(context: AudioContext, frequency: number, endFrequency: number, duration: number, volume: number, wave: OscillatorType = "sawtooth"): void {
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function noise(context: AudioContext, duration: number, volume: number, filterFrequency: number): void {
  const start = context.currentTime;
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(filterFrequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(start);
}

export function playShot(scene: Phaser.Scene, weapon: WeaponSound): void {
  whenAudioReady(scene, (context) => {
    if (weapon === "missile") {
      noise(context, 0.24, 0.12, 1100);
      tone(context, 190, 55, 0.38, 0.11);
    } else if (weapon === "boomerang") {
      tone(context, 820, 260, 0.22, 0.09, "triangle");
      tone(context, 420, 720, 0.18, 0.045, "sine");
    } else {
      noise(context, 0.13, 0.2, 1700);
      tone(context, 145, 48, 0.2, 0.17);
    }
  });
}

export function playImpact(scene: Phaser.Scene, weapon: WeaponSound): void {
  whenAudioReady(scene, (context) => {
    const heavy = weapon === "missile";
    noise(context, heavy ? 0.55 : 0.32, heavy ? 0.28 : 0.19, heavy ? 850 : 1400);
    tone(context, heavy ? 105 : 155, 28, heavy ? 0.52 : 0.28, heavy ? 0.22 : 0.14);
  });
}

export function playDrill(scene: Phaser.Scene): void {
  whenAudioReady(scene, (context) => {
    tone(context, 145, 95, 0.12, 0.045, "square");
    noise(context, 0.09, 0.035, 900);
  });
}
