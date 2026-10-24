import { describe, expect, it } from "bun:test";
import { makePlayer } from "../../src/core/entities.ts";
import {
  ITEM_DEFS,
  dropCarried,
  dropConsumable,
  equipCarried,
  makeCorpse,
  makeGold,
  makeInstance,
  makeInventory,
  pickDef,
  pickUp,
  qualityColor,
  recalcStats,
  rollQuality,
  unequipSlot,
  usePotion,
  useTorch,
  type ItemInstance,
  type Quality,
} from "../../src/core/items.ts";
import { CARRIED_CAP, TORCH_TURNS } from "../../src/core/constants.ts";
import { RNG } from "../../src/core/rng.ts";
import { T } from "../../src/core/tiles.ts";

function inst(kind: ItemInstance["kind"], variant: string, stat: number, tile: number): ItemInstance {
  return { kind, variant, quality: "common", tile, stat };
}

describe("ITEM_DEFS", () => {
  it("provides multiple variants per kind", () => {
    expect(ITEM_DEFS.filter((d) => d.kind === "weapon").length).toBeGreaterThanOrEqual(4);
    expect(ITEM_DEFS.filter((d) => d.kind === "armor").length).toBeGreaterThanOrEqual(3);
    expect(ITEM_DEFS.filter((d) => d.kind === "potion").length).toBeGreaterThanOrEqual(2);
    expect(ITEM_DEFS.filter((d) => d.kind === "torch").length).toBeGreaterThanOrEqual(2);
  });

  it("torch variants define their light duration as the stat", () => {
    const torch = ITEM_DEFS.find((d) => d.kind === "torch" && d.variant === "torch")!;
    const lantern = ITEM_DEFS.find((d) => d.kind === "torch" && d.variant === "bullseye lantern")!;
    expect(torch.baseStat).toBe(TORCH_TURNS);
    expect(lantern.baseStat).toBeGreaterThan(TORCH_TURNS);
  });

  it("pickDef only returns defs unlocked at the given depth", () => {
    const rng = new RNG(1);
    for (let i = 0; i < 60; i++) {
      expect(pickDef(rng, 1).minDepth).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < 200; i++) {
      expect(pickDef(rng, 5).minDepth).toBeLessThanOrEqual(5);
    }
  });

  it("rollQuality is deterministic per seed and improves with depth", () => {
    const a = new RNG(7);
    const b = new RNG(7);
    expect(rollQuality(a, 5)).toBe(rollQuality(b, 5));

    const shallow = new RNG(9);
    const deep = new RNG(9);
    let shallowBetter = 0;
    let deepBetter = 0;
    for (let i = 0; i < 300; i++) {
      if (rollQuality(shallow, 1) !== "common") shallowBetter++;
      if (rollQuality(deep, 8) !== "common") deepBetter++;
    }
    expect(deepBetter).toBeGreaterThan(shallowBetter);
  });

  it("makeInstance adds the quality bonus to the base stat", () => {
    const def = ITEM_DEFS.find((d) => d.kind === "weapon" && d.variant === "short sword")!;
    expect(makeInstance(def, "common").stat).toBe(def.baseStat);
    expect(makeInstance(def, "uncommon").stat).toBe(def.baseStat + 1);
    expect(makeInstance(def, "rare").stat).toBe(def.baseStat + 2);
    expect(makeInstance(def, "rare").quality).toBe("rare");
  });

  it("every variant has its own tile art", () => {
    const tiles = ITEM_DEFS.map((d) => d.tile);
    expect(new Set(tiles).size).toBe(tiles.length);
  });
});

describe("qualityColor", () => {
  it("maps each quality to a distinct readable color", () => {
    expect(qualityColor("common")).toBe("#e8e4da");
    expect(qualityColor("uncommon")).toBe("#9be56f");
    expect(qualityColor("rare")).toBe("#7ab8ff");
    expect(new Set((["common", "uncommon", "rare"] as Quality[]).map(qualityColor)).size).toBe(3);
  });
});

describe("pickUp", () => {
  it("gold adds the pile amount to inventory", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    const result = pickUp(p, inv, makeGold(7));
    expect(result?.message).toContain("gold");
    expect(result?.took).toBe(true);
    expect(inv.gold).toBe(7);
  });

  it("consumables merge into stacks keyed by variant and quality", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("potion", "minor potion", 5, T.Potion));
    pickUp(p, inv, inst("potion", "minor potion", 5, T.Potion));
    pickUp(p, inv, inst("potion", "major potion", 9, T.Potion));
    expect(inv.consumables.length).toBe(2);
    expect(inv.consumables[0]!.count).toBe(2);
    expect(inv.consumables[1]!.variant).toBe("major potion");
  });

  it("weapons auto-equip when the slot is empty", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    const result = pickUp(p, inv, inst("weapon", "short sword", 2, T.Sword));
    expect(result?.took).toBe(true);
    expect(p.atk).toBe(p.baseAtk + 2);
    expect(inv.equipment.weapon?.stat).toBe(2);
    expect(inv.carried.length).toBe(0);
  });

  it("a second weapon goes to the carried list", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("weapon", "short sword", 2, T.Sword));
    const result = pickUp(p, inv, inst("weapon", "dagger", 1, T.Sword));
    expect(result?.took).toBe(true);
    expect(result?.message).toContain("stow");
    expect(p.atk).toBe(p.baseAtk + 2);
    expect(inv.carried.length).toBe(1);
    expect(inv.carried[0]!.variant).toBe("dagger");
  });

  it("refuses equipment when the carried list is full", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("weapon", "short sword", 2, T.Sword));
    for (let i = 0; i < CARRIED_CAP; i++) {
      pickUp(p, inv, inst("weapon", "dagger", 1, T.Sword));
    }
    expect(inv.carried.length).toBe(CARRIED_CAP);
    const result = pickUp(p, inv, inst("weapon", "long sword", 3, T.Sword));
    expect(result?.took).toBe(false);
    expect(result?.message).toContain("full");
    expect(inv.carried.length).toBe(CARRIED_CAP);
  });

  it("armor equips once and extra armor is carried", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("armor", "iron shield", 2, T.Shield));
    expect(p.def).toBe(p.baseDef + 2);
    expect(inv.equipment.armor?.stat).toBe(2);
    const result = pickUp(p, inv, inst("armor", "buckler", 1, T.Shield));
    expect(result?.took).toBe(true);
    expect(p.def).toBe(p.baseDef + 2);
    expect(inv.carried.length).toBe(1);
  });

  it("torches accumulate in inventory", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    const result = pickUp(p, inv, inst("torch", "bullseye lantern", 30, T.Torch));
    expect(result?.message).toContain("lantern");
    expect(inv.consumables[0]!.count).toBe(1);
  });

  it("corpses are not pickable", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(pickUp(p, inv, makeCorpse())).toBeNull();
  });
});

describe("equip and unequip", () => {
  it("equipping a carried item swaps the old piece back into carried", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("weapon", "short sword", 2, T.Sword));
    pickUp(p, inv, inst("weapon", "dagger", 1, T.Sword));
    const msg = equipCarried(p, inv, 0);
    expect(msg).toContain("dagger");
    expect(inv.equipment.weapon?.variant).toBe("dagger");
    expect(inv.carried.length).toBe(1);
    expect(inv.carried[0]!.variant).toBe("short sword");
    expect(p.atk).toBe(p.baseAtk + 1);
  });

  it("equipping armor swaps and recalculates DEF", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("armor", "iron shield", 2, T.Shield));
    pickUp(p, inv, inst("armor", "kite shield", 3, T.Shield));
    equipCarried(p, inv, 0);
    expect(inv.equipment.armor?.variant).toBe("kite shield");
    expect(p.def).toBe(p.baseDef + 3);
    expect(inv.carried[0]!.variant).toBe("iron shield");
  });

  it("unequipping stows the piece and drops the bonus", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("weapon", "short sword", 2, T.Sword));
    const result = unequipSlot(p, inv, "weapon");
    expect(result.message).toContain("stow");
    expect(result.took).toBe(true);
    expect(inv.equipment.weapon).toBeNull();
    expect(inv.carried.length).toBe(1);
    expect(p.atk).toBe(p.baseAtk);
  });

  it("unequipping an empty slot or a full pack is refused", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(unequipSlot(p, inv, "weapon").took).toBe(false);
    pickUp(p, inv, inst("weapon", "short sword", 2, T.Sword));
    for (let i = 0; i < CARRIED_CAP; i++) {
      inv.carried.push(inst("weapon", "dagger", 1, T.Sword));
    }
    expect(unequipSlot(p, inv, "weapon").took).toBe(false);
    expect(inv.equipment.weapon?.variant).toBe("short sword");
  });

  it("recalcStats keeps atk/def aligned with base plus equipment", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    inv.equipment.weapon = inst("weapon", "battle axe", 4, T.Sword);
    inv.equipment.armor = inst("armor", "kite shield", 3, T.Shield);
    recalcStats(p, inv);
    expect(p.atk).toBe(p.baseAtk + 4);
    expect(p.def).toBe(p.baseDef + 3);
    inv.equipment.weapon = null;
    recalcStats(p, inv);
    expect(p.atk).toBe(p.baseAtk);
  });
});

describe("drop", () => {
  it("dropCarried removes the item and clears its uid", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("weapon", "short sword", 2, T.Sword));
    pickUp(p, inv, inst("weapon", "dagger", 1, T.Sword));
    const dropped = dropCarried(inv, 0);
    expect(dropped?.variant).toBe("dagger");
    expect(dropped!.uid).toBeUndefined();
    expect(inv.carried.length).toBe(0);
    expect(inv.equipment.weapon?.variant).toBe("short sword");
    expect(p.atk).toBe(p.baseAtk + 2);
  });

  it("dropCarried refuses bad indexes and equipped items", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("weapon", "short sword", 2, T.Sword));
    expect(dropCarried(inv, 0)).toBeNull();
    expect(dropCarried(inv, -1)).toBeNull();
    expect(inv.equipment.weapon?.variant).toBe("short sword");
  });

  it("dropConsumable decrements the stack and returns the stack info", () => {
    const inv = makeInventory();
    pickUp(makePlayer(0, 0), inv, inst("potion", "minor potion", 5, T.Potion));
    pickUp(makePlayer(0, 0), inv, inst("potion", "minor potion", 5, T.Potion));
    const stack = dropConsumable(inv, "potion");
    expect(stack?.variant).toBe("minor potion");
    expect(stack?.stat).toBe(5);
    expect(inv.consumables[0]!.count).toBe(1);
    expect(dropConsumable(inv, "torch")).toBeNull();
  });
});

describe("usePotion", () => {
  it("heals by the stack stat and consumes one charge", () => {
    const p = makePlayer(0, 0);
    p.hp = 3;
    const inv = makeInventory();
    pickUp(p, inv, inst("potion", "minor potion", 5, T.Potion));
    pickUp(p, inv, inst("potion", "minor potion", 5, T.Potion));
    const first = usePotion(p, inv);
    expect(first?.message).toContain("minor potion");
    expect(first?.took).toBe(true);
    expect(p.hp).toBe(8);
    expect(inv.consumables[0]!.count).toBe(1);
    const second = usePotion(p, inv);
    expect(second?.message).toContain("potion");
    expect(second?.took).toBe(true);
    expect(p.hp).toBe(12);
    expect(inv.consumables.length).toBe(0);
  });

  it("major potions heal their own amount", () => {
    const p = makePlayer(0, 0);
    p.hp = 1;
    const inv = makeInventory();
    pickUp(p, inv, inst("potion", "major potion", 9, T.Potion));
    usePotion(p, inv);
    expect(p.hp).toBe(10);
  });

  it("reports full health as a no-op that spends no potion", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(usePotion(p, inv)).toBeNull();
    pickUp(p, inv, inst("potion", "minor potion", 5, T.Potion));
    const result = usePotion(p, inv);
    expect(result?.took).toBe(false);
    expect(result?.message).toContain("full health");
    expect(p.hp).toBe(12);
    expect(inv.consumables[0]!.count).toBe(1);
  });
});

describe("useTorch", () => {
  it("returns the stack stat as light turns and consumes a charge", () => {
    const inv = makeInventory();
    pickUp(makePlayer(0, 0), inv, inst("torch", "torch", TORCH_TURNS, T.Torch));
    pickUp(makePlayer(0, 0), inv, inst("torch", "torch", TORCH_TURNS, T.Torch));
    const first = useTorch(inv);
    expect(first?.message).toContain("torch");
    expect(first?.turns).toBe(TORCH_TURNS);
    expect(inv.consumables[0]!.count).toBe(1);
    expect(useTorch(inv)?.turns).toBe(TORCH_TURNS);
    expect(useTorch(inv)).toBeNull();
    expect(inv.consumables.length).toBe(0);
  });

  it("lanterns light for their longer duration", () => {
    const inv = makeInventory();
    pickUp(makePlayer(0, 0), inv, inst("torch", "bullseye lantern", 30, T.Torch));
    expect(useTorch(inv)?.turns).toBe(30);
  });
});
