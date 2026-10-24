import { describe, expect, it } from "bun:test";
import { GameAudio } from "../../src/platform/audio.ts";

class FakeParam {
  value = 0;
  setValueAtTime(value: number): void {
    this.value = value;
  }
  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }
  cancelScheduledValues(): void {}
}

class FakeNode {
  connections: unknown[] = [];
  incoming: FakeNode[] = [];

  connect(target: unknown): void {
    this.connections.push(target);
    if (target instanceof FakeNode) target.incoming.push(this);
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeBiquadFilter extends FakeNode {
  type = "";
  frequency = new FakeParam();
  Q = new FakeParam();
}

class FakeDelay extends FakeNode {
  delayTime = new FakeParam();
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type = "";
  frequency = new FakeParam();
  detune = new FakeParam();
  start(): void {}
  stop(): void {}
}

class FakeBuffer {
  constructor(readonly length: number) {}

  getChannelData(): Float32Array {
    return new Float32Array(this.length);
  }
}

class FakeBufferSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  start(): void {}
  stop(): void {}
}

const createdAudioContexts: FakeAudioContext[] = [];

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = "running" as AudioContextState;
  destination = new FakeNode();
  createdOscillators: FakeOscillator[] = [];
  createdGains: FakeGain[] = [];
  createdFilters: FakeBiquadFilter[] = [];
  createdDelays: FakeDelay[] = [];
  createdCompressors: FakeCompressor[] = [];
  createdBuffers: FakeBuffer[] = [];
  createdBufferSources: FakeBufferSource[] = [];
  resumeCalls = 0;

  constructor() {
    createdAudioContexts.push(this);
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.createdGains.push(gain);
    return gain;
  }

  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator();
    this.createdOscillators.push(osc);
    return osc;
  }

  createBiquadFilter(): BiquadFilterNode {
    const filter = new FakeBiquadFilter();
    this.createdFilters.push(filter);
    return filter as unknown as BiquadFilterNode;
  }

  createDelay(): DelayNode {
    const delay = new FakeDelay();
    this.createdDelays.push(delay);
    return delay as unknown as DelayNode;
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    const compressor = new FakeCompressor();
    this.createdCompressors.push(compressor);
    return compressor as unknown as DynamicsCompressorNode;
  }

  createBuffer(_channels: number, length: number, _sampleRate: number): AudioBuffer {
    const buffer = new FakeBuffer(length);
    this.createdBuffers.push(buffer);
    return buffer as unknown as AudioBuffer;
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSource();
    this.createdBufferSources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  resume(): void {
    this.resumeCalls++;
  }
}

class SuspendedFakeAudioContext extends FakeAudioContext {
  override state = "suspended" as AudioContextState;
}

interface FakeWindowHandle {
  scheduled: (() => void)[];
  cleared: number[];
  restore: () => void;
}

function installFakeWindow(options: { audioContext?: unknown; webkitAudioContext?: unknown } = {}): FakeWindowHandle {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const scheduled: (() => void)[] = [];
  const cleared: number[] = [];
  const fakeWindow: Record<string, unknown> = {
    setTimeout: (callback: () => void) => {
      scheduled.push(callback);
      return scheduled.length;
    },
    clearTimeout: (id: number) => {
      cleared.push(id);
    },
  };
  if (options.audioContext !== undefined) fakeWindow.AudioContext = options.audioContext;
  if (options.webkitAudioContext !== undefined) fakeWindow.webkitAudioContext = options.webkitAudioContext;
  (globalThis as { window?: unknown }).window = fakeWindow;

  return {
    scheduled,
    cleared,
    restore: () => {
      (globalThis as { window?: unknown }).window = previousWindow;
    },
  };
}

describe("game audio", () => {
  it("is safe when Web Audio is unavailable", () => {
    const audio = new GameAudio();
    audio.setEnabled(true);
    audio.sfx("hit");
    audio.startMusic();
    audio.stopMusic();
    expect(audio.enabled).toBe(true);
  });

  it("stops music when disabled", () => {
    const audio = new GameAudio();
    audio.startMusic();
    audio.setEnabled(false);
    expect(audio.enabled).toBe(false);
  });

  it("stores volume state", () => {
    const audio = new GameAudio();
    audio.setVolume(1.5);
    expect(audio.volume).toBe(1);
    audio.setVolume(-1);
    expect(audio.volume).toBe(0);
    audio.startMusic();
    expect(audio.volume).toBe(0);
  });

  it("falls back safely when music context changes without Web Audio", () => {
    const audio = new GameAudio();
    audio.setMusicContext(2, true);
    audio.startMusic();
    audio.stopMusic();
    expect(audio.volume).toBe(0.5);
  });

  it("cycles richer SFX variants safely without Web Audio", () => {
    const audio = new GameAudio();
    for (let i = 0; i < 12; i++) {
      audio.sfx("hit");
      audio.sfx("hurt");
      audio.sfx("kill");
      audio.sfx("pickup");
      audio.sfx("stairs");
      audio.sfx("death");
    }
    expect(audio.enabled).toBe(true);
  });

  it("schedules music ahead of time when Web Audio is available", () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const previousContextCount = createdAudioContexts.length;
    const scheduled: (() => void)[] = [];
    const cleared: number[] = [];

    (globalThis as { window?: unknown }).window = {
      AudioContext: FakeAudioContext as unknown as typeof AudioContext,
      setTimeout: (callback: () => void) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeout: (id: number) => {
        cleared.push(id);
      },
    };

    try {
      const audio = new GameAudio();
      audio.startMusic();

      const context = createdAudioContexts[previousContextCount]!;
      expect(context.createdOscillators.length).toBeGreaterThan(0);
      expect(scheduled.length).toBe(1);

      audio.stopMusic();
      expect(cleared.length).toBe(1);
    } finally {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  });

  it("resyncs the music clock after a throttled tab instead of dumping every missed step", () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const previousContextCount = createdAudioContexts.length;
    const scheduled: (() => void)[] = [];

    (globalThis as { window?: unknown }).window = {
      AudioContext: FakeAudioContext as unknown as typeof AudioContext,
      setTimeout: (callback: () => void) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeout: () => {},
    };

    try {
      const audio = new GameAudio();
      audio.startMusic();
      const context = createdAudioContexts[previousContextCount]!;
      const before = context.createdOscillators.length;
      expect(scheduled.length).toBe(1);

      // A backgrounded tab freezes the scheduler timer: the audio clock races ahead while the
      // next step time stays put. The pending pass must not schedule every missed step at once.
      context.currentTime = 120;
      scheduled[0]!();

      const scheduledSteps = context.createdOscillators.length - before;
      expect(scheduledSteps).toBeLessThan(20);
      expect(scheduled.length).toBe(2);

      audio.stopMusic();
    } finally {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  });

  it("fades and restarts music when the music context changes", () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const scheduled: (() => void)[] = [];
    const cleared: number[] = [];

    (globalThis as { window?: unknown }).window = {
      AudioContext: FakeAudioContext as unknown as typeof AudioContext,
      setTimeout: (callback: () => void) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      clearTimeout: (id: number) => {
        cleared.push(id);
      },
    };

    try {
      const audio = new GameAudio();
      audio.startMusic();
      expect(scheduled.length).toBe(1);

      audio.setMusicContext(2, false);
      expect(cleared.length).toBe(1);
      expect(scheduled.length).toBe(2);

      audio.stopMusic();
      expect(cleared.length).toBe(2);
    } finally {
      (globalThis as { window?: unknown }).window = previousWindow;
    }
  });

  it("builds the music graph once when unlocked", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.unlock();
      audio.unlock();

      const context = createdAudioContexts[previousContextCount]!;
      const master = context.createdGains[0]!;
      const musicBus = context.createdGains[1]!;
      const feedback = context.createdGains[2]!;
      const wet = context.createdGains[3]!;
      const filter = context.createdFilters[0]!;
      const delay = context.createdDelays[0]!;
      const compressor = context.createdCompressors[0]!;

      expect(createdAudioContexts.length).toBe(previousContextCount + 1);
      expect(context.createdGains.length).toBe(4);
      expect(context.createdFilters.length).toBe(1);
      expect(context.createdDelays.length).toBe(1);
      expect(context.createdCompressors.length).toBe(1);
      expect(master.gain.value).toBeCloseTo(0.225);
      expect(musicBus.gain.value).toBe(1);
      expect(feedback.gain.value).toBe(0.32);
      expect(wet.gain.value).toBe(0.22);
      expect(filter.type).toBe("lowpass");
      expect(filter.frequency.value).toBe(2600);
      expect(filter.Q.value).toBe(0.7);
      expect(delay.delayTime.value).toBeCloseTo(0.24);
      expect(compressor.threshold.value).toBe(-18);
      expect(compressor.knee.value).toBe(24);
      expect(compressor.ratio.value).toBe(3);
      expect(compressor.attack.value).toBeCloseTo(0.003);
      expect(compressor.release.value).toBeCloseTo(0.25);
      expect(context.destination.incoming).toContain(master);
      expect(musicBus.connections).toContain(filter);
      expect(filter.connections).toContain(compressor);
      expect(filter.connections).toContain(delay);
      expect(delay.connections).toContain(feedback);
      expect(feedback.connections).toContain(delay);
      expect(delay.connections).toContain(wet);
      expect(wet.connections).toContain(compressor);
      expect(compressor.connections).toContain(master);
    } finally {
      fake.restore();
    }
  });

  it("resumes suspended audio contexts on unlock", () => {
    const fake = installFakeWindow({ audioContext: SuspendedFakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.unlock();

      const context = createdAudioContexts[previousContextCount]!;
      expect(context.state).toBe("suspended");
      expect(context.resumeCalls).toBe(1);
    } finally {
      fake.restore();
    }
  });

  it("uses webkitAudioContext when AudioContext is unavailable", () => {
    const fake = installFakeWindow({ webkitAudioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.unlock();

      const context = createdAudioContexts[previousContextCount]!;
      expect(createdAudioContexts.length).toBe(previousContextCount + 1);
      expect(context.createdGains.length).toBe(4);
    } finally {
      fake.restore();
    }
  });

  it("does not create a context when Web Audio constructors are unavailable", () => {
    const fake = installFakeWindow();
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.unlock();
      audio.sfx("hit");
      audio.startMusic();

      expect(createdAudioContexts.length).toBe(previousContextCount);
    } finally {
      fake.restore();
    }
  });

  it("does not create a context when disabled or muted", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.setEnabled(false);
      audio.sfx("hit");
      audio.startMusic();
      expect(createdAudioContexts.length).toBe(previousContextCount);

      audio.setEnabled(true);
      audio.setVolume(0);
      audio.sfx("hit");
      audio.startMusic();
      expect(createdAudioContexts.length).toBe(previousContextCount);
    } finally {
      fake.restore();
    }
  });

  it("updates master gain when enabled and volume change", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.unlock();
      const master = createdAudioContexts[previousContextCount]!.createdGains[0]!;

      expect(master.gain.value).toBeCloseTo(0.225);
      audio.setVolume(1);
      expect(master.gain.value).toBeCloseTo(0.45);
      audio.setEnabled(false);
      expect(master.gain.value).toBe(0);
      audio.setEnabled(true);
      expect(master.gain.value).toBeCloseTo(0.45);
      audio.setVolume(0);
      expect(master.gain.value).toBe(0);
    } finally {
      fake.restore();
    }
  });

  it("routes SFX tones to master and noise through a lowpass buffer source", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.unlock();
      audio.sfx("menu");

      const context = createdAudioContexts[previousContextCount]!;
      const master = context.createdGains[0]!;
      const toneGain = context.createdGains[4]!;
      expect(toneGain.connections).toContain(master);
      expect(master.incoming).toContain(toneGain);

      audio.sfx("hit");
      audio.sfx("hit");
      expect(context.createdBufferSources.length).toBe(0);

      audio.sfx("hit");
      const noiseSource = context.createdBufferSources[0]!;
      const noiseFilter = context.createdFilters[1]!;
      const noiseGain = context.createdGains[context.createdGains.length - 1]!;
      expect(context.createdBuffers.length).toBe(1);
      expect(context.createdBuffers[0]!.length).toBeGreaterThan(0);
      expect(noiseSource.buffer).not.toBeNull();
      expect(noiseSource.connections).toContain(noiseFilter);
      expect(noiseFilter.type).toBe("lowpass");
      expect(noiseFilter.frequency.value).toBe(1800);
      expect(noiseFilter.connections).toContain(noiseGain);
      expect(noiseGain.connections).toContain(master);
    } finally {
      fake.restore();
    }
  });

  it("plays every SFX name safely when Web Audio is available", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.unlock();
      const names = ["menu", "select", "hit", "hurt", "kill", "pickup", "potion", "level", "stairs", "death"] as const;
      for (const name of names) {
        audio.sfx(name);
      }

      const context = createdAudioContexts[previousContextCount]!;
      expect(context.createdOscillators.length).toBeGreaterThan(0);
      expect(context.createdGains.length).toBeGreaterThan(4);
    } finally {
      fake.restore();
    }
  });

  it("routes music tones to the music bus and detunes melody voices", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.startMusic();

      const context = createdAudioContexts[previousContextCount]!;
      const musicBus = context.createdGains[1]!;
      const firstMusicGain = context.createdGains[4]!;
      expect(firstMusicGain.connections).toContain(musicBus);
      expect(musicBus.incoming.length).toBeGreaterThan(0);
      expect(context.createdOscillators.some((osc) => osc.detune.value === -7)).toBe(true);
      expect(context.createdOscillators.some((osc) => osc.detune.value === 7)).toBe(true);
    } finally {
      fake.restore();
    }
  });

  it("schedules the next music tick while playing", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      expect(fake.scheduled.length).toBe(1);

      fake.scheduled[0]!();
      expect(fake.scheduled.length).toBe(2);
    } finally {
      fake.restore();
    }
  });

  it("ignores stale music scheduler callbacks after stop", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.stopMusic();
      const scheduledCount = fake.scheduled.length;

      fake.scheduled[0]!();
      expect(fake.scheduled.length).toBe(scheduledCount);
    } finally {
      fake.restore();
    }
  });

  it("ignores stale music scheduler callbacks during a theme transition", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.setMusicContext(2, false);
      const scheduledCount = fake.scheduled.length;

      fake.scheduled[0]!();
      expect(fake.scheduled.length).toBe(scheduledCount);
    } finally {
      fake.restore();
    }
  });

  it("restarts music from a valid theme transition callback", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.setMusicContext(2, false);

      const context = createdAudioContexts[previousContextCount]!;
      const musicBus = context.createdGains[1]!;
      expect(fake.cleared).toEqual([1]);
      expect(fake.scheduled.length).toBe(2);
      expect(musicBus.gain.value).toBeCloseTo(0.0001);

      fake.scheduled[1]!();
      expect(fake.scheduled.length).toBe(3);
      expect(musicBus.gain.value).toBeCloseTo(1);

      audio.stopMusic();
      expect(fake.cleared).toContain(3);
    } finally {
      fake.restore();
    }
  });

  it("ignores stale theme transition callbacks when another transition replaces them", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.setMusicContext(2, false);
      audio.setMusicContext(3, true);

      expect(fake.cleared).toEqual([1, 2]);
      expect(fake.scheduled.length).toBe(3);

      fake.scheduled[1]!();
      expect(fake.scheduled.length).toBe(3);

      fake.scheduled[2]!();
      expect(fake.scheduled.length).toBe(4);
    } finally {
      fake.restore();
    }
  });

  it("ignores stale theme transition callbacks when startMusic replaces them", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.setMusicContext(2, false);
      audio.startMusic();

      expect(fake.cleared).toEqual([1, 2]);
      expect(fake.scheduled.length).toBe(3);

      fake.scheduled[1]!();
      expect(fake.scheduled.length).toBe(3);
    } finally {
      fake.restore();
    }
  });

  it("ignores stale theme transition callbacks after stopMusic", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.setMusicContext(2, false);
      audio.stopMusic();

      expect(fake.cleared).toEqual([1, 2]);
      const scheduledCount = fake.scheduled.length;

      fake.scheduled[1]!();
      expect(fake.scheduled.length).toBe(scheduledCount);
    } finally {
      fake.restore();
    }
  });

  it("ignores stale theme transition callbacks after disabling audio", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.setMusicContext(2, false);
      audio.setEnabled(false);

      expect(fake.cleared).toEqual([1, 2]);
      const scheduledCount = fake.scheduled.length;

      fake.scheduled[1]!();
      expect(fake.scheduled.length).toBe(scheduledCount);
    } finally {
      fake.restore();
    }
  });

  it("ignores stale theme transition callbacks after muting audio", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.setMusicContext(2, false);
      audio.setVolume(0);

      expect(fake.cleared).toEqual([1, 2]);
      const scheduledCount = fake.scheduled.length;

      fake.scheduled[1]!();
      expect(fake.scheduled.length).toBe(scheduledCount);
    } finally {
      fake.restore();
    }
  });

  it("does not duplicate music timers when startMusic is called twice", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.startMusic();
      expect(fake.scheduled.length).toBe(1);
    } finally {
      fake.restore();
    }
  });

  it("restarts music after stopMusic", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.stopMusic();
      audio.startMusic();

      expect(fake.cleared).toEqual([1]);
      expect(fake.scheduled.length).toBe(2);
    } finally {
      fake.restore();
    }
  });

  it("restarts music after disabling and re-enabling audio", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.setEnabled(false);
      audio.setEnabled(true);
      audio.startMusic();

      expect(fake.cleared).toEqual([1]);
      expect(fake.scheduled.length).toBe(2);
    } finally {
      fake.restore();
    }
  });

  it("starts music after unmuting", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.setVolume(0);
      audio.startMusic();
      expect(createdAudioContexts.length).toBe(previousContextCount);

      audio.setVolume(0.5);
      audio.startMusic();
      expect(createdAudioContexts.length).toBe(previousContextCount + 1);
      expect(fake.scheduled.length).toBe(1);
    } finally {
      fake.restore();
    }
  });

  it("does not schedule timers for no-op music context changes", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });

    try {
      const audio = new GameAudio();
      audio.startMusic();
      audio.setMusicContext(1, false);
      audio.setMusicContext(1, false);

      expect(fake.cleared.length).toBe(0);
      expect(fake.scheduled.length).toBe(1);
    } finally {
      fake.restore();
    }
  });

  it("updates music tone without scheduling when not playing", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.unlock();
      audio.setMusicContext(2, false);

      const context = createdAudioContexts[previousContextCount]!;
      expect(fake.scheduled.length).toBe(0);
      expect(fake.cleared.length).toBe(0);
      expect(context.createdFilters[0]!.frequency.value).toBe(2600);
      expect(context.createdDelays[0]!.delayTime.value).toBeCloseTo(0.21);
    } finally {
      fake.restore();
    }
  });

  it("maps depth and danger to music tone values", () => {
    const fake = installFakeWindow({ audioContext: FakeAudioContext });
    const previousContextCount = createdAudioContexts.length;

    try {
      const audio = new GameAudio();
      audio.unlock();
      const context = createdAudioContexts[previousContextCount]!;
      const filter = context.createdFilters[0]!;
      const delay = context.createdDelays[0]!;

      audio.setMusicContext(2, false);
      expect(filter.frequency.value).toBe(2600);
      expect(delay.delayTime.value).toBeCloseTo(0.21);

      audio.setMusicContext(5, false);
      expect(filter.frequency.value).toBe(2600);
      expect(delay.delayTime.value).toBeCloseTo(0.24);

      audio.setMusicContext(1, true);
      expect(filter.frequency.value).toBe(1800);
      expect(delay.delayTime.value).toBeCloseTo(0.165);
    } finally {
      fake.restore();
    }
  });
});
