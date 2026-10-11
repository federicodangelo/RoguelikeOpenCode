import { SCALING_MODES, type ScalingMode } from "../ui/scaling.ts";

export const SETTINGS_KEY = "roguelike.settings";

export const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

export interface Settings {
  scalingMode: ScalingMode;
  soundEnabled: boolean;
  volume: number;
  autosave: boolean;
}

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultSettings(): Settings {
  return { scalingMode: "fractional", soundEnabled: true, volume: 0.5, autosave: true };
}

export function loadSettings(storage: SettingsStorage): Settings {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();

    const s = JSON.parse(raw) as {
      scalingMode?: ScalingMode;
      fractionalScaling?: boolean;
      soundEnabled?: boolean;
      volume?: number;
      autosave?: boolean;
    };

    const scalingMode =
      s.scalingMode && SCALING_MODES.includes(s.scalingMode)
        ? s.scalingMode
        : typeof s.fractionalScaling === "boolean"
          ? s.fractionalScaling
            ? "fractional"
            : "integer"
          : "fractional";

    return {
      scalingMode,
      soundEnabled: typeof s.soundEnabled === "boolean" ? s.soundEnabled : true,
      volume: typeof s.volume === "number" ? Math.max(0, Math.min(1, s.volume)) : 0.5,
      autosave: typeof s.autosave === "boolean" ? s.autosave : true,
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(storage: SettingsStorage, settings: Settings): void {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable; keep in-memory settings
  }
}

export function cycleScalingMode(mode: ScalingMode): ScalingMode {
  return SCALING_MODES[(SCALING_MODES.indexOf(mode) + 1) % SCALING_MODES.length] ?? "fractional";
}

export function cycleVolume(volume: number): number {
  const clamped = Math.max(0, Math.min(1, volume));
  let nearest: number = VOLUME_STEPS[0]!;
  let best = Math.abs(clamped - nearest);
  for (const step of VOLUME_STEPS) {
    const distance = Math.abs(clamped - step);
    if (distance < best) {
      nearest = step;
      best = distance;
    }
  }
  const idx = VOLUME_STEPS.indexOf(nearest as (typeof VOLUME_STEPS)[number]);
  return VOLUME_STEPS[(idx + 1) % VOLUME_STEPS.length] ?? 0.5;
}
