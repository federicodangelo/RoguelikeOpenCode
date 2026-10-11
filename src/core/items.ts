import { T } from "./tiles.ts";
import type { Entity } from "./entities.ts";

export type ItemKind = "potion" | "gold" | "sword" | "shield" | "torch" | "corpse";

export interface Inventory {
  gold: number;
  potions: number;
  torches: number;
  sword: boolean;
  shield: boolean;
}

export function makeInventory(): Inventory {
  return { gold: 0, potions: 0, torches: 0, sword: false, shield: false };
}

export function kindOfTile(tile: number): ItemKind | null {
  switch (tile) {
    case T.Potion:
      return "potion";
    case T.Gold:
      return "gold";
    case T.Sword:
      return "sword";
    case T.Shield:
      return "shield";
    case T.Torch:
      return "torch";
    case T.Corpse:
      return "corpse";
    default:
      return null;
  }
}

export function pickUp(player: Entity, inv: Inventory, tile: number): string | null {
  const kind = kindOfTile(tile);
  if (kind === null || kind === "corpse") return null;
  switch (kind) {
    case "gold":
      inv.gold += 1;
      return "You pick up some gold.";
    case "potion":
      inv.potions += 1;
      return "You pick up a potion.";
    case "sword":
      if (inv.sword) return "You already have a sword.";
      inv.sword = true;
      player.atk += 1;
      return "You equip the sword (+1 ATK).";
    case "shield":
      if (inv.shield) return "You already have a shield.";
      inv.shield = true;
      player.def += 1;
      return "You equip the shield (+1 DEF).";
    case "torch":
      inv.torches += 1;
      return "You pick up a torch.";
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
