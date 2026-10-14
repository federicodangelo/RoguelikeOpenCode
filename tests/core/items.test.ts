import { describe, expect, it } from "bun:test";
import { makePlayer } from "../../src/core/entities.ts";
import {
  ITEM_DEFS,
  makeCorpse,
  makeGold,
  makeInstance,
  makeInventory,
  pickDef,
  pickUp,
  rollQuality,
  usePotion,
  useTorch,
  type ItemInstance,
} from "../../src/core/items.ts";
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
});

describe("pickUp", () => {
  it("gold adds the pile amount to inventory", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(pickUp(p, inv, makeGold(7))).toContain("gold");
    expect(inv.gold).toBe(7);
  });

  it("potions accumulate across multiple pickups", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("potion", "minor potion", 5, T.Potion));
    pickUp(p, inv, inst("potion", "major potion", 9, T.Potion));
    expect(inv.potions).toBe(2);
  });

  it("weapons equip once and grant their stat as ATK", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("weapon", "short sword", 2, T.Sword));
    expect(p.atk).toBe(p.baseAtk + 2);
    expect(inv.sword).toBe(2);
    expect(pickUp(p, inv, inst("weapon", "dagger", 1, T.Sword))).toContain("already");
    expect(p.atk).toBe(p.baseAtk + 2);
    expect(inv.sword).toBe(2);
  });

  it("armor equips once and grants its stat as DEF", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, inst("armor", "iron shield", 2, T.Shield));
    expect(p.def).toBe(p.baseDef + 2);
    expect(inv.shield).toBe(2);
    expect(pickUp(p, inv, inst("armor", "buckler", 1, T.Shield))).toContain("already");
    expect(p.def).toBe(p.baseDef + 2);
  });

  it("torches accumulate in inventory", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(pickUp(p, inv, inst("torch", "bullseye lantern", 0, T.Torch))).toContain("lantern");
    expect(inv.torches).toBe(1);
  });

  it("corpses are not pickable", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(pickUp(p, inv, makeCorpse())).toBeNull();
  });
});

describe("usePotion", () => {
  it("heals 5 HP up to max and consumes the potion", () => {
    const p = makePlayer(0, 0);
    p.hp = 3;
    const inv = makeInventory();
    inv.potions = 2;
    expect(usePotion(p, inv)).toContain("potion");
    expect(p.hp).toBe(8);
    expect(inv.potions).toBe(1);
    expect(usePotion(p, inv)).toContain("potion");
    expect(p.hp).toBe(12);
    expect(inv.potions).toBe(0);
  });

  it("consumes torches", () => {
    const inv = makeInventory();
    inv.torches = 2;
    expect(useTorch(inv)).toContain("torch");
    expect(inv.torches).toBe(1);
    expect(useTorch(inv)).toContain("torch");
    expect(inv.torches).toBe(0);
    expect(useTorch(inv)).toBeNull();
  });

  it("does nothing without potions or at full HP", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(usePotion(p, inv)).toBeNull();
    inv.potions = 1;
    expect(usePotion(p, inv)).toContain("full health");
    expect(inv.potions).toBe(1);
  });
});
