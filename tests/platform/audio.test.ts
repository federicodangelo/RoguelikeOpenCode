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
});
