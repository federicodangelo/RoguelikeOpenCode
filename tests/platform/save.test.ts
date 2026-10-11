import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { clearRun, loadRun, saveRun, SAVE_KEY, type SaveStorage } from "../../src/platform/save.ts";

class MemoryStorage implements SaveStorage {
  private items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

describe("save/load", () => {
  it("round-trips run state through storage", () => {
    const storage = new MemoryStorage();
    const game = new Game();
    game.getFloor(2);
    game.depth = 2;
    game.map = game.getFloor(2);
    game.refreshFOV();
    game.kills = 4;
    game.inventory.gold = 7;
    game.player.hp = 5;
    game.godMode = true;
    game.logMessage("saved message");

    saveRun(storage, game);

    const loaded = new Game();
    expect(loadRun(storage, loaded)).toBe(true);
    expect(loaded.depth).toBe(2);
    expect(loaded.kills).toBe(4);
    expect(loaded.inventory.gold).toBe(7);
    expect(loaded.player.hp).toBe(5);
    expect(loaded.godMode).toBe(true);
    expect(loaded.messages.at(loaded.messages.length - 1)).toBe("saved message");
    expect(loaded.map).toBe(loaded.floors.get(2)!);
  });

  it("clears invalid saves", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "not json");
    const game = new Game();
    expect(loadRun(storage, game)).toBe(false);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it("clearRun removes the saved run", () => {
    const storage = new MemoryStorage();
    const game = new Game();
    saveRun(storage, game);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    clearRun(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});
