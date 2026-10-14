import { T } from "./tiles.ts";
import type { RNG } from "./rng.ts";
import type { Entity } from "./entities.ts";
import { CARRIED_CAP, TORCH_TURNS } from "./constants.ts";

export type ItemKind = "potion" | "gold" | "weapon" | "armor" | "torch" | "corpse";

export type Quality = "common" | "uncommon" | "rare";

export type EquipSlot = "weapon" | "armor";

export type ConsumableKind = "potion" | "torch";

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
  { kind: "potion", variant: "major potion", tile: T.MajorPotion, baseStat: 9, minDepth: 3, weight: 5 },
  { kind: "torch", variant: "torch", tile: T.Torch, baseStat: TORCH_TURNS, minDepth: 1, weight: 12 },
  { kind: "torch", variant: "bullseye lantern", tile: T.Lantern, baseStat: 30, minDepth: 3, weight: 4 },
  { kind: "weapon", variant: "dagger", tile: T.Dagger, baseStat: 1, minDepth: 1, weight: 8 },
  { kind: "weapon", variant: "short sword", tile: T.Sword, baseStat: 2, minDepth: 1, weight: 7 },
  { kind: "weapon", variant: "long sword", tile: T.LongSword, baseStat: 3, minDepth: 3, weight: 4 },
  { kind: "weapon", variant: "battle axe", tile: T.BattleAxe, baseStat: 4, minDepth: 4, weight: 3 },
  { kind: "armor", variant: "buckler", tile: T.Buckler, baseStat: 1, minDepth: 1, weight: 7 },
  { kind: "armor", variant: "iron shield", tile: T.Shield, baseStat: 2, minDepth: 2, weight: 6 },
  { kind: "armor", variant: "kite shield", tile: T.KiteShield, baseStat: 3, minDepth: 4, weight: 3 },
];

export interface ItemInstance {
  kind: ItemKind;
  variant: string;
  quality: Quality;
  tile: number;
  stat: number;
  uid?: number;
}

export const QUALITY_BONUS: Record<Quality, number> = { common: 0, uncommon: 1, rare: 2 };

export function qualityColor(quality: Quality): string {
  switch (quality) {
    case "common":
      return "#e8e4da";
    case "uncommon":
      return "#9be56f";
    case "rare":
      return "#7ab8ff";
  }
}

let nextUid = 1;

export function setNextUid(value: number): void {
  if (value > nextUid) nextUid = value;
}

function takeUid(): number {
  return nextUid++;
}

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

export function itemName(item: ItemInstance): string {
  return item.quality === "common" ? item.variant : `${item.quality} ${item.variant}`;
}

export interface ConsumableStack {
  kind: ConsumableKind;
  variant: string;
  quality: Quality;
  tile: number;
  stat: number;
  count: number;
}

export interface EquipmentSlots {
  weapon: ItemInstance | null;
  armor: ItemInstance | null;
}

export interface Inventory {
  gold: number;
  consumables: ConsumableStack[];
  carried: ItemInstance[];
  equipment: EquipmentSlots;
}

export function makeInventory(): Inventory {
  return { gold: 0, consumables: [], carried: [], equipment: { weapon: null, armor: null } };
}

export function countConsumable(inv: Inventory, kind: ConsumableKind): number {
  return inv.consumables.reduce((n, s) => (s.kind === kind ? n + s.count : n), 0);
}

export function recalcStats(player: Entity, inv: Inventory): void {
  player.atk = player.baseAtk + (inv.equipment.weapon?.stat ?? 0);
  player.def = player.baseDef + (inv.equipment.armor?.stat ?? 0);
}

export interface PickupResult {
  message: string;
  took: boolean;
}

function addConsumable(inv: Inventory, item: ItemInstance): void {
  const stack = inv.consumables.find(
    (s) => s.kind === item.kind && s.variant === item.variant && s.quality === item.quality,
  );
  if (stack) {
    stack.count += 1;
    return;
  }
  inv.consumables.push({
    kind: item.kind as ConsumableKind,
    variant: item.variant,
    quality: item.quality,
    tile: item.tile,
    stat: item.stat,
    count: 1,
  });
}

export function pickUp(player: Entity, inv: Inventory, item: ItemInstance): PickupResult | null {
  if (item.kind === "corpse") return null;
  switch (item.kind) {
    case "gold":
      inv.gold += item.stat;
      return { message: `You pick up ${item.stat} gold.`, took: true };
    case "potion":
    case "torch":
      addConsumable(inv, item);
      return { message: `You pick up a ${item.variant}.`, took: true };
    case "weapon":
    case "armor": {
      const slot: EquipSlot = item.kind;
      if (inv.equipment[slot] === null) {
        if (item.uid === undefined) item.uid = takeUid();
        inv.equipment[slot] = item;
        recalcStats(player, inv);
        const bonus = slot === "weapon" ? "ATK" : "DEF";
        return { message: `You equip the ${item.variant} (+${item.stat} ${bonus}).`, took: true };
      }
      if (inv.carried.length >= CARRIED_CAP) return { message: "Your pack is full.", took: false };
      if (item.uid === undefined) item.uid = takeUid();
      inv.carried.push(item);
      return { message: `You stow the ${item.variant} (${inv.carried.length}/${CARRIED_CAP}).`, took: true };
    }
  }
}

export function equipCarried(player: Entity, inv: Inventory, index: number): string | null {
  const item = inv.carried[index];
  if (!item || (item.kind !== "weapon" && item.kind !== "armor")) return null;
  const slot: EquipSlot = item.kind;
  const old = inv.equipment[slot];
  inv.carried.splice(index, 1);
  inv.equipment[slot] = item;
  if (old) inv.carried.push(old);
  recalcStats(player, inv);
  const bonus = slot === "weapon" ? "ATK" : "DEF";
  return `You equip the ${item.variant} (+${item.stat} ${bonus}).`;
}

export interface UnequipResult {
  message: string;
  took: boolean;
}

export function unequipSlot(player: Entity, inv: Inventory, slot: EquipSlot): UnequipResult {
  const item = inv.equipment[slot];
  if (!item) return { message: "Nothing equipped.", took: false };
  if (inv.carried.length >= CARRIED_CAP) return { message: "Your pack is full.", took: false };
  inv.equipment[slot] = null;
  inv.carried.push(item);
  recalcStats(player, inv);
  return { message: `You stow the ${item.variant}.`, took: true };
}

export function dropCarried(inv: Inventory, index: number): ItemInstance | null {
  const item = inv.carried[index];
  if (!item || (item.kind !== "weapon" && item.kind !== "armor")) return null;
  inv.carried.splice(index, 1);
  delete item.uid;
  return item;
}

export function dropConsumable(inv: Inventory, kind: ConsumableKind): ConsumableStack | null {
  return takeStack(inv, kind);
}

export interface TorchResult {
  message: string;
  turns: number;
}

function takeStack(inv: Inventory, kind: ConsumableKind): ConsumableStack | null {
  const idx = inv.consumables.findIndex((s) => s.kind === kind);
  if (idx === -1) return null;
  const stack = inv.consumables[idx]!;
  stack.count -= 1;
  if (stack.count <= 0) inv.consumables.splice(idx, 1);
  return stack;
}

export function usePotion(player: Entity, inv: Inventory): string | null {
  const stack = inv.consumables.find((s) => s.kind === "potion");
  if (!stack) return null;
  if (player.hp >= player.maxHp) return "You are already at full health.";
  takeStack(inv, "potion");
  player.hp = Math.min(player.maxHp, player.hp + stack.stat);
  return `You drink a ${stack.variant} (+${stack.stat} HP).`;
}

export function useTorch(inv: Inventory): TorchResult | null {
  const stack = inv.consumables.find((s) => s.kind === "torch");
  if (!stack) return null;
  takeStack(inv, "torch");
  return { message: `You light a ${stack.variant}.`, turns: stack.stat };
}
