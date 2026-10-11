import { describe, expect, it } from "bun:test";
import { makePlayer } from "../src/entities.ts";
import { makeInventory, kindOfTile, pickUp, usePotion } from "../src/items.ts";
import { T } from "../src/tiles.ts";

describe("kindOfTile", () => {
  it("maps item tiles to kinds", () => {
    expect(kindOfTile(T.Potion)).toBe("potion");
    expect(kindOfTile(T.Gold)).toBe("gold");
    expect(kindOfTile(T.Sword)).toBe("sword");
    expect(kindOfTile(T.Shield)).toBe("shield");
    expect(kindOfTile(T.Corpse)).toBe("corpse");
    expect(kindOfTile(T.Floor)).toBeNull();
  });
});

describe("pickUp", () => {
  it("gold and potions go to inventory", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(pickUp(p, inv, T.Gold)).toContain("gold");
    expect(pickUp(p, inv, T.Potion)).toContain("potion");
    expect(inv.gold).toBe(1);
    expect(inv.potions).toBe(1);
  });

  it("sword gives +1 ATK once, shield gives +1 DEF once", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    pickUp(p, inv, T.Sword);
    expect(p.atk).toBe(4);
    expect(inv.sword).toBe(true);
    expect(pickUp(p, inv, T.Sword)).toContain("already");
    expect(p.atk).toBe(4);

    pickUp(p, inv, T.Shield);
    expect(p.def).toBe(2);
    expect(inv.shield).toBe(true);
    expect(pickUp(p, inv, T.Shield)).toContain("already");
    expect(p.def).toBe(2);
  });

  it("corpses and non-items are not pickable", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(pickUp(p, inv, T.Corpse)).toBeNull();
    expect(pickUp(p, inv, T.Floor)).toBeNull();
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

  it("does nothing without potions or at full HP", () => {
    const p = makePlayer(0, 0);
    const inv = makeInventory();
    expect(usePotion(p, inv)).toBeNull();
    inv.potions = 1;
    expect(usePotion(p, inv)).toContain("full health");
    expect(inv.potions).toBe(1);
  });
});
