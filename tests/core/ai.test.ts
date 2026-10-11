import { describe, expect, it } from "bun:test";
import { RNG } from "../../src/core/rng.ts";
import { chaseDistances, monsterStep } from "../../src/core/ai.ts";
import { makePlayer, type Entity } from "../../src/core/entities.ts";
import { MAP_W } from "../../src/core/mapgen/common.ts";
import { T } from "../../src/core/tiles.ts";
import { mkMap, openInterior } from "./helpers.ts";

function monster(x: number, y: number): Entity {
  return {
    id: 1,
    name: "rat",
    x,
    y,
    hp: 4,
    maxHp: 4,
    atk: 2,
    def: 0,
    sprite: T.Rat,
    isPlayer: false,
    alive: true,
    xp: 0,
    level: 1,
    xpValue: 2,
  };
}

describe("chaseDistances", () => {
  it("blocks walls and closed doors", () => {
    const cells = openInterior();
    cells[10]![12] = "doorClosed";
    const dist = chaseDistances(mkMap(cells), makePlayer(10, 10));
    expect(dist[10 * MAP_W + 10]).toBe(0);
    expect(dist[10 * MAP_W + 12]).toBe(-1);
    expect(dist[12 * MAP_W + 11]).toBe(3);
  });
});

describe("monsterStep", () => {
  it("attacks the player when adjacent and visible", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(11, 10);
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(player.hp).toBeLessThan(12);
    expect(m.x).toBe(11);
    expect(m.y).toBe(10);
  });

  it("chases toward the player along the BFS path when visible", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(14, 10);
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(m.x).toBe(13);
    expect(m.y).toBe(10);
  });

  it("does not attack or chase when the player is out of sight", () => {
    const cells = openInterior();
    for (let y = 5; y <= 20; y++) cells[y]![12] = "wall";
    const map = mkMap(cells, { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const m = monster(14, 10);
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m] });
    expect(player.hp).toBe(12);
  });

  it("does not move into another monster", () => {
    const map = mkMap(openInterior(), { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const blocker = monster(13, 10);
    const m = monster(14, 10);
    monsterStep(m, { player, map, rng: new RNG(1), dist: chaseDistances(map, player), monsters: [m, blocker] });
    expect(m.x).not.toBe(13);
  });

  it("wanders only into safe tiles when the player is out of sight", () => {
    const cells = openInterior();
    for (let y = 5; y <= 20; y++) cells[y]![12] = "wall";
    cells[10]![13] = "wall";
    cells[10]![15] = "doorClosed";

    const map = mkMap(cells, { x: 10, y: 10 });
    const player = makePlayer(10, 10);
    const blocker = monster(14, 9);
    const m = monster(14, 10);

    for (let seed = 1; seed <= 50; seed++) {
      m.x = 14;
      m.y = 10;
      monsterStep(m, {
        player,
        map,
        rng: new RNG(seed),
        dist: chaseDistances(map, player),
        monsters: [m, blocker],
      });

      expect(player.hp).toBe(12);
      expect(m.x).toBe(14);
      expect(m.y === 10 || m.y === 11).toBe(true);
      expect(map.cells[m.y]![m.x]).toBe("floor");
    }
  });
});
