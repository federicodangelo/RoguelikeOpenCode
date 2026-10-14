export type SfxName = "menu" | "select" | "hit" | "hurt" | "kill" | "pickup" | "potion" | "level" | "stairs" | "death";

interface MusicTheme {
  root: number;
  tempo: number;
  progression: number[];
}

const MUSIC_THEMES: MusicTheme[] = [
  { root: 110, tempo: 0.32, progression: [0, 8, 3, 10] },
  { root: 98, tempo: 0.28, progression: [0, 8, 3, 10] },
  { root: 87.31, tempo: 0.24, progression: [0, 8, 3, 10] },
  { root: 82.41, tempo: 0.22, progression: [0, 8, 3, 10] },
];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24];
const MELODY_A: (number | null)[] = [0, null, 2, 3, null, 4, null, 3, 2, null, 0, null, 7, null, 5, 3];
const MELODY_B: (number | null)[] = [7, null, 5, 4, null, 3, null, 4, 5, null, 7, null, 8, null, 7, 5];
const ARP_STEPS = [2, 6, 10, 14];
const ARP_PATTERN = [0, 1, 2, 1];
const MUSIC_LOOKAHEAD_SECONDS = 0.25;
const MUSIC_SCHEDULER_MS = 100;

export class GameAudio {
  enabled = true;
  volume = 0.5;

  private readonly baseGain = 0.45;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicCompressor: DynamicsCompressorNode | null = null;
  private musicDelay: DelayNode | null = null;
  private musicFeedback: GainNode | null = null;
  private musicWet: GainNode | null = null;
  private musicTimer: number | null = null;
  private themeSwitchTimer: number | null = null;
  private musicPlaying = false;
  private themeSwitchToken = 0;
  private musicStep = 0;
  private nextMusicTime = 0;
  private musicTheme = 0;
  private musicStepSeconds = MUSIC_THEMES[0]?.tempo ?? 0.32;
  private sfxVariant = 0;

  private get audible(): boolean {
    return this.enabled && this.volume > 0;
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

  setMusicContext(depth: number, danger: boolean): void {
    const theme = danger ? 3 : (Math.max(1, depth) - 1) % MUSIC_THEMES.length;
    if (theme === this.musicTheme) return;
    this.musicTheme = theme;
    this.musicStepSeconds = MUSIC_THEMES[theme]?.tempo ?? 0.32;
    if (this.musicTimer !== null || this.themeSwitchTimer !== null) {
      if (typeof window !== "undefined") {
        if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
        this.musicTimer = null;
        this.musicPlaying = false;
        if (this.themeSwitchTimer !== null) window.clearTimeout(this.themeSwitchTimer);
        const token = ++this.themeSwitchToken;
        this.fadeOutMusic(0.25);
        this.themeSwitchTimer = window.setTimeout(() => {
          if (this.themeSwitchToken !== token) return;
          this.themeSwitchTimer = null;
          this.startMusic();
        }, 300);
      }
    } else {
      this.updateMusicTone();
    }
  }

  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!ctor) return;
      this.ctx = new ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.audible ? this.volume * this.baseGain : 0;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 1;

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = "lowpass";
      this.musicFilter.frequency.value = 2600;
      this.musicFilter.Q.value = 0.7;

      this.musicCompressor = this.ctx.createDynamicsCompressor();
      this.musicCompressor.threshold.value = -18;
      this.musicCompressor.knee.value = 24;
      this.musicCompressor.ratio.value = 3;
      this.musicCompressor.attack.value = 0.003;
      this.musicCompressor.release.value = 0.25;

      this.musicDelay = this.ctx.createDelay(1);
      this.musicDelay.delayTime.value = this.musicStepSeconds * 0.75;

      this.musicFeedback = this.ctx.createGain();
      this.musicFeedback.gain.value = 0.32;

      this.musicWet = this.ctx.createGain();
      this.musicWet.gain.value = 0.22;

      this.musicBus.connect(this.musicFilter);
      this.musicFilter.connect(this.musicCompressor);
      this.musicCompressor.connect(this.master);
      this.musicFilter.connect(this.musicDelay);
      this.musicDelay.connect(this.musicFeedback);
      this.musicFeedback.connect(this.musicDelay);
      this.musicDelay.connect(this.musicWet);
      this.musicWet.connect(this.musicCompressor);
    }
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  startMusic(): void {
    if (!this.audible || typeof window === "undefined") return;
    this.unlock();
    if (!this.ctx || this.musicPlaying || this.musicTimer !== null) return;
    if (this.themeSwitchTimer !== null) {
      window.clearTimeout(this.themeSwitchTimer);
      this.themeSwitchTimer = null;
      this.themeSwitchToken++;
    }
    this.musicPlaying = true;
    this.musicStep = 0;
    this.nextMusicTime = this.ctx.currentTime + 0.05;
    this.fadeInMusic();
    this.updateMusicTone();
    this.scheduleMusic();
  }

  stopMusic(): void {
    if (typeof window !== "undefined") {
      if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
      if (this.themeSwitchTimer !== null) window.clearTimeout(this.themeSwitchTimer);
    }
    this.musicTimer = null;
    this.themeSwitchTimer = null;
    this.musicPlaying = false;
    this.themeSwitchToken++;
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
    if (typeof window === "undefined" || !this.ctx || !this.audible || !this.musicPlaying) {
      this.musicTimer = null;
      return;
    }

    const lookaheadEnd = this.ctx.currentTime + MUSIC_LOOKAHEAD_SECONDS;
    while (this.nextMusicTime < lookaheadEnd) {
      this.musicTick(this.nextMusicTime);
      this.nextMusicTime += this.musicStepSeconds;
    }

    this.musicTimer = window.setTimeout(() => this.scheduleMusic(), MUSIC_SCHEDULER_MS);
  }

  private musicTick(time: number): void {
    if (!this.ctx) return;
    const theme = MUSIC_THEMES[this.musicTheme] ?? MUSIC_THEMES[0]!;
    const step = this.musicStep % 16;
    const bar = Math.floor(this.musicStep / 16) % theme.progression.length;
    this.musicStep++;

    const danger = this.musicTheme === 3;
    const chordRoot = theme.progression[bar] ?? 0;
    const chordIntervals = bar === 0 ? [0, 3, 7] : [0, 4, 7];
    const melodyPattern = bar === 3 ? MELODY_B : MELODY_A;
    const degree = melodyPattern[step];

    if (degree !== null && degree !== undefined) {
      const semis = MINOR_SCALE[degree] ?? 0;
      const freq = this.freqAt(theme.root * 2, semis);
      const dur = this.musicStepSeconds * (step % 4 === 0 ? 1.4 : 0.9);
      this.musicTone(freq, time, dur, "triangle", 0.075, -7);
      this.musicTone(freq, time, dur, "sine", 0.035, 7);
    }

    if (step % 4 === 0) {
      const bassRoot = this.normalizeBass(chordRoot);
      const semis = step === 4 || step === 12 ? bassRoot + 7 : bassRoot;
      const freq = this.freqAt(theme.root, semis);
      this.musicTone(freq, time, this.musicStepSeconds * 1.6, "sine", 0.08, 0, freq * 0.98);
    }

    const arpSlot = ARP_STEPS.indexOf(step);
    if (arpSlot >= 0) {
      const arpIndex = ARP_PATTERN[arpSlot] ?? 0;
      const interval = chordIntervals[arpIndex % chordIntervals.length] ?? 0;
      this.musicTone(
        this.freqAt(theme.root * 2, chordRoot + interval),
        time,
        this.musicStepSeconds * 0.45,
        "square",
        0.025,
      );
    }

    if (step === 0 || step === 8 || (danger && (step === 2 || step === 10))) {
      this.musicTone(70, time, 0.12, "sine", 0.12, 0, 45);
    }
    if (step === 4 || step === 12 || (danger && (step === 6 || step === 14))) {
      this.musicTone(180, time, 0.08, "square", 0.05, 0, 120);
      this.musicTone(1200, time, 0.04, "triangle", 0.025);
    }
    if (step % 4 === 2) {
      this.musicTone(4200, time, 0.03, "triangle", 0.012);
    }
  }

  private fadeInMusic(): void {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime;
    const gain = this.musicBus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0.0001, now);
    gain.linearRampToValueAtTime(1, now + 0.6);
  }

  private fadeOutMusic(seconds: number): void {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime;
    const gain = this.musicBus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.linearRampToValueAtTime(0.0001, now + seconds);
  }

  private updateMusicTone(): void {
    if (!this.ctx || !this.musicFilter || !this.musicDelay) return;
    const now = this.ctx.currentTime;
    const danger = this.musicTheme === 3;

    const filter = this.musicFilter.frequency;
    filter.cancelScheduledValues(now);
    filter.setValueAtTime(filter.value, now);
    filter.linearRampToValueAtTime(danger ? 1800 : 2600, now + 0.5);

    const delay = this.musicDelay.delayTime;
    delay.cancelScheduledValues(now);
    delay.setValueAtTime(delay.value, now);
    delay.linearRampToValueAtTime(this.musicStepSeconds * 0.75, now + 0.5);
  }

  private freqAt(root: number, semitones: number): number {
    return root * 2 ** (semitones / 12);
  }

  private normalizeBass(offset: number): number {
    let normalized = offset % 12;
    if (normalized > 7) normalized -= 12;
    return normalized;
  }

  private musicTone(
    freq: number,
    startTime: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    detune = 0,
    slideTo?: number,
  ): void {
    if (!this.ctx) return;
    const t = Math.max(this.ctx.currentTime, startTime);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.setValueAtTime(detune, t);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    }

    const attack = Math.min(0.03, dur * 0.25);
    const release = Math.min(0.25, dur * 0.6);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.linearRampToValueAtTime(peak * 0.65, t + Math.max(attack + 0.01, dur - release));
    gain.gain.linearRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(this.musicBus ?? this.master ?? this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
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

  private tone(freq: number, dur: number, type: OscillatorType, peak: number, delay = 0, slideTo?: number): void {
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
