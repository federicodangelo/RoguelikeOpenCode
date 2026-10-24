import type { Entity } from "./entities.ts";
import type { Inventory } from "./items.ts";
import type { SavedMessage } from "./messages.ts";
import { MAP_H, MAP_W, type GameMap } from "./mapgen/common.ts";
import { BASE_SEED, TORCH_TURNS } from "./constants.ts";
import { T } from "./tiles.ts";

export const SAVE_VERSION = 5;

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
  /** Runs written before colors were stored keep the bare text; both shapes load. */
  messages: (string | SavedMessage)[];
}

function isInt(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value);
}

function isNonNegativeInt(value: unknown): boolean {
  return isInt(value) && (value as number) >= 0;
}

function isCoord(value: unknown, limit: number): boolean {
  return isInt(value) && (value as number) >= 0 && (value as number) < limit;
}

function isHp(value: unknown, maxHp: unknown): boolean {
  return (
    isInt(value) &&
    isInt(maxHp) &&
    (maxHp as number) >= 1 &&
    (value as number) >= 0 &&
    (value as number) <= (maxHp as number)
  );
}

function isPositiveInt(value: unknown): boolean {
  return isInt(value) && (value as number) >= 1;
}

function isPoint(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return isCoord(p.x, MAP_W) && isCoord(p.y, MAP_H);
}

function isStatusShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.kind === "string" && isNonNegativeInt(s.turns) && isNonNegativeInt(s.power);
}

function isEntityShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    isNonNegativeInt(e.id) &&
    typeof e.name === "string" &&
    isCoord(e.x, MAP_W) &&
    isCoord(e.y, MAP_H) &&
    isHp(e.hp, e.maxHp) &&
    isNonNegativeInt(e.atk) &&
    isNonNegativeInt(e.def) &&
    isNonNegativeInt(e.baseAtk) &&
    isNonNegativeInt(e.baseDef) &&
    isNonNegativeInt(e.sprite) &&
    typeof e.isPlayer === "boolean" &&
    typeof e.alive === "boolean" &&
    isNonNegativeInt(e.xp) &&
    isPositiveInt(e.level) &&
    isNonNegativeInt(e.xpValue) &&
    isNonNegativeInt(e.skillPoints) &&
    typeof e.archetype === "string" &&
    isPositiveInt(e.speed) &&
    isNonNegativeInt(e.range) &&
    Array.isArray(e.statuses) &&
    e.statuses.every(isStatusShape)
  );
}

function isGameMapShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    isPositiveInt(m.width) &&
    isPositiveInt(m.height) &&
    Array.isArray(m.cells) &&
    m.cells.length === m.height &&
    m.cells.every((row) => Array.isArray(row) && row.length === m.width && row.every((c) => typeof c === "string")) &&
    Array.isArray(m.rooms) &&
    isPoint(m.spawn) &&
    isPoint(m.stairs) &&
    (m.upStairs === null || isPoint(m.upStairs)) &&
    Array.isArray(m.items) &&
    m.items.every((it) => isPoint(it) && isItemInstanceShape(it)) &&
    typeof m.algorithm === "string"
  );
}

function isItemInstanceShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const i = value as Record<string, unknown>;
  return (
    typeof i.kind === "string" &&
    typeof i.variant === "string" &&
    typeof i.quality === "string" &&
    isNonNegativeInt(i.tile) &&
    isInt(i.stat) &&
    (i.uid === undefined || isNonNegativeInt(i.uid))
  );
}

function isConsumableStackShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.kind === "string" &&
    typeof s.variant === "string" &&
    typeof s.quality === "string" &&
    isNonNegativeInt(s.tile) &&
    isInt(s.stat) &&
    isPositiveInt(s.count)
  );
}

function isInventoryShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const inv = value as Record<string, unknown>;
  const eq = inv.equipment;
  return (
    isNonNegativeInt(inv.gold) &&
    Array.isArray(inv.consumables) &&
    inv.consumables.every(isConsumableStackShape) &&
    Array.isArray(inv.carried) &&
    inv.carried.every(isItemInstanceShape) &&
    typeof eq === "object" &&
    eq !== null &&
    ((eq as Record<string, unknown>).weapon === null || isItemInstanceShape((eq as Record<string, unknown>).weapon)) &&
    ((eq as Record<string, unknown>).armor === null || isItemInstanceShape((eq as Record<string, unknown>).armor))
  );
}

function isSavedFloorShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    isPositiveInt(f.depth) &&
    isGameMapShape(f.map) &&
    Array.isArray(f.monsters) &&
    f.monsters.every(isEntityShape) &&
    Array.isArray(f.explored) &&
    f.explored.every((n) => isNonNegativeInt(n) && (n as number) < MAP_W * MAP_H)
  );
}

function itemFromLegacyTile(tile: number): Record<string, unknown> {
  switch (tile) {
    case T.Sword:
      return { kind: "weapon", variant: "short sword", quality: "common", tile, stat: 1 };
    case T.Shield:
      return { kind: "armor", variant: "iron shield", quality: "common", tile, stat: 1 };
    case T.Potion:
      return { kind: "potion", variant: "minor potion", quality: "common", tile, stat: 5 };
    case T.Torch:
      return { kind: "torch", variant: "torch", quality: "common", tile, stat: 0 };
    case T.Corpse:
      return { kind: "corpse", variant: "corpse", quality: "common", tile, stat: 0 };
    default:
      return { kind: "gold", variant: "gold", quality: "common", tile: T.Gold, stat: 1 };
  }
}

function migrateV2toV3(v: Record<string, unknown>): Record<string, unknown> {
  const inv = (typeof v.inventory === "object" && v.inventory !== null ? v.inventory : {}) as Record<string, unknown>;
  const sword = inv.sword === true ? 1 : typeof inv.sword === "number" ? inv.sword : 0;
  const shield = inv.shield === true ? 1 : typeof inv.shield === "number" ? inv.shield : 0;

  const player = (typeof v.player === "object" && v.player !== null ? v.player : {}) as Record<string, unknown>;
  const atk = typeof player.atk === "number" ? player.atk : 3;
  const def = typeof player.def === "number" ? player.def : 1;

  const floors = Array.isArray(v.floors)
    ? v.floors.map((f) => {
        if (typeof f !== "object" || f === null) return f;
        const fl = f as Record<string, unknown>;
        const map = (typeof fl.map === "object" && fl.map !== null ? fl.map : {}) as Record<string, unknown>;
        const items = Array.isArray(map.items)
          ? map.items.map((it) => {
              if (typeof it !== "object" || it === null) return it;
              const item = it as Record<string, unknown>;
              if (typeof item.kind === "string") return item;
              return {
                x: item.x,
                y: item.y,
                ...itemFromLegacyTile(typeof item.tile === "number" ? item.tile : T.Gold),
              };
            })
          : map.items;
        const monsters = Array.isArray(fl.monsters)
          ? fl.monsters.map((m) => {
              if (typeof m !== "object" || m === null) return m;
              const mon = m as Record<string, unknown>;
              if (typeof mon.baseAtk === "number") return mon;
              return { ...mon, baseAtk: mon.atk, baseDef: mon.def };
            })
          : fl.monsters;
        return { ...fl, map: { ...map, items }, monsters };
      })
    : v.floors;

  return {
    ...v,
    version: 3,
    inventory: { ...inv, sword, shield },
    player: {
      ...player,
      baseAtk: typeof player.baseAtk === "number" ? player.baseAtk : atk - sword,
      baseDef: typeof player.baseDef === "number" ? player.baseDef : def - shield,
    },
    floors,
  };
}

function migrateV3toV4(v: Record<string, unknown>): Record<string, unknown> {
  const inv = (typeof v.inventory === "object" && v.inventory !== null ? v.inventory : {}) as Record<string, unknown>;
  if (Array.isArray(inv.consumables)) return { ...v, version: 4 };

  const potions = typeof inv.potions === "number" ? inv.potions : 0;
  const torches = typeof inv.torches === "number" ? inv.torches : 0;
  const sword = typeof inv.sword === "number" ? inv.sword : 0;
  const shield = typeof inv.shield === "number" ? inv.shield : 0;

  const consumables: Record<string, unknown>[] = [];
  if (potions > 0) {
    consumables.push({
      kind: "potion",
      variant: "minor potion",
      quality: "common",
      tile: T.Potion,
      stat: 5,
      count: potions,
    });
  }
  if (torches > 0) {
    consumables.push({
      kind: "torch",
      variant: "torch",
      quality: "common",
      tile: T.Torch,
      stat: TORCH_TURNS,
      count: torches,
    });
  }

  const equipment = {
    weapon:
      sword > 0 ? { kind: "weapon", variant: "short sword", quality: "common", tile: T.Sword, stat: sword } : null,
    armor:
      shield > 0 ? { kind: "armor", variant: "iron shield", quality: "common", tile: T.Shield, stat: shield } : null,
  };

  return {
    ...v,
    version: 4,
    inventory: {
      gold: typeof inv.gold === "number" ? inv.gold : 0,
      consumables,
      carried: [],
      equipment,
    },
  };
}

function shiftTile(tile: unknown): unknown {
  return typeof tile === "number" && tile > 21 ? tile - 1 : tile;
}

function migrateItemTiles(item: unknown): unknown {
  if (typeof item !== "object" || item === null) return item;
  const it = item as Record<string, unknown>;
  return { ...it, tile: shiftTile(it.tile) };
}

function migrateV4toV5(v: Record<string, unknown>): Record<string, unknown> {
  const inv = (typeof v.inventory === "object" && v.inventory !== null ? v.inventory : {}) as Record<string, unknown>;
  const eq = (typeof inv.equipment === "object" && inv.equipment !== null ? inv.equipment : {}) as Record<
    string,
    unknown
  >;

  const floors = Array.isArray(v.floors)
    ? v.floors.map((f) => {
        if (typeof f !== "object" || f === null) return f;
        const fl = f as Record<string, unknown>;
        const map = (typeof fl.map === "object" && fl.map !== null ? fl.map : {}) as Record<string, unknown>;
        const cells = Array.isArray(map.cells)
          ? map.cells.map((row) => (Array.isArray(row) ? row.map((c) => (c === "trap" ? "floor" : c)) : row))
          : map.cells;
        const items = Array.isArray(map.items) ? map.items.map(migrateItemTiles) : map.items;
        return { ...fl, map: { ...map, cells, items } };
      })
    : v.floors;

  return {
    ...v,
    version: SAVE_VERSION,
    inventory: {
      ...inv,
      consumables: Array.isArray(inv.consumables) ? inv.consumables.map(migrateItemTiles) : inv.consumables,
      carried: Array.isArray(inv.carried) ? inv.carried.map(migrateItemTiles) : inv.carried,
      equipment: {
        ...eq,
        weapon: eq.weapon === null ? null : migrateItemTiles(eq.weapon),
        armor: eq.armor === null ? null : migrateItemTiles(eq.armor),
      },
    },
    floors,
  };
}

export function migrateSavedRun(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  let v = value as Record<string, unknown>;
  if (v.version === 1) {
    v = { ...v, version: 2, seed: typeof v.seed === "number" ? v.seed : BASE_SEED };
  }
  if (v.version === 2) {
    v = migrateV2toV3(v);
  }
  if (v.version === 3) {
    v = migrateV3toV4(v);
  }
  if (v.version === 4) {
    v = migrateV4toV5(v);
  }
  return v;
}

function isSavedMessageShape(value: unknown): boolean {
  if (typeof value === "string") return true;
  if (typeof value !== "object" || value === null) return false;
  const m = value as Partial<SavedMessage>;
  return typeof m.text === "string" && (m.color === undefined || typeof m.color === "string");
}

export function isSavedRun(value: unknown): value is SavedRun {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<SavedRun>;
  return (
    v.version === SAVE_VERSION &&
    isInt(v.seed) &&
    isPositiveInt(v.depth) &&
    isNonNegativeInt(v.kills) &&
    typeof v.gameOver === "boolean" &&
    (v.screen === "title" || v.screen === "game") &&
    isEntityShape(v.player) &&
    isInventoryShape(v.inventory) &&
    isNonNegativeInt(v.lightTurns) &&
    typeof v.godMode === "boolean" &&
    isNonNegativeInt(v.aiRng) &&
    isNonNegativeInt(v.battleRng) &&
    Array.isArray(v.floors) &&
    v.floors.every(isSavedFloorShape) &&
    Array.isArray(v.messages) &&
    v.messages.every(isSavedMessageShape)
  );
}
