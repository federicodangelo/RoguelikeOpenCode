import { SCALING_MODES, type ScalingMode } from "../ui/scaling.ts";

export const SETTINGS_KEY = "roguelike.settings";

export interface Settings {
  scalingMode: ScalingMode;
  soundEnabled: boolean;
}

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultSettings(): Settings {
  return { scalingMode: "fractional", soundEnabled: true };
}

export function loadSettings(storage: SettingsStorage): Settings {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();

    const s = JSON.parse(raw) as {
      scalingMode?: ScalingMode;
      fractionalScaling?: boolean;
      soundEnabled?: boolean;
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
