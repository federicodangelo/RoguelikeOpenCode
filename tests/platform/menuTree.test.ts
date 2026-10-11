import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { TORCH_TURNS } from "../../src/core/constants.ts";
import { buildMenuTree } from "../../src/platform/menuTree.ts";
import { defaultSettings } from "../../src/platform/settings.ts";
import { MenuNav } from "../../src/ui/menu.ts";

function makeMenu(game: Game): MenuNav {
  const actions = {
    cycleScaling: () => {},
    toggleSound: () => {},
    cycleVolume: () => {},
    setVolume: () => {},
    save: () => {},
    load: () => {},
    reset: () => {},
    back: () => {},
  };
  return new MenuNav(() => buildMenuTree(game, defaultSettings(), actions));
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

  it("drinks potions with enter", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.inventory.potions = 1;
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

    expect(game.inventory.potions).toBe(0);
    expect(game.player.hp).toBe(6);
  });

  it("lights torches with enter", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.inventory.torches = 1;
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

    expect(game.inventory.torches).toBe(0);
    expect(game.lightTurns).toBe(TORCH_TURNS - 1);
  });
});
