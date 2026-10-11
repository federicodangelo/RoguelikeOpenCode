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
const MUSIC_STEP_SECONDS = 0.32;
const MUSIC_LOOKAHEAD_SECONDS = 0.25;
const MUSIC_SCHEDULER_MS = 100;

export class GameAudio {
  enabled = true;
  volume = 0.5;
  muted = false;

  private readonly baseGain = 0.45;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextMusicTime = 0;
  private sfxVariant = 0;

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
    if (!this.audible) this.stopMusic();
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
    this.nextMusicTime = this.ctx.currentTime + 0.05;
    this.scheduleMusic();
  }

  stopMusic(): void {
    if (this.musicTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.musicTimer);
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
      case "hit": {
        const variant = this.nextVariant(3);
        if (variant === 0) {
          this.tone(220, 0.08, "sawtooth", 0.18, 0, 120);
        } else if (variant === 1) {
          this.tone(180, 0.07, "square", 0.16, 0, 90);
          this.tone(320, 0.04, "square", 0.06, 0.02, 180);
        } else {
          this.tone(260, 0.06, "triangle", 0.14, 0, 140);
          this.noise(0.05, 0.08, 0, 1800);
        }
        break;
      }
      case "hurt": {
        const variant = this.nextVariant(3);
        if (variant === 0) {
          this.tone(140, 0.18, "sawtooth", 0.22, 0, 70);
          this.tone(90, 0.22, "square", 0.12, 0.02, 50);
        } else if (variant === 1) {
          this.tone(120, 0.22, "sawtooth", 0.24, 0, 55);
          this.tone(180, 0.12, "square", 0.1, 0.04, 90);
          this.noise(0.12, 0.08, 0.01, 900);
        } else {
          this.tone(160, 0.18, "triangle", 0.18, 0, 80);
          this.tone(110, 0.24, "square", 0.14, 0.06, 45);
        }
        break;
      }
      case "kill": {
        const variant = this.nextVariant(3);
        if (variant === 0) {
          this.tone(520, 0.08, "square", 0.16, 0, 260);
          this.tone(780, 0.12, "triangle", 0.1, 0.05, 390);
        } else if (variant === 1) {
          this.tone(620, 0.08, "square", 0.18, 0, 310);
          this.tone(930, 0.14, "triangle", 0.12, 0.06, 465);
          this.noise(0.08, 0.06, 0.02, 2400);
        } else {
          this.tone(440, 0.1, "sawtooth", 0.16, 0, 220);
          this.tone(880, 0.18, "sine", 0.1, 0.08, 440);
        }
        break;
      }
      case "pickup": {
        const variant = this.nextVariant(3);
        if (variant === 0) {
          this.tone(880, 0.06, "sine", 0.12);
          this.tone(1174, 0.08, "sine", 0.1, 0.05);
        } else if (variant === 1) {
          this.tone(990, 0.07, "sine", 0.13, 0, 1320);
          this.tone(1320, 0.09, "sine", 0.09, 0.06);
        } else {
          this.tone(780, 0.06, "triangle", 0.12);
          this.tone(1174, 0.09, "triangle", 0.1, 0.05);
          this.noise(0.04, 0.04, 0.02, 3000);
        }
        break;
      }
      case "potion":
        this.tone(523, 0.18, "sine", 0.14, 0, 988);
        break;
      case "level":
        this.tone(523, 0.1, "triangle", 0.12);
        this.tone(659, 0.1, "triangle", 0.12, 0.08);
        this.tone(784, 0.16, "triangle", 0.12, 0.16);
        break;
      case "stairs": {
        const variant = this.nextVariant(3);
        if (variant === 0) {
          this.tone(330, 0.12, "triangle", 0.11, 0, 440);
          this.tone(440, 0.12, "triangle", 0.09, 0.08, 330);
        } else if (variant === 1) {
          this.tone(440, 0.12, "triangle", 0.12, 0, 330);
          this.tone(330, 0.14, "triangle", 0.1, 0.08, 220);
        } else {
          this.tone(330, 0.1, "sine", 0.1, 0, 440);
          this.tone(440, 0.12, "sine", 0.09, 0.08, 330);
          this.noise(0.08, 0.04, 0.04, 1200);
        }
        break;
      }
      case "death": {
        const variant = this.nextVariant(3);
        if (variant === 0) {
          this.tone(220, 0.7, "sawtooth", 0.25, 0, 55);
          this.tone(110, 0.8, "square", 0.16, 0.08, 40);
        } else if (variant === 1) {
          this.tone(180, 0.8, "sawtooth", 0.26, 0, 45);
          this.tone(90, 0.9, "square", 0.18, 0.1, 30);
          this.noise(0.5, 0.1, 0.05, 500);
        } else {
          this.tone(220, 0.7, "triangle", 0.22, 0, 70);
          this.tone(110, 0.9, "sawtooth", 0.16, 0.12, 35);
          this.noise(0.7, 0.12, 0.02, 700);
        }
        break;
      }
    }
  }

  private scheduleMusic(): void {
    if (typeof window === "undefined" || !this.ctx || !this.audible) {
      this.musicTimer = null;
      return;
    }

    const lookaheadEnd = this.ctx.currentTime + MUSIC_LOOKAHEAD_SECONDS;
    while (this.nextMusicTime < lookaheadEnd) {
      this.musicTick(this.nextMusicTime);
      this.nextMusicTime += MUSIC_STEP_SECONDS;
    }

    this.musicTimer = window.setTimeout(() => this.scheduleMusic(), MUSIC_SCHEDULER_MS);
  }

  private musicTick(time: number): void {
    if (!this.ctx) return;
    const step = this.musicStep++ % MELODY.length;
    const melody = MELODY[step];
    const bass = BASS[step];
    if (melody !== undefined) this.toneAt(melody, 0.28, "triangle", 0.09, time);
    if (step % 2 === 0 && bass !== undefined) this.toneAt(bass, 0.55, "sine", 0.07, time);
    if (step === 0) this.toneAt(440, 0.12, "square", 0.03, time);
  }

  private nextVariant(count: number): number {
    const variant = this.sfxVariant % count;
    this.sfxVariant++;
    return variant;
  }

  private noise(dur: number, peak: number, delay = 0, filterFreq = 1200): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFreq, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
    source.stop(t + dur + 0.02);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    delay = 0,
    slideTo?: number,
  ): void {
    if (!this.ctx) return;
    this.toneAt(freq, dur, type, peak, this.ctx.currentTime + delay, slideTo);
  }

  private toneAt(
    freq: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    startTime: number,
    slideTo?: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const t = Math.max(this.ctx.currentTime, startTime);
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
