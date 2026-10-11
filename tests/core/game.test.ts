import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { TORCH_TURNS } from "../../src/core/constants.ts";
import { addStatus, hasStatus } from "../../src/core/status.ts";

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

describe("Game status effects", () => {
  it("ticks player poison after monsters act", () => {
    const game = new Game();
    addStatus(game.player, "poison", 2, 1);
    const hp = game.player.hp;
    game.monstersAct();
    expect(game.player.hp).toBeLessThan(hp);
    expect(hasStatus(game.player, "poison")).toBe(true);
  });

  it("reports stunned players", () => {
    const game = new Game();
    addStatus(game.player, "stun", 1, 1);
    expect(game.playerStunned()).toBe(true);
  });
});

describe("Game skills", () => {
  it("spends skill points on stats", () => {
    const game = new Game();
    game.player.skillPoints = 2;
    const atk = game.player.atk;
    const def = game.player.def;
    const maxHp = game.player.maxHp;

    expect(game.spendSkill("atk")).toBe(true);
    expect(game.player.atk).toBe(atk + 1);
    expect(game.spendSkill("def")).toBe(true);
    expect(game.player.def).toBe(def + 1);
    expect(game.spendSkill("hp")).toBe(false);
    expect(game.player.maxHp).toBe(maxHp);
  });
});
