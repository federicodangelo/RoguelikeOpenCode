import { describe, expect, it } from "bun:test";
import { GameAudio } from "../../src/platform/audio.ts";

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
});
