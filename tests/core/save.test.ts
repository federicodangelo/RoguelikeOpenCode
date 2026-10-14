import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { isSavedRun } from "../../src/core/save.ts";

function validSave(): Record<string, unknown> {
  return new Game().serialize() as unknown as Record<string, unknown>;
}

function floorsOf(save: Record<string, unknown>): Record<string, unknown>[] {
  return save.floors as Record<string, unknown>[];
}

describe("isSavedRun validation", () => {
  it("accepts a serialized game", () => {
    expect(isSavedRun(validSave())).toBe(true);
  });

  it("rejects floors entries without a map", () => {
    const save = validSave();
    floorsOf(save)[0]!.map = null;
    expect(isSavedRun(save)).toBe(false);
  });

  it("rejects maps whose cells are not a grid of strings", () => {
    const save = validSave();
    (floorsOf(save)[0]!.map as Record<string, unknown>).cells = "nope";
    expect(isSavedRun(save)).toBe(false);
  });

  it("rejects floors entries without an explored list", () => {
    const save = validSave();
    delete floorsOf(save)[0]!.explored;
    expect(isSavedRun(save)).toBe(false);
  });

  it("rejects monster entries that are not entities", () => {
    const save = validSave();
    floorsOf(save)[0]!.monsters = [{ name: "ghost" }];
    expect(isSavedRun(save)).toBe(false);
  });

  it("rejects players without hp", () => {
    const save = validSave();
    delete (save.player as Record<string, unknown>).hp;
    expect(isSavedRun(save)).toBe(false);
  });

  it("rejects inventories with non-numeric gold", () => {
    const save = validSave();
    (save.inventory as Record<string, unknown>).gold = "7";
    expect(isSavedRun(save)).toBe(false);
  });
});
