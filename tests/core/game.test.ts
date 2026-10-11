import { describe, expect, it } from "bun:test";
import { Game } from "../../src/core/game.ts";
import { TORCH_TURNS } from "../../src/core/constants.ts";
import { MAP_W } from "../../src/core/map.ts";
import { T } from "../../src/core/tiles.ts";
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

describe("Game interactables", () => {
  it("reports the item kind at the player", () => {
    const game = new Game();
    game.map.items.push({ x: game.player.x, y: game.player.y, tile: T.Potion });
    expect(game.itemKindAtPlayer()).toBe("potion");
  });

  it("reports visible adjacent interactables", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    const x = game.player.x;
    const y = game.player.y;

    game.map.cells[y + 1]![x] = "doorClosed";
    game.map.cells[y]![x + 1] = "trap";
    game.monstersByFloor.get(game.depth)!.push({
      id: 999,
      name: "test rat",
      x: x - 1,
      y,
      hp: 1,
      maxHp: 1,
      atk: 1,
      def: 0,
      sprite: T.Rat,
      isPlayer: false,
      alive: true,
      xp: 0,
      level: 1,
      xpValue: 1,
      skillPoints: 0,
      archetype: "normal",
      speed: 1,
      range: 0,
      statuses: [],
    });

    game.visible = new Set([
      y * MAP_W + (x - 1),
      (y + 1) * MAP_W + x,
      y * MAP_W + (x + 1),
    ]);

    const adjacent = game.adjacentInteractables();
    expect(adjacent.doorClosed).toBe(true);
    expect(adjacent.trap).toBe(true);
    expect(adjacent.monster?.name).toBe("test rat");
  });

  it("ignores diagonal interactables", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    const x = game.player.x;
    const y = game.player.y;

    game.map.cells[y + 1]![x + 1] = "trap";
    game.visible = new Set([(y + 1) * MAP_W + (x + 1)]);

    expect(game.adjacentInteractables().trap).toBe(false);
  });
});

describe("Game cheats", () => {
  it("god mode prevents death from traps", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.godMode = true;
    game.player.hp = 1;
    game.map.cells[game.player.y + 1]![game.player.x] = "trap";

    expect(game.tryMove(0, 1)).toBe(true);
    expect(game.player.alive).toBe(true);
    expect(game.player.hp).toBe(1);
    expect(game.gameOver).toBe(false);
  });

  it("god mode prevents death from status effects", () => {
    const game = new Game();
    game.monstersByFloor.set(game.depth, []);
    game.godMode = true;
    game.player.hp = 1;
    addStatus(game.player, "poison", 1, 10);

    game.monstersAct();
    expect(game.player.alive).toBe(true);
    expect(game.player.hp).toBe(1);
    expect(game.gameOver).toBe(false);
  });

  it("level up cheat increases level and grants a skill point", () => {
    const game = new Game();
    game.cheatLevelUp();
    expect(game.player.level).toBe(2);
    expect(game.player.skillPoints).toBe(1);
  });

  it("next depth cheat descends without stairs", () => {
    const game = new Game();
    game.cheatNextDepth();
    expect(game.depth).toBe(2);
    expect(game.map).toBe(game.floors.get(2)!);
  });
});
