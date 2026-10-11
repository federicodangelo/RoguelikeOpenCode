import { describe, expect, it } from "bun:test";
import { contextualHints } from "../../src/ui/hud.ts";

describe("contextual hints", () => {
  it("shows pickup only for pickable items", () => {
    expect(
      contextualHints({
        hasPickableItem: true,
        cell: "floor",
        depth: 1,
        potions: 0,
        torches: 0,
        hp: 10,
        maxHp: 10,
        skillPoints: 0,
      }),
    ).toEqual([{ text: "g: pick up", icon: "item" }]);
  });

  it("names the item kind when known", () => {
    expect(
      contextualHints({
        hasPickableItem: true,
        itemKind: "potion",
        cell: "floor",
        depth: 1,
        potions: 0,
        torches: 0,
        hp: 10,
        maxHp: 10,
        skillPoints: 0,
      }),
    ).toEqual([{ text: "g: pick up potion", icon: "item" }]);
  });

  it("shows stairs hints", () => {
    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "stairs",
        depth: 1,
        potions: 0,
        torches: 0,
        hp: 10,
        maxHp: 10,
        skillPoints: 0,
      }),
    ).toEqual([{ text: ".: descend stairs", icon: "stairs" }]);

    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "stairsUp",
        depth: 2,
        potions: 0,
        torches: 0,
        hp: 10,
        maxHp: 10,
        skillPoints: 0,
      }),
    ).toEqual([{ text: ",: ascend stairs", icon: "stairsUp" }]);
  });

  it("shows adjacent interactable tooltips", () => {
    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "floor",
        depth: 1,
        potions: 0,
        torches: 0,
        hp: 10,
        maxHp: 10,
        skillPoints: 0,
        adjacentDoorClosed: true,
        adjacentTrap: true,
        adjacentMonster: { name: "rat", archetype: "normal", range: 0 },
      }),
    ).toEqual([
      { text: "bump: attack rat", icon: "monster" },
      { text: "bump: open door", icon: "door" },
      { text: "trap: danger", icon: "trap" },
    ]);
  });

  it("shows drink hint only below 50 percent HP", () => {
    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "floor",
        depth: 1,
        potions: 1,
        torches: 0,
        hp: 7,
        maxHp: 14,
        skillPoints: 0,
      }),
    ).toEqual([]);

    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "floor",
        depth: 1,
        potions: 1,
        torches: 0,
        hp: 6,
        maxHp: 14,
        skillPoints: 0,
      }),
    ).toEqual([{ text: "u: drink potion", icon: "potion" }]);
  });

  it("shows torch hint when carrying torches", () => {
    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "floor",
        depth: 1,
        potions: 0,
        torches: 1,
        hp: 10,
        maxHp: 10,
        skillPoints: 0,
      }),
    ).toEqual([{ text: "t: light torch", icon: "torch" }]);
  });

  it("shows skills hint when skill points are available", () => {
    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "floor",
        depth: 1,
        potions: 0,
        torches: 0,
        hp: 10,
        maxHp: 10,
        skillPoints: 2,
      }),
    ).toEqual([{ text: "esc: skills (2)", icon: "skill" }]);
  });

  it("caps contextual hints to avoid clutter", () => {
    const hints = contextualHints({
      hasPickableItem: true,
      itemKind: "gold",
      cell: "stairs",
      depth: 2,
      potions: 1,
      torches: 1,
      hp: 1,
      maxHp: 10,
      skillPoints: 1,
      adjacentDoorClosed: true,
      adjacentTrap: true,
      adjacentMonster: { name: "rat", archetype: "normal", range: 0 },
    });
    expect(hints.length).toBe(4);
    expect(hints[0]).toEqual({ text: "g: pick up gold", icon: "item" });
    expect(hints[2]).toEqual({ text: "bump: attack rat", icon: "monster" });
    expect(hints[3]).toEqual({ text: "bump: open door", icon: "door" });
  });
});
