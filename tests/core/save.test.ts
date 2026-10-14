import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { BASE_SEED } from "../../src/core/constants.ts";
import { isSavedRun, migrateSavedRun } from "../../src/core/save.ts";
import { T } from "../../src/core/tiles.ts";

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

  it("rejects inventories in the legacy flat shape", () => {
    const save = validSave();
    save.inventory = { gold: 0, potions: 0, torches: 0, sword: 0, shield: 0 };
    expect(isSavedRun(save)).toBe(false);
  });

  it("rejects map items without instance fields", () => {
    const save = validSave();
    (floorsOf(save)[0]!.map as Record<string, unknown>).items = [{ x: 1, y: 2, tile: T.Gold }];
    expect(isSavedRun(save)).toBe(false);
  });
});

describe("save seed and migration", () => {
  it("serializes the run seed", () => {
    const game = new Game(() => 0, 4242);
    expect(game.serialize().seed).toBe(4242);
  });

  it("loadRun restores the run seed", () => {
    const source = new Game(() => 0, 4242);
    const loaded = new Game();
    loaded.loadRun(source.serialize());
    expect(loaded.runSeed).toBe(4242);
  });

  it("migrates version 1 saves by adding the default seed", () => {
    const save = validSave();
    save.version = 1;
    delete save.seed;
    const migrated = migrateSavedRun(save) as Record<string, unknown>;
    expect(migrated.version).toBe(4);
    expect(migrated.seed).toBe(BASE_SEED);
    expect(isSavedRun(migrated)).toBe(true);
  });

  it("migrates version 2 saves to the item instance model", () => {
    const save = validSave();
    save.version = 2;
    const inv = save.inventory as Record<string, unknown>;
    inv.sword = true;
    inv.shield = false;
    const player = save.player as Record<string, unknown>;
    delete player.baseAtk;
    delete player.baseDef;
    (floorsOf(save)[0]!.map as Record<string, unknown>).items = [{ x: 5, y: 6, tile: T.Sword }];
    for (const m of floorsOf(save)[0]!.monsters as Record<string, unknown>[]) {
      delete m.baseAtk;
      delete m.baseDef;
    }

    const migrated = migrateSavedRun(save) as Record<string, unknown>;
    expect(migrated.version).toBe(4);
    expect(isSavedRun(migrated)).toBe(true);

    const items = (floorsOf(migrated)[0]!.map as Record<string, unknown>).items as Record<string, unknown>[];
    expect(items[0]!.kind).toBe("weapon");
    expect(items[0]!.variant).toBe("short sword");
    expect(items[0]!.quality).toBe("common");

    const mp = migrated.player as Record<string, unknown>;
    expect(mp.baseAtk).toBe((mp.atk as number) - 1);
    expect(mp.baseDef).toBe((mp.def as number) - 0);

    const monster = (floorsOf(migrated)[0]!.monsters as Record<string, unknown>[])[0]!;
    expect(monster.baseAtk).toBe(monster.atk);
    expect(monster.baseDef).toBe(monster.def);
  });

  it("migrates version 3 saves to the equipment and stack model", () => {
    const save = validSave();
    save.version = 3;
    save.inventory = { gold: 3, potions: 2, torches: 1, sword: 2, shield: 0 };

    const migrated = migrateSavedRun(save) as Record<string, unknown>;
    expect(migrated.version).toBe(4);
    expect(isSavedRun(migrated)).toBe(true);

    const inv = migrated.inventory as Record<string, unknown>;
    const consumables = inv.consumables as Record<string, unknown>[];
    expect(consumables.length).toBe(2);
    expect(consumables[0]!.kind).toBe("potion");
    expect(consumables[0]!.count).toBe(2);
    expect(consumables[1]!.kind).toBe("torch");
    expect(consumables[1]!.count).toBe(1);

    const equipment = inv.equipment as Record<string, unknown>;
    const weapon = equipment.weapon as Record<string, unknown>;
    expect(weapon.variant).toBe("short sword");
    expect(weapon.stat).toBe(2);
    expect(equipment.armor).toBeNull();
    expect(inv.carried).toEqual([]);
  });
});
