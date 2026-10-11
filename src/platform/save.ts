import { isSavedRun, SAVE_VERSION, type SavedRun } from "../core/save.ts";
import type { Game } from "../core/game.ts";

export const SAVE_KEY = "roguelike.save";

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveRun(storage: SaveStorage, game: Game): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(game.serialize()));
  } catch {
    // storage unavailable; keep in-memory run
  }
}

export function loadRun(storage: SaveStorage, game: Game): boolean {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (!isSavedRun(parsed)) {
      storage.removeItem(SAVE_KEY);
      return false;
    }
    game.loadRun(parsed as SavedRun);
    return true;
  } catch {
    storage.removeItem(SAVE_KEY);
    return false;
  }
}

export function clearRun(storage: SaveStorage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // storage unavailable; nothing to clear
  }
}

export function hasSavedRun(storage: SaveStorage): boolean {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return false;
    return isSavedRun(JSON.parse(raw) as unknown);
  } catch {
    return false;
  }
}

export function savedRunVersion(storage: SaveStorage): number | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number };
    return parsed.version === SAVE_VERSION ? SAVE_VERSION : null;
  } catch {
    return null;
  }
}
