import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { addStatus } from "../../src/core/status.ts";
import { openInterior } from "../core/helpers.ts";
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
    toggleAutosave: () => {},
    save: () => {},
    load: () => {},
    reset: () => {},
    back: () => {},
  };
  return new MenuNav(() => buildMenuTree(game, defaultSettings(), actions));
}

function key(keyName: string, repeat = false): KeyboardEvent {
  return { key: keyName, repeat, preventDefault: () => {} } as unknown as KeyboardEvent;
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
    expect(Object.keys(MOVE_KEYS).sort()).toEqual(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"]);
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

  for (const keyName of ["Enter", "."]) {
    it(`pressing ${keyName} off the stairs does not consume a turn`, () => {
      const game = new Game();
      game.screen = "game";
      game.dirty = false;
      game.lightTurns = 5;
      const menu = makeMenu(game);

      handleKeydown(key(keyName), makeContext(game, menu));

      expect(game.lightTurns).toBe(5);
      expect(game.dirty).toBe(false);
    });
  }

  it("closes the inventory menu with escape", () => {
    const game = new Game();
    game.screen = "game";
    game.menuOpen = true;
    const menu = makeMenu(game);
    menu.open();

    const inventoryIdx = menu.indexOfId("inventory");
    menu.index = inventoryIdx;
    menu.enter();

    handleKeydown(key("Escape"), makeContext(game, menu));

    expect(game.menuOpen).toBe(false);
  });

  it("non-action keys do not consume a turn while stunned", () => {
    const game = new Game();
    game.screen = "game";
    game.dirty = false;
    game.lightTurns = 5;
    addStatus(game.player, "stun", 2, 1);
    const messages = game.messages.length;
    const menu = makeMenu(game);

    handleKeydown(key("Home"), makeContext(game, menu));

    expect(game.lightTurns).toBe(5);
    expect(game.dirty).toBe(false);
    expect(game.messages.length).toBe(messages);
  });

  it("action keys consume a turn while stunned", () => {
    const game = new Game();
    game.screen = "game";
    game.dirty = false;
    game.lightTurns = 5;
    addStatus(game.player, "stun", 2, 1);
    const before = { x: game.player.x, y: game.player.y };
    const menu = makeMenu(game);

    expect(handleKeydown(key("ArrowUp"), makeContext(game, menu))).toBe(true);

    expect(game.lightTurns).toBe(4);
    expect(game.player.x).toBe(before.x);
    expect(game.player.y).toBe(before.y);
    expect(game.dirty).toBe(true);
  });

  it("returns true when title Enter starts a run", () => {
    const game = new Game();
    game.screen = "title";
    const menu = makeMenu(game);

    expect(handleKeydown(key("Enter"), makeContext(game, menu))).toBe(true);
  });

  it("returns true when game-over Enter returns to the title", () => {
    const game = new Game();
    game.screen = "game";
    game.gameOver = true;
    const menu = makeMenu(game);

    expect(handleKeydown(key("Enter"), makeContext(game, menu))).toBe(true);
    expect(game.screen as string).toBe("title");
  });

  it("returns false for settings and menu navigation", () => {
    const game = new Game();
    game.screen = "game";
    const menu = makeMenu(game);

    expect(handleKeydown(key("m"), makeContext(game, menu))).toBe(false);

    game.menuOpen = true;
    menu.open();
    expect(handleKeydown(key("ArrowDown"), makeContext(game, menu))).toBe(false);
    expect(handleKeydown(key("Enter"), makeContext(game, menu))).toBe(true);
  });

  it("returns false for blocked movement and true for successful movement", () => {
    const game = new Game();
    game.screen = "game";
    game.dirty = false;
    game.map.cells = openInterior();
    game.monstersByFloor.set(game.depth, []);
    game.player.x = 25;
    game.player.y = 1;
    const menu = makeMenu(game);

    expect(handleKeydown(key("ArrowUp"), makeContext(game, menu))).toBe(false);
    expect(game.dirty).toBe(false);

    game.player.y = 20;
    expect(handleKeydown(key("ArrowUp"), makeContext(game, menu))).toBe(true);
    expect(game.dirty).toBe(true);
  });

  it("ignores repeated turn-based keys while playing", () => {
    const game = new Game();
    game.screen = "game";
    game.dirty = false;
    game.lightTurns = 5;
    game.map.cells = openInterior();
    game.monstersByFloor.set(game.depth, []);
    game.player.x = 25;
    game.player.y = 20;
    const menu = makeMenu(game);

    expect(handleKeydown(key("ArrowUp", true), makeContext(game, menu))).toBe(false);
    expect(game.player.y).toBe(20);
    expect(game.lightTurns).toBe(5);
    expect(game.dirty).toBe(false);
  });
});
