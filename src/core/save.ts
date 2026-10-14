import type { Entity } from "./entities.ts";
import type { Inventory } from "./items.ts";
import type { GameMap } from "./mapgen/common.ts";
import { BASE_SEED } from "./constants.ts";

export const SAVE_VERSION = 2;

export interface SavedFloor {
  depth: number;
  map: GameMap;
  monsters: Entity[];
  explored: number[];
}

export interface SavedRun {
  version: number;
  seed: number;
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

function isPoint(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.x === "number" && typeof p.y === "number";
}

function isEntityShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "number" &&
    typeof e.name === "string" &&
    typeof e.x === "number" &&
    typeof e.y === "number" &&
    typeof e.hp === "number" &&
    typeof e.maxHp === "number" &&
    typeof e.atk === "number" &&
    typeof e.def === "number" &&
    typeof e.sprite === "number" &&
    typeof e.isPlayer === "boolean" &&
    typeof e.alive === "boolean" &&
    typeof e.xp === "number" &&
    typeof e.level === "number" &&
    typeof e.xpValue === "number" &&
    typeof e.skillPoints === "number" &&
    typeof e.archetype === "string" &&
    typeof e.speed === "number" &&
    typeof e.range === "number" &&
    Array.isArray(e.statuses)
  );
}

function isGameMapShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.width === "number" &&
    typeof m.height === "number" &&
    Array.isArray(m.cells) &&
    m.cells.every((row) => Array.isArray(row) && row.every((c) => typeof c === "string")) &&
    Array.isArray(m.rooms) &&
    isPoint(m.spawn) &&
    isPoint(m.stairs) &&
    (m.upStairs === null || isPoint(m.upStairs)) &&
    Array.isArray(m.items) &&
    typeof m.algorithm === "string"
  );
}

function isInventoryShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const inv = value as Record<string, unknown>;
  return (
    typeof inv.gold === "number" &&
    typeof inv.potions === "number" &&
    typeof inv.torches === "number" &&
    typeof inv.sword === "boolean" &&
    typeof inv.shield === "boolean"
  );
}

function isSavedFloorShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.depth === "number" &&
    isGameMapShape(f.map) &&
    Array.isArray(f.monsters) &&
    f.monsters.every(isEntityShape) &&
    Array.isArray(f.explored) &&
    f.explored.every((n) => typeof n === "number")
  );
}

export function migrateSavedRun(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const v = value as Record<string, unknown>;
  if (v.version === 1) {
    return {
      ...v,
      version: SAVE_VERSION,
      seed: typeof v.seed === "number" ? v.seed : BASE_SEED,
    };
  }
  return v;
}

export function isSavedRun(value: unknown): value is SavedRun {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<SavedRun>;
  return (
    v.version === SAVE_VERSION &&
    typeof v.seed === "number" &&
    typeof v.depth === "number" &&
    typeof v.kills === "number" &&
    typeof v.gameOver === "boolean" &&
    (v.screen === "title" || v.screen === "game") &&
    isEntityShape(v.player) &&
    isInventoryShape(v.inventory) &&
    typeof v.lightTurns === "number" &&
    typeof v.godMode === "boolean" &&
    typeof v.aiRng === "number" &&
    typeof v.battleRng === "number" &&
    Array.isArray(v.floors) &&
    v.floors.every(isSavedFloorShape) &&
    Array.isArray(v.messages) &&
    v.messages.every((m) => typeof m === "string")
  );
}
