import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { BASE_SEED } from "../../src/core/constants.ts";
import { isSavedRun, migrateSavedRun, type SavedRun } from "../../src/core/save.ts";
import { MAP_H, MAP_W } from "../../src/core/mapgen/common.ts";
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

describe("isSavedRun numeric bounds", () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>;
  }

  function mapOf(save: Record<string, unknown>): Record<string, unknown> {
    return floorsOf(save)[0]!.map as Record<string, unknown>;
  }

  function monsterOf(save: Record<string, unknown>): Record<string, unknown> {
    return (floorsOf(save)[0]!.monsters as Record<string, unknown>[])[0]!;
  }

  function rejects(label: string, patch: (save: Record<string, unknown>) => void): void {
    it(`rejects ${label}`, () => {
      const save = validSave();
      patch(save);
      expect(isSavedRun(save)).toBe(false);
    });
  }

  rejects("a depth below the first floor", (s) => {
    s.depth = 0;
  });
  rejects("a negative depth", (s) => {
    s.depth = -3;
  });
  rejects("a fractional depth", (s) => {
    s.depth = 2.5;
  });
  rejects("a NaN depth", (s) => {
    s.depth = Number.NaN;
  });
  rejects("a floor entry below the first floor", (s) => {
    floorsOf(s)[0]!.depth = 0;
  });
  rejects("negative light turns", (s) => {
    s.lightTurns = -1;
  });
  rejects("fractional light turns", (s) => {
    s.lightTurns = 1.5;
  });
  rejects("negative kills", (s) => {
    s.kills = -2;
  });
  rejects("a fractional run seed", (s) => {
    s.seed = 1.5;
  });
  rejects("a negative rng state", (s) => {
    s.aiRng = -1;
  });
  rejects("a fractional battle rng state", (s) => {
    s.battleRng = 2.5;
  });
  rejects("a player healed past their maximum", (s) => {
    playerOf(s).hp = (playerOf(s).maxHp as number) + 1;
  });
  rejects("a player with negative hp", (s) => {
    playerOf(s).hp = -5;
  });
  rejects("fractional hp", (s) => {
    playerOf(s).hp = 3.5;
  });
  rejects("a zero maximum hp", (s) => {
    playerOf(s).maxHp = 0;
  });
  rejects("a player level below the first level", (s) => {
    playerOf(s).level = 0;
  });
  rejects("negative skill points", (s) => {
    playerOf(s).skillPoints = -1;
  });
  rejects("negative attack", (s) => {
    playerOf(s).atk = -7;
  });
  rejects("a monster standing outside the map", (s) => {
    monsterOf(s).x = MAP_W + 5;
  });
  rejects("fractional monster coordinates", (s) => {
    monsterOf(s).y = 4.5;
  });
  rejects("a monster with hp past its maximum", (s) => {
    const m = monsterOf(s);
    m.hp = (m.maxHp as number) + 1;
  });
  rejects("a status with negative turns", (s) => {
    playerOf(s).statuses = [{ kind: "poison", turns: -1, power: 1 }];
  });
  rejects("a status with negative power", (s) => {
    playerOf(s).statuses = [{ kind: "poison", turns: 2, power: -3 }];
  });
  rejects("a spawn point outside the map", (s) => {
    mapOf(s).spawn = { x: -1, y: 5 };
  });
  rejects("map dimensions that are not the map size", (s) => {
    mapOf(s).width = 4;
  });
  rejects("map rows that are not the map width", (s) => {
    (mapOf(s).cells as unknown[][])[0] = [];
  });
  rejects("an explored index outside the grid", (s) => {
    floorsOf(s)[0]!.explored = [-1];
  });
  rejects("an explored index past the last cell", (s) => {
    floorsOf(s)[0]!.explored = [MAP_W * MAP_H];
  });
  rejects("fractional gold", (s) => {
    (s.inventory as Record<string, unknown>).gold = 1.5;
  });
  rejects("negative gold", (s) => {
    (s.inventory as Record<string, unknown>).gold = -10;
  });
  rejects("a consumable stack with no charges", (s) => {
    (s.inventory as Record<string, unknown>).consumables = [
      { kind: "potion", variant: "minor potion", quality: "common", tile: T.Potion, stat: 5, count: 0 },
    ];
  });
  rejects("a consumable stack with fractional charges", (s) => {
    (s.inventory as Record<string, unknown>).consumables = [
      { kind: "potion", variant: "minor potion", quality: "common", tile: T.Potion, stat: 5, count: 1.5 },
    ];
  });
  rejects("an equipped weapon with a fractional stat", (s) => {
    (s.inventory as { equipment: Record<string, unknown> }).equipment.weapon = {
      kind: "weapon",
      variant: "dagger",
      quality: "common",
      tile: T.Dagger,
      stat: 2.5,
    };
  });
});

describe("saved messages", () => {
  it("keeps the color of every message through a save", () => {
    const source = new Game();
    source.logMessage("The goblin hits you for 3.", "#ff6a6a");
    source.logMessage("You are poisoned.", "#9be56f");
    const saved = source.serialize();

    expect(saved.messages.at(-2)).toEqual({ text: "The goblin hits you for 3.", color: "#ff6a6a" });
    expect(isSavedRun(saved)).toBe(true);

    const loaded = new Game();
    loaded.loadRun(saved);
    const last = loaded.messages.length - 1;
    expect(loaded.messages.at(last)).toBe("You are poisoned.");
    expect(loaded.messages.colorAt(last)).toBe("#9be56f");
    expect(loaded.messages.colorAt(last - 1)).toBe("#ff6a6a");
  });

  it("stores an uncolored message without inventing a color for it", () => {
    const source = new Game();
    source.logMessage("You have nothing to drink.");
    expect(source.serialize().messages.at(-1)).toEqual({ text: "You have nothing to drink." });
  });

  it("still loads a save whose messages are stored as bare strings", () => {
    const save = validSave();
    save.messages = ["You are poisoned.", "The goblin hits you for 3."];
    expect(isSavedRun(save)).toBe(true);

    const loaded = new Game();
    loaded.loadRun(save as unknown as SavedRun);
    const last = loaded.messages.length - 1;
    expect(loaded.messages.at(last)).toBe("The goblin hits you for 3.");
    expect(loaded.messages.colorAt(last)).toBeUndefined();
  });

  it("rejects a message that is neither a string nor carries its text", () => {
    const save = validSave();
    save.messages = [{ color: "#ff6a6a" }];
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
    expect(migrated.version).toBe(5);
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
    expect(migrated.version).toBe(5);
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
    expect(migrated.version).toBe(5);
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

  it("migrates version 4 saves by removing traps and shifting tile indices", () => {
    const save = validSave();
    save.version = 4;
    const map = floorsOf(save)[0]!.map as Record<string, unknown>;
    // The toy grid has to agree with the map's own dimensions.
    map.width = 5;
    map.height = 4;
    map.cells = [
      ["wall", "wall", "wall", "wall", "wall"],
      ["wall", "trap", "floor", "trap", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "wall", "wall", "wall", "wall"],
    ];
    map.items = [
      { x: 1, y: 1, tile: 30, kind: "light", variant: "lantern", quality: "common", stat: 0, uid: 1 },
      { x: 3, y: 1, tile: 11, kind: "gold", variant: "gold", quality: "common", stat: 0, uid: 2 },
    ];
    save.inventory = {
      gold: 0,
      consumables: [{ kind: "potion", variant: "major", tile: 29, quality: "uncommon", stat: 0, count: 1 }],
      carried: [{ kind: "weapon", variant: "dagger", tile: 24, quality: "common", stat: 1, uid: 3 }],
      equipment: {
        weapon: { kind: "weapon", variant: "long sword", tile: 25, quality: "rare", stat: 3, uid: 4 },
        armor: null,
      },
    };

    const migrated = migrateSavedRun(save) as Record<string, unknown>;
    expect(migrated.version).toBe(5);
    expect(isSavedRun(migrated)).toBe(true);

    const cells = (floorsOf(migrated)[0]!.map as Record<string, unknown>).cells as string[][];
    expect(cells[1]).toEqual(["wall", "floor", "floor", "floor", "wall"]);

    const items = (floorsOf(migrated)[0]!.map as Record<string, unknown>).items as Record<string, unknown>[];
    expect(items[0]!.tile).toBe(29);
    expect(items[1]!.tile).toBe(11);

    const inv = migrated.inventory as Record<string, unknown>;
    expect((inv.consumables as Record<string, unknown>[])[0]!.tile).toBe(28);
    expect((inv.carried as Record<string, unknown>[])[0]!.tile).toBe(23);
    expect(((inv.equipment as Record<string, unknown>).weapon as Record<string, unknown>).tile).toBe(24);
  });
});
