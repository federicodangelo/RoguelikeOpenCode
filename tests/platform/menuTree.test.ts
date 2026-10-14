import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { TORCH_TURNS } from "../../src/core/constants.ts";
import { addStatus } from "../../src/core/status.ts";
import { T } from "../../src/core/tiles.ts";
import { buildMenuTree } from "../../src/platform/menuTree.ts";
import { defaultSettings } from "../../src/platform/settings.ts";
import { MenuNav } from "../../src/ui/menu.ts";

function makeMenu(game: Game, settings = defaultSettings()): MenuNav {
  const actions = {
    cycleScaling: () => {},
    toggleSound: () => {},
    cycleVolume: () => {},
    setVolume: () => {},
    toggleAutosave: () => {},
    save: () => {},
    load: () => {},
    reset: () => {},
    back: () => {},
  };
  return new MenuNav(() => buildMenuTree(game, settings, actions));
}

describe("inventory menu", () => {
  it("opens inventory from the root menu", () => {
    const game = new Game();
    const menu = makeMenu(game);
    menu.open();

    const idx = menu.entries().findIndex((entry) => entry.label === "Inventory");
    expect(idx).toBeGreaterThanOrEqual(0);

    menu.index = idx;
    expect(menu.enter()).toBe("submenu");
    expect(menu.labels()[0]).toBe("Inventory");
  });

  it("shows equipment slots and lets Enter unequip", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.map.items.push({
      x: game.player.x,
      y: game.player.y,
      kind: "weapon",
      variant: "short sword",
      quality: "common",
      tile: T.Sword,
      stat: 2,
    });
    game.pickup();
    const menu = makeMenu(game);
    menu.open();

    const inventoryIdx = menu.entries().findIndex((entry) => entry.label === "Inventory");
    menu.index = inventoryIdx;
    menu.enter();

    const weaponIdx = menu.indexOfId("slot-weapon");
    expect(menu.entries()[weaponIdx]!.label).toContain("short sword");
    menu.index = weaponIdx;
    menu.enter();
    expect(game.inventory.equipment.weapon).toBeNull();
    expect(game.inventory.carried.length).toBe(1);
  });

  it("equips a carried item with Enter", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.map.items.push({
      x: game.player.x,
      y: game.player.y,
      kind: "weapon",
      variant: "short sword",
      quality: "common",
      tile: T.Sword,
      stat: 2,
    });
    game.pickup();
    game.map.items.push({
      x: game.player.x,
      y: game.player.y,
      kind: "weapon",
      variant: "long sword",
      quality: "common",
      tile: T.Sword,
      stat: 3,
    });
    game.pickup();
    const menu = makeMenu(game);
    menu.open();

    const inventoryIdx = menu.entries().findIndex((entry) => entry.label === "Inventory");
    menu.index = inventoryIdx;
    menu.enter();

    const carriedIdx = menu.entries().findIndex((entry) => entry.id?.startsWith("carried-"));
    expect(carriedIdx).toBeGreaterThanOrEqual(0);
    menu.index = carriedIdx;
    menu.enter();

    expect(game.inventory.equipment.weapon?.variant).toBe("long sword");
    expect(game.inventory.carried[0]!.variant).toBe("short sword");
    expect(game.player.atk).toBe(game.player.baseAtk + 3);
  });

  it("drinks potions with enter", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.inventory.consumables.push({
      kind: "potion",
      variant: "minor potion",
      quality: "common",
      tile: T.Potion,
      stat: 5,
      count: 1,
    });
    game.player.hp = 1;
    const menu = makeMenu(game);
    menu.open();

    const inventoryIdx = menu.entries().findIndex((entry) => entry.label === "Inventory");
    menu.index = inventoryIdx;
    menu.enter();

    const potionIdx = menu.entries().findIndex((entry) => entry.label.startsWith("Potions:"));
    expect(potionIdx).toBeGreaterThanOrEqual(0);

    menu.index = potionIdx;
    menu.enter();

    expect(game.inventory.consumables.length).toBe(0);
    expect(game.player.hp).toBe(6);
  });

  it("lights torches with enter", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.inventory.consumables.push({
      kind: "torch",
      variant: "torch",
      quality: "common",
      tile: T.Torch,
      stat: TORCH_TURNS,
      count: 1,
    });
    game.lightTurns = 0;
    const menu = makeMenu(game);
    menu.open();

    const inventoryIdx = menu.entries().findIndex((entry) => entry.label === "Inventory");
    menu.index = inventoryIdx;
    menu.enter();

    const torchIdx = menu.entries().findIndex((entry) => entry.label.startsWith("Torches:"));
    expect(torchIdx).toBeGreaterThanOrEqual(0);

    menu.index = torchIdx;
    menu.enter();

    expect(game.inventory.consumables.length).toBe(0);
    expect(game.lightTurns).toBe(TORCH_TURNS - 1);
  });

  it("a stunned player loses a turn attempting to drink but keeps the potion", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.inventory.consumables.push({
      kind: "potion",
      variant: "minor potion",
      quality: "common",
      tile: T.Potion,
      stat: 5,
      count: 1,
    });
    game.player.hp = 1;
    game.lightTurns = 5;
    addStatus(game.player, "stun", 2, 1);
    const menu = makeMenu(game);
    menu.open();

    const inventoryIdx = menu.entries().findIndex((entry) => entry.label === "Inventory");
    menu.index = inventoryIdx;
    menu.enter();

    const potionIdx = menu.entries().findIndex((entry) => entry.label.startsWith("Potions:"));
    expect(potionIdx).toBeGreaterThanOrEqual(0);
    menu.index = potionIdx;
    menu.enter();

    expect(game.inventory.consumables[0]!.count).toBe(1);
    expect(game.player.hp).toBe(1);
    expect(game.lightTurns).toBe(4);
  });
});

describe("settings menu", () => {
  it("hides save and load when autosave is on", () => {
    const game = new Game();
    const settings = defaultSettings();
    settings.autosave = true;
    const menu = makeMenu(game, settings);
    menu.open();

    expect(menu.entries().some((entry) => entry.label === "Save")).toBe(false);
    expect(menu.entries().some((entry) => entry.label === "Load")).toBe(false);
  });

  it("shows save and load when autosave is off", () => {
    const game = new Game();
    const settings = defaultSettings();
    settings.autosave = false;
    const menu = makeMenu(game, settings);
    menu.open();

    expect(menu.entries().some((entry) => entry.label === "Save")).toBe(true);
    expect(menu.entries().some((entry) => entry.label === "Load")).toBe(true);
  });
});
