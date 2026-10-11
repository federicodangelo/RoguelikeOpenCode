import { describe, expect, it } from "bun:test";
import {
  cycleScalingMode,
  cycleVolume,
  defaultSettings,
  loadSettings,
  saveSettings,
} from "../../src/platform/settings.ts";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    data,
  };
}

describe("settings", () => {
  it("returns defaults when storage is empty", () => {
    expect(loadSettings(fakeStorage())).toEqual(defaultSettings());
  });

  it("loads persisted scaling and sound settings", () => {
    const storage = fakeStorage({
      "roguelike.settings": JSON.stringify({
        scalingMode: "smooth",
        soundEnabled: false,
        volume: 0.75,
      }),
    });
    expect(loadSettings(storage)).toEqual({
      scalingMode: "smooth",
      soundEnabled: false,
      volume: 0.75,
    });
  });

  it("migrates legacy fractionalScaling boolean", () => {
    const storage = fakeStorage({
      "roguelike.settings": JSON.stringify({ fractionalScaling: false }),
    });
    expect(loadSettings(storage).scalingMode).toBe("integer");
  });

  it("saves settings to storage", () => {
    const storage = fakeStorage();
    saveSettings(storage, { scalingMode: "integer", soundEnabled: false, volume: 0.25 });
    expect(JSON.parse(storage.data.get("roguelike.settings") ?? "{}")).toEqual({
      scalingMode: "integer",
      soundEnabled: false,
      volume: 0.25,
    });
  });

  it("cycles scaling modes", () => {
    expect(cycleScalingMode("integer")).toBe("fractional");
    expect(cycleScalingMode("fractional")).toBe("smooth");
    expect(cycleScalingMode("smooth")).toBe("integer");
  });

  it("cycles volume through fixed steps", () => {
    expect(cycleVolume(0.5)).toBe(0.75);
    expect(cycleVolume(1)).toBe(0);
    expect(cycleVolume(0)).toBe(0.25);
    expect(cycleVolume(0.6)).toBe(0.75);
  });
});
