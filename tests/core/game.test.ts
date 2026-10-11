import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { TORCH_TURNS } from "../../src/core/constants.ts";

describe("Game torches", () => {
  it("lighting a torch consumes it and sets temporary light turns", () => {
    const game = new Game();
    game.inventory.torches = 1;
    expect(game.useTorch()).toBe(true);
    expect(game.inventory.torches).toBe(0);
    expect(game.lightTurns).toBe(TORCH_TURNS);
    game.monstersAct();
    expect(game.lightTurns).toBe(TORCH_TURNS - 1);
  });
});
