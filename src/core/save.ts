import type { Entity } from "./entities.ts";
import type { Inventory } from "./items.ts";
import type { GameMap } from "./mapgen/common.ts";

export const SAVE_VERSION = 1;

export interface SavedFloor {
  depth: number;
  map: GameMap;
  monsters: Entity[];
  explored: number[];
}

export interface SavedRun {
  version: number;
  depth: number;
  kills: number;
  gameOver: boolean;
  screen: "title" | "game";
  player: Entity;
  inventory: Inventory;
  lightTurns: number;
  godMode: boolean;
  aiRng: number;
  battleRng: number;
  floors: SavedFloor[];
  messages: string[];
}

export function isSavedRun(value: unknown): value is SavedRun {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<SavedRun>;
  return (
    v.version === SAVE_VERSION &&
    typeof v.depth === "number" &&
    typeof v.kills === "number" &&
    typeof v.gameOver === "boolean" &&
    (v.screen === "title" || v.screen === "game") &&
    typeof v.player === "object" &&
    v.player !== null &&
    typeof v.inventory === "object" &&
    v.inventory !== null &&
    typeof v.lightTurns === "number" &&
    typeof v.godMode === "boolean" &&
    typeof v.aiRng === "number" &&
    typeof v.battleRng === "number" &&
    Array.isArray(v.floors) &&
    Array.isArray(v.messages)
  );
}
