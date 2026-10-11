import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { buildMenuTree } from "../../src/platform/menuTree.ts";
import { defaultSettings } from "../../src/platform/settings.ts";
import { handleKeydown, MOVE_KEYS, type InputContext } from "../../src/platform/input.ts";
import type { GameAudio } from "../../src/platform/audio.ts";
import { MenuNav } from "../../src/ui/menu.ts";

const audio = {
  unlock: () => {},
  sfx: () => {},
  stopMusic: () => {},
} as unknown as GameAudio;

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

function key(keyName: string): KeyboardEvent {
  return { key: keyName, preventDefault: () => {} } as unknown as KeyboardEvent;
}

function makeContext(game: Game, menu: MenuNav): InputContext {
  return {
    game,
    menu,
    audio,
    startGame: () => {},
    toggleSound: () => {},
    openInventory: () => {},
  };
}

describe("input", () => {
  it("only exposes orthogonal movement keys", () => {
    expect(Object.keys(MOVE_KEYS).sort()).toEqual([
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
    ]);
  });

  it("does not move diagonally", () => {
    const game = new Game();
    game.screen = "game";
    game.dirty = false;
    const menu = makeMenu(game);
    const before = { x: game.player.x, y: game.player.y };

    handleKeydown(key("Home"), makeContext(game, menu));

    expect(game.player.x).toBe(before.x);
    expect(game.player.y).toBe(before.y);
    expect(game.dirty).toBe(false);
  });

  it("closes the inventory menu with escape", () => {
    const game = new Game();
    game.screen = "game";
    game.menuOpen = true;
    const menu = makeMenu(game);
    menu.open();

    const inventoryIdx = menu.entries().findIndex((entry) => entry.label === "Inventory");
    menu.index = inventoryIdx;
    menu.enter();

    handleKeydown(key("Escape"), makeContext(game, menu));

    expect(game.menuOpen).toBe(false);
  });
});
