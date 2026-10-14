import { T } from "./tiles.ts";
import type { RNG } from "./rng.ts";
import type { Entity } from "./entities.ts";

export type ItemKind = "potion" | "gold" | "weapon" | "armor" | "torch" | "corpse";

export type Quality = "common" | "uncommon" | "rare";

export interface ItemDef {
  kind: ItemKind;
  variant: string;
  tile: number;
  baseStat: number;
  minDepth: number;
  weight: number;
}

export const ITEM_DEFS: ItemDef[] = [
  { kind: "gold", variant: "gold", tile: T.Gold, baseStat: 1, minDepth: 1, weight: 12 },
  { kind: "potion", variant: "minor potion", tile: T.Potion, baseStat: 5, minDepth: 1, weight: 14 },
  { kind: "potion", variant: "major potion", tile: T.Potion, baseStat: 9, minDepth: 3, weight: 5 },
  { kind: "torch", variant: "torch", tile: T.Torch, baseStat: 0, minDepth: 1, weight: 12 },
  { kind: "torch", variant: "bullseye lantern", tile: T.Torch, baseStat: 0, minDepth: 3, weight: 4 },
  { kind: "weapon", variant: "dagger", tile: T.Sword, baseStat: 1, minDepth: 1, weight: 8 },
  { kind: "weapon", variant: "short sword", tile: T.Sword, baseStat: 2, minDepth: 1, weight: 7 },
  { kind: "weapon", variant: "long sword", tile: T.Sword, baseStat: 3, minDepth: 3, weight: 4 },
  { kind: "weapon", variant: "battle axe", tile: T.Sword, baseStat: 4, minDepth: 4, weight: 3 },
  { kind: "armor", variant: "buckler", tile: T.Shield, baseStat: 1, minDepth: 1, weight: 7 },
  { kind: "armor", variant: "iron shield", tile: T.Shield, baseStat: 2, minDepth: 2, weight: 6 },
  { kind: "armor", variant: "kite shield", tile: T.Shield, baseStat: 3, minDepth: 4, weight: 3 },
];

export interface ItemInstance {
  kind: ItemKind;
  variant: string;
  quality: Quality;
  tile: number;
  stat: number;
}

export const QUALITY_BONUS: Record<Quality, number> = { common: 0, uncommon: 1, rare: 2 };

export function rollQuality(rng: RNG, depth: number): Quality {
  const rare = Math.min(0.04 + depth * 0.02, 0.24);
  const uncommon = Math.min(0.18 + depth * 0.03, 0.46);
  const r = rng.next();
  if (r < rare) return "rare";
  if (r < rare + uncommon) return "uncommon";
  return "common";
}

export function pickDefWhere(rng: RNG, depth: number, pred: (d: ItemDef) => boolean): ItemDef | null {
  const pool = ITEM_DEFS.filter((d) => d.minDepth <= depth && pred(d));
  if (pool.length === 0) return null;
  let total = 0;
  for (const d of pool) total += d.weight;
  let r = rng.next() * total;
  for (const d of pool) {
    r -= d.weight;
    if (r < 0) return d;
  }
  return pool[pool.length - 1]!;
}

export function pickDef(rng: RNG, depth: number): ItemDef {
  return pickDefWhere(rng, depth, () => true) ?? ITEM_DEFS[0]!;
}

export function makeInstance(def: ItemDef, quality: Quality): ItemInstance {
  return {
    kind: def.kind,
    variant: def.variant,
    quality,
    tile: def.tile,
    stat: def.baseStat + QUALITY_BONUS[quality],
  };
}

export function makeCorpse(): ItemInstance {
  return { kind: "corpse", variant: "corpse", quality: "common", tile: T.Corpse, stat: 0 };
}

export function makeGold(stat: number): ItemInstance {
  return { kind: "gold", variant: "gold", quality: "common", tile: T.Gold, stat };
}

export interface Inventory {
  gold: number;
  potions: number;
  torches: number;
  sword: number;
  shield: number;
}

export function makeInventory(): Inventory {
  return { gold: 0, potions: 0, torches: 0, sword: 0, shield: 0 };
}

export function recalcStats(player: Entity, inv: Inventory): void {
  player.atk = player.baseAtk + inv.sword;
  player.def = player.baseDef + inv.shield;
}

export function pickUp(player: Entity, inv: Inventory, item: ItemInstance): string | null {
  if (item.kind === "corpse") return null;
  switch (item.kind) {
    case "gold":
      inv.gold += item.stat;
      return `You pick up ${item.stat} gold.`;
    case "potion":
      inv.potions += 1;
      return `You pick up a ${item.variant}.`;
    case "weapon":
      if (inv.sword > 0) return "You already have a weapon equipped.";
      inv.sword = item.stat;
      recalcStats(player, inv);
      return `You equip the ${item.variant} (+${item.stat} ATK).`;
    case "armor":
      if (inv.shield > 0) return "You already have an armor equipped.";
      inv.shield = item.stat;
      recalcStats(player, inv);
      return `You equip the ${item.variant} (+${item.stat} DEF).`;
    case "torch":
      inv.torches += 1;
      return `You pick up a ${item.variant}.`;
  }
}

export function useTorch(inv: Inventory): string | null {
  if (inv.torches <= 0) return null;
  inv.torches -= 1;
  return "You light a torch.";
}

export function usePotion(player: Entity, inv: Inventory): string | null {
  if (inv.potions <= 0) return null;
  if (player.hp >= player.maxHp) return "You are already at full health.";
  inv.potions -= 1;
  player.hp = Math.min(player.maxHp, player.hp + 5);
  return "You drink a potion (+5 HP).";
}
