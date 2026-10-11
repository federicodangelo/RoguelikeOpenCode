export type SfxName =
  | "menu"
  | "select"
  | "hit"
  | "hurt"
  | "kill"
  | "pickup"
  | "potion"
  | "level"
  | "stairs"
  | "death";

const MELODY: number[] = [220, 261.63, 329.63, 261.63, 392, 329.63, 261.63, 220];
const BASS: number[] = [110, 110, 130.81, 130.81, 164.81, 164.81, 130.81, 110];

export class GameAudio {
  enabled = true;
  volume = 0.5;
  muted = false;

  private readonly baseGain = 0.45;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  private get audible(): boolean {
    return this.enabled && !this.muted && this.volume > 0;
  }

  private applyGain(): void {
    if (this.master) {
      this.master.gain.value = this.audible ? this.volume * this.baseGain : 0;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopMusic();
    this.applyGain();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopMusic();
    this.applyGain();
  }

  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!ctor) return;
      this.ctx = new ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.audible ? this.volume * this.baseGain : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  startMusic(): void {
    if (!this.audible || typeof window === "undefined") return;
    this.unlock();
    if (!this.ctx || this.musicTimer !== null) return;
    this.musicStep = 0;
    this.musicTick();
    this.musicTimer = window.setInterval(() => this.musicTick(), 320);
  }

  stopMusic(): void {
    if (this.musicTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.musicTimer);
    }
    this.musicTimer = null;
  }

  sfx(name: SfxName): void {
    if (!this.audible) return;
    this.unlock();
    if (!this.ctx) return;

    switch (name) {
      case "menu":
        this.tone(520, 0.05, "square", 0.09);
        break;
      case "select":
        this.tone(760, 0.07, "square", 0.12);
        this.tone(1040, 0.05, "square", 0.08, 0.04);
        break;
      case "hit":
        this.tone(220, 0.08, "sawtooth", 0.18, 0, 120);
        break;
      case "hurt":
        this.tone(140, 0.18, "sawtooth", 0.22, 0, 70);
        this.tone(90, 0.22, "square", 0.12, 0.02, 50);
        break;
      case "kill":
        this.tone(520, 0.08, "square", 0.16, 0, 260);
        this.tone(780, 0.12, "triangle", 0.1, 0.05, 390);
        break;
      case "pickup":
        this.tone(880, 0.06, "sine", 0.12);
        this.tone(1174, 0.08, "sine", 0.1, 0.05);
        break;
      case "potion":
        this.tone(523, 0.18, "sine", 0.14, 0, 988);
        break;
      case "level":
        this.tone(523, 0.1, "triangle", 0.12);
        this.tone(659, 0.1, "triangle", 0.12, 0.08);
        this.tone(784, 0.16, "triangle", 0.12, 0.16);
        break;
      case "stairs":
        this.tone(330, 0.12, "triangle", 0.11, 0, 440);
        this.tone(440, 0.12, "triangle", 0.09, 0.08, 330);
        break;
      case "death":
        this.tone(220, 0.7, "sawtooth", 0.25, 0, 55);
        this.tone(110, 0.8, "square", 0.16, 0.08, 40);
        break;
    }
  }

  private musicTick(): void {
    if (!this.ctx || !this.audible) return;
    const step = this.musicStep++ % MELODY.length;
    const melody = MELODY[step];
    const bass = BASS[step];
    if (melody !== undefined) this.tone(melody, 0.28, "triangle", 0.09);
    if (step % 2 === 0 && bass !== undefined) this.tone(bass, 0.55, "sine", 0.07);
    if (step === 0) this.tone(440, 0.12, "square", 0.03);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    delay = 0,
    slideTo?: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
