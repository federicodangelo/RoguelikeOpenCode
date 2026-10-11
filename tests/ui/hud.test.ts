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
        hp: 10,
        maxHp: 10,
      }),
    ).toEqual(["g: pick up"]);
  });

  it("shows stairs hints", () => {
    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "stairs",
        depth: 1,
        potions: 0,
        hp: 10,
        maxHp: 10,
      }),
    ).toEqual([".: descend"]);

    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "stairsUp",
        depth: 2,
        potions: 0,
        hp: 10,
        maxHp: 10,
      }),
    ).toEqual([",: ascend"]);
  });

  it("shows drink hint only below 50 percent HP", () => {
    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "floor",
        depth: 1,
        potions: 1,
        hp: 7,
        maxHp: 14,
      }),
    ).toEqual([]);

    expect(
      contextualHints({
        hasPickableItem: false,
        cell: "floor",
        depth: 1,
        potions: 1,
        hp: 6,
        maxHp: 14,
      }),
    ).toEqual(["u: drink"]);
  });
});
