import { describe, expect, it } from "bun:test";
import { GameAudio } from "../../src/platform/audio.ts";

class FakeParam {
  value = 0;
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeNode {
  connect(): void {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type = "";
  frequency = new FakeParam();
  start(): void {}
  stop(): void {}
}

const createdAudioContexts: FakeAudioContext[] = [];

class FakeAudioContext {
  currentTime = 0;
  state = "running" as const;
  destination = new FakeNode();
  createdOscillators: FakeOscillator[] = [];

  constructor() {
    createdAudioContexts.push(this);
  }

  createGain(): FakeGain {
    return new FakeGain();
  }

  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator();
    this.createdOscillators.push(osc);
    return osc;
  }

  resume(): void {}
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

  it("stores volume and mute state", () => {
    const audio = new GameAudio();
    audio.setVolume(1.5);
    expect(audio.volume).toBe(1);
    audio.setVolume(-1);
    expect(audio.volume).toBe(0);
    audio.setMuted(true);
    expect(audio.muted).toBe(true);
    audio.startMusic();
    expect(audio.muted).toBe(true);
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
});
