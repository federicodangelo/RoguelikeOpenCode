import type { Entity } from "./entities.ts";
import type { Inventory } from "./items.ts";
import type { GameMap } from "./mapgen/common.ts";
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
    typeof e.baseAtk === "number" &&
    typeof e.baseDef === "number" &&
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
    m.items.every((it) => {
      if (!isPoint(it)) return false;
      const i = it as Record<string, unknown>;
      return (
        typeof i.kind === "string" &&
        typeof i.variant === "string" &&
        typeof i.quality === "string" &&
        typeof i.tile === "number" &&
        typeof i.stat === "number"
      );
    }) &&
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
    typeof i.tile === "number" &&
    typeof i.stat === "number" &&
    (i.uid === undefined || typeof i.uid === "number")
  );
}

function isConsumableStackShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.kind === "string" &&
    typeof s.variant === "string" &&
    typeof s.quality === "string" &&
    typeof s.tile === "number" &&
    typeof s.stat === "number" &&
    typeof s.count === "number"
  );
}

function isInventoryShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const inv = value as Record<string, unknown>;
  const eq = inv.equipment;
  return (
    typeof inv.gold === "number" &&
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
    typeof f.depth === "number" &&
    isGameMapShape(f.map) &&
    Array.isArray(f.monsters) &&
    f.monsters.every(isEntityShape) &&
    Array.isArray(f.explored) &&
    f.explored.every((n) => typeof n === "number")
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
